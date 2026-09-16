import { NextResponse } from 'next/server';

import { db } from '@/db';
import { withInventory } from '@/lib/auth/middleware';
import { AdjustmentError, reverseMovement } from '@/lib/inventory/adjust';
import { queryStockLevel } from '@/lib/queries/inventory';
import { parseJson } from '@/lib/validation/parse';
import { reverseMovementSchema } from '@/lib/validation/inventory';

/**
 * Undo one movement by writing its opposite.
 *
 * There is no `PUT` or `DELETE` anywhere on `inventory_movements`, and this is why an
 * append-only ledger is still usable: the first time someone types −20 for −2, the fix
 * is a second row that says so, not a quiet edit to the first.
 *
 * The delta, warehouse and unit cost all come from the stored row rather than the
 * request body — see `reverseMovement`. A reversal that could name its own amount would
 * not be a reversal.
 */
export const POST = withInventory(async (request, { user }) => {
  const parsed = await parseJson(request, reverseMovementSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await db.transaction((tx) =>
      reverseMovement(tx, parsed.data, {
        userId: user.userId,
        name: user.email,
        isOwner: user.role === 'admin',
      }),
    );

    const stockLevel = await queryStockLevel(result.product.id);

    return NextResponse.json({
      success: true,
      message: `Reversed movement #${result.original.id}. ${result.product.sku} is back to ${result.newQuantity} on hand.`,
      movement: result.movement,
      original: result.original,
      previousQuantity: result.previousQuantity,
      newQuantity: result.newQuantity,
      bookedExpense: result.bookedExpense,
      costMissing: result.costMissing,
      stockLevel,
    });
  } catch (error) {
    if (error instanceof AdjustmentError) {
      return NextResponse.json(
        { error: error.message, ...error.details },
        { status: error.status },
      );
    }
    console.error('Error reversing movement:', error);
    return NextResponse.json({ error: 'Failed to reverse movement' }, { status: 500 });
  }
});
