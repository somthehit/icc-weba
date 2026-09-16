import { NextResponse } from 'next/server';

import { db } from '@/db';
import { withInventory } from '@/lib/auth/middleware';
import { AdjustmentError, applyAdjustment } from '@/lib/inventory/adjust';
import { REASON_LABELS } from '@/lib/inventory/reasons';
import { queryStockLevel } from '@/lib/queries/inventory';
import { parseJson } from '@/lib/validation/parse';
import { adjustStockSchema } from '@/lib/validation/inventory';

/**
 * Record one manual stock adjustment.
 *
 * The whole change — the count, the warehouse mirror, the write-off expense and the
 * ledger row — is one transaction. A partial success here is the worst outcome
 * available: stock down two units with no record of why, or a write-off booked against
 * units that are still on the shelf.
 *
 * `AdjustmentError` is caught **outside** `db.transaction`, which is the only place it
 * can be caught. Returning a failure from inside the callback commits the transaction,
 * so a 409 handled in there would refuse the adjustment and apply it anyway.
 */
export const POST = withInventory(async (request, { user }) => {
  const parsed = await parseJson(request, adjustStockSchema);
  if (!parsed.ok) return parsed.response;

  const input = parsed.data;

  try {
    const result = await db.transaction((tx) =>
      applyAdjustment(tx, input, {
        userId: user.userId,
        // `JWTPayload` carries no name, so the email is the actor snapshot. It is
        // stored on the movement so the log still names someone after the user row is
        // deactivated.
        name: user.email,
        isOwner: user.role === 'admin',
      }),
    );

    // Read the row back through the same query the table uses, so the client updates
    // from the figures the table would show rather than from a shape assembled here.
    // Deliberately unscoped: passing the adjustment's warehouse would narrow the mirror
    // to that one branch, which suppresses `drift` — and drift immediately after a write
    // is the one moment it is most worth knowing about.
    const stockLevel = await queryStockLevel(result.product.id);

    const units = Math.abs(result.movement.quantityDelta);
    const verb = result.movement.quantityDelta > 0 ? 'Added' : 'Removed';

    return NextResponse.json({
      success: true,
      message: `${verb} ${units} × ${result.product.sku} — ${REASON_LABELS[result.movement.reason]}. On hand: ${result.newQuantity}.`,
      movement: result.movement,
      previousQuantity: result.previousQuantity,
      newQuantity: result.newQuantity,
      bookedExpense: result.bookedExpense,
      costMissing: result.costMissing,
      mirrored: result.mirrored,
      stockLevel,
    });
  } catch (error) {
    if (error instanceof AdjustmentError) {
      return NextResponse.json(
        { error: error.message, ...error.details },
        { status: error.status },
      );
    }
    console.error('Error adjusting stock:', error);
    return NextResponse.json({ error: 'Failed to adjust stock' }, { status: 500 });
  }
});
