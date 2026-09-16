// lib/inventory/adjust.ts
//
// A manual stock adjustment, and the reversal of one.
//
// Both go through `applyAdjustment`, which is the only place in the codebase that
// changes `products.stock_quantity` outside of checkout. It does five things in a
// fixed order, inside the caller's transaction:
//
//   1. locks the product row (`SELECT … FOR UPDATE`)
//   2. refuses the write if the shelf has moved since the form loaded
//   3. updates the authoritative count and recomputes `stock_status`
//   4. mirrors the new count into `inventory` and books the write-off
//   5. appends the ledger row
//
// The lock is explicit rather than the guarded-`UPDATE` trick checkout uses, because
// this path has to *read* the resulting quantity in order to write `quantity_after`
// and to preview the value being written off. Holding it across steps 3–5 is also
// what makes `mirrorWarehouseStock`'s read-then-write safe.
//
// Failures throw `AdjustmentError`. They must: returning a failure value from inside
// a Drizzle transaction callback **commits** it, so a 409 that returned instead of
// threw would leave the stock change it was refusing already applied.

import { eq, sql } from 'drizzle-orm';

import { inventoryMovements, products } from '@/db/schema';
import { stockStatusFrom } from '@/lib/orders/stock';
import type { DbClient } from '@/lib/pricing/quote';
import {
  bookWriteOff,
  mirrorWarehouseStock,
  recordMovement,
  resolveDefaultWarehouse,
  type MovementRow,
} from './movements';
import {
  MANUAL_REASONS,
  REASON_LABELS,
  booksWriteOff,
  type InventoryMovementReason,
} from './reasons';

/** Carries an HTTP status out of the transaction so the route need not guess one. */
export class AdjustmentError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AdjustmentError';
  }
}

export interface AdjustmentActor {
  userId: number;
  /** Snapshotted onto the movement, so "who did this" survives a deactivated user. */
  name: string | null;
  /** Only an owner may drive a count below zero. */
  isOwner: boolean;
}

export interface ApplyAdjustmentInput {
  productId: number;
  variantId?: number | null;
  /**
   * `undefined` asks for the shop's only active warehouse; explicit `null` records the
   * movement against the product-level count with no warehouse named.
   */
  warehouseId?: number | null;
  quantityDelta: number;
  reason: InventoryMovementReason;
  note?: string | null;
  referenceNo?: string | null;
  /** The count the form was showing. A mismatch is a 409. */
  expectedQuantity?: number;
  allowNegative?: boolean;
  /** Set when this movement undoes an earlier one. */
  reversesMovementId?: number | null;
  /**
   * Overrides `products.cost_price`. Used by a reversal so it books against the cost
   * the original froze, even if someone has corrected the purchase price since.
   */
  unitCostOverride?: string | null;
  /**
   * Per-unit purchase price for this batch, from the receive form.
   *
   * Only honoured when the delta is positive: receiving at a known price is new
   * information about what stock costs, so it is written to `products.cost_price` and
   * used as this movement's snapshot. A removal deliberately ignores it — the cost a
   * write-off should book against is the one already on record, not a figure typed
   * while removing stock.
   */
  unitCost?: number;
  /**
   * `auto` applies the rule in `booksWriteOff`. `reversal` books the opposite sign of
   * an earlier write-off. `never` books nothing — used when the original booked no
   * expense, so undoing it must not create one.
   */
  booking?: 'auto' | 'reversal' | 'never';
}

export interface AdjustmentResult {
  movement: MovementRow;
  product: {
    id: number;
    sku: string;
    name: string;
    stockQuantity: number;
    stockStatus: string;
    lowStockThreshold: number;
  };
  previousQuantity: number;
  newQuantity: number;
  /** Null when nothing was booked — see `costMissing` for whether that was a gap. */
  bookedExpense: { id: number; amount: number; categoryName: string } | null;
  /** True when this should have booked a cost but the product has none on record. */
  costMissing: boolean;
  /** False when there was no warehouse to mirror into, which is not an error. */
  mirrored: boolean;
  warehouseId: number | null;
}

/**
 * Applies one adjustment. **Call inside a transaction.**
 *
 * Not exported for use outside this module's two callers — the whole point is that
 * every manual stock change goes through here, so anything reaching for it directly
 * is a path that would bypass the ledger.
 */
export async function applyAdjustment(
  client: DbClient,
  input: ApplyAdjustmentInput,
  actor: AdjustmentActor,
): Promise<AdjustmentResult> {
  const [locked] = await client
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      stockQuantity: products.stockQuantity,
      stockStatus: products.stockStatus,
      lowStockThreshold: products.lowStockThreshold,
      costPrice: products.costPrice,
    })
    .from(products)
    .where(eq(products.id, input.productId))
    .for('update')
    .limit(1);

  if (!locked) {
    throw new AdjustmentError(404, 'Product not found');
  }

  // Optimistic concurrency. Two people adjusting the same product from screens loaded
  // a minute apart is the ordinary failure mode of a stock table, and applying both
  // deltas silently is how a physical count and the system stop agreeing.
  if (
    input.expectedQuantity !== undefined &&
    input.expectedQuantity !== locked.stockQuantity
  ) {
    throw new AdjustmentError(
      409,
      `Stock has changed since this screen loaded — it is now ${locked.stockQuantity}, not ${input.expectedQuantity}. Reload and check the figure before adjusting.`,
      { actualQuantity: locked.stockQuantity, expectedQuantity: input.expectedQuantity },
    );
  }

  const newQuantity = locked.stockQuantity + input.quantityDelta;

  // A pre-order product is sold before its stock arrives, so a negative count is its
  // normal state and refusing one here would make it impossible to write off a damaged
  // pre-order unit. Every other product needs an owner to say so explicitly.
  const negativeIsExpected = locked.stockStatus === 'pre_order';

  // Only a *removal* can be refused for going negative. A positive delta can only
  // raise the count, so if the result is still below zero that is a pre-existing
  // balance this movement is helping to fix, not a shortage it is causing.
  if (newQuantity < 0 && input.quantityDelta < 0 && !negativeIsExpected) {
    if (!input.allowNegative) {
      throw new AdjustmentError(
        409,
        `Only ${locked.stockQuantity} in stock — removing ${Math.abs(input.quantityDelta)} would leave ${newQuantity}. Adjust by ${locked.stockQuantity} or fewer, or ask an owner to allow a negative balance.`,
        { availableQuantity: locked.stockQuantity, resultingQuantity: newQuantity },
      );
    }
    if (!actor.isOwner) {
      throw new AdjustmentError(
        403,
        'Only an owner may take stock below zero.',
        { resultingQuantity: newQuantity },
      );
    }
  }

  // `undefined` means "use the default"; explicit null means "no warehouse".
  const warehouseId =
    input.warehouseId === undefined
      ? await resolveDefaultWarehouse(client)
      : input.warehouseId;

  const quantity = sql`${newQuantity}`;

  /**
   * A receipt at a stated price updates what the product is recorded as costing.
   *
   * Written in the same UPDATE as the count so the two cannot diverge — a separate
   * statement could leave stock raised with the old cost if it failed. Fixed to 2dp to
   * match `products.cost_price` numeric(12,2); passing a raw float would be rounded by
   * Postgres and then disagree with the movement snapshot below.
   */
  const receivedCost =
    input.unitCost !== undefined && input.quantityDelta > 0
      ? input.unitCost.toFixed(2)
      : null;

  const [updated] = await client
    .update(products)
    .set({
      stockQuantity: newQuantity,
      // The same CASE checkout uses, so `pre_order` and `discontinued` are preserved
      // identically on both paths. Re-deriving it here is how they would drift.
      stockStatus: stockStatusFrom(quantity),
      ...(receivedCost !== null ? { costPrice: receivedCost } : {}),
      updatedAt: new Date(),
    })
    .where(eq(products.id, input.productId))
    .returning({
      id: products.id,
      sku: products.sku,
      name: products.name,
      stockQuantity: products.stockQuantity,
      stockStatus: products.stockStatus,
      lowStockThreshold: products.lowStockThreshold,
    });

  const mirrored = await mirrorWarehouseStock(client, {
    productId: input.productId,
    variantId: input.variantId ?? null,
    warehouseId,
    quantityOnHand: updated.stockQuantity,
  });

  // Precedence: an explicit reversal override wins (it replays a frozen cost), then a
  // cost just received, then whatever the product already carried.
  const unitCost =
    input.unitCostOverride !== undefined
      ? input.unitCostOverride
      : (receivedCost ?? locked.costPrice);

  const booking = input.booking ?? 'auto';
  const shouldBook =
    booking === 'reversal' ||
    (booking === 'auto' && booksWriteOff(input.reason, input.quantityDelta));

  let bookedExpense: AdjustmentResult['bookedExpense'] = null;
  let costMissing = false;

  if (shouldBook) {
    const written = await bookWriteOff(client, {
      productName: updated.name,
      sku: updated.sku,
      quantityDelta: input.quantityDelta,
      unitCost,
      reason: input.reason,
      note: input.note ?? null,
      referenceNo: input.referenceNo ?? null,
      performedBy: actor.userId,
      isReversal: booking === 'reversal',
    });

    costMissing = written.costMissing;
    if (written.expenseId !== null && written.amount !== null) {
      bookedExpense = {
        id: written.expenseId,
        amount: Number(written.amount),
        categoryName: written.categoryName,
      };
    }
  }

  const movement = await recordMovement(client, {
    productId: input.productId,
    variantId: input.variantId ?? null,
    warehouseId,
    productName: updated.name,
    sku: updated.sku,
    quantityDelta: input.quantityDelta,
    quantityAfter: updated.stockQuantity,
    reason: input.reason,
    unitCost,
    note: input.note ?? null,
    referenceNo: input.referenceNo ?? null,
    expenseId: bookedExpense?.id ?? null,
    reversesMovementId: input.reversesMovementId ?? null,
    performedBy: actor.userId,
    performedByName: actor.name,
  });

  return {
    movement,
    product: updated,
    previousQuantity: locked.stockQuantity,
    newQuantity: updated.stockQuantity,
    bookedExpense,
    costMissing,
    mirrored,
    warehouseId,
  };
}

const MANUAL_SET = new Set<string>(MANUAL_REASONS);

/**
 * Undoes one movement by writing its opposite.
 *
 * Nothing is updated or deleted — the append-only trigger would refuse, and a ledger
 * you can edit is not evidence of anything. The reversal:
 *
 *   - moves exactly `-original.quantityDelta` units, read from the stored row rather
 *     than from the request, so a "reversal" cannot quietly reverse a different amount
 *   - reuses the original's warehouse, so units go back where they came from
 *   - reuses the original's `unit_cost_snapshot`, so the paired expense nets to zero
 *     even if the purchase price has been corrected since
 *   - books a **negative** expense only when the original booked a positive one
 *
 * **Call inside a transaction.**
 */
export async function reverseMovement(
  client: DbClient,
  args: { movementId: number; note?: string | null },
  actor: AdjustmentActor,
): Promise<AdjustmentResult & { original: MovementRow }> {
  const [original] = await client
    .select()
    .from(inventoryMovements)
    .where(eq(inventoryMovements.id, args.movementId))
    .limit(1);

  if (!original) {
    throw new AdjustmentError(404, 'Movement not found');
  }

  if (!MANUAL_SET.has(original.reason)) {
    // Label first, so the sentence needs no article — "A opening balance movement…" is
    // what you get from gluing one on.
    throw new AdjustmentError(
      422,
      `${REASON_LABELS[original.reason]} movements cannot be reversed here — record an audit correction instead, or cancel the order if this was a sale.`,
    );
  }

  if (original.reversesMovementId !== null) {
    throw new AdjustmentError(
      422,
      'That movement is itself a reversal. Record a fresh adjustment instead of reversing a reversal.',
    );
  }

  // Checked here for the error message; the partial unique index on
  // `reverses_movement_id` is what actually makes it impossible under a race.
  const [existing] = await client
    .select({ id: inventoryMovements.id })
    .from(inventoryMovements)
    .where(eq(inventoryMovements.reversesMovementId, original.id))
    .limit(1);

  if (existing) {
    throw new AdjustmentError(409, 'That movement has already been reversed.', {
      reversedByMovementId: existing.id,
    });
  }

  const note =
    args.note ??
    `Reversal of movement #${original.id}${original.note ? ` (${original.note})` : ''}`;

  const result = await applyAdjustment(
    client,
    {
      productId: original.productId,
      variantId: original.variantId,
      warehouseId: original.warehouseId,
      quantityDelta: -original.quantityDelta,
      reason: original.reason,
      note: note.slice(0, 500),
      referenceNo: original.referenceNo,
      reversesMovementId: original.id,
      unitCostOverride: original.unitCostSnapshot,
      // Only undo a booking that happened. A restock books nothing, so reversing one
      // must not create a credit against an expense that was never charged.
      booking: original.expenseId === null ? 'never' : 'reversal',
      // No `allowNegative` override. Undoing a write-off only ever adds units, and
      // undoing a restock genuinely should be refused when those units are no longer
      // there to take back — somebody has since sold them, and the answer is a fresh
      // adjustment with a reason, not a silent negative balance.
    },
    actor,
  );

  return { ...result, original };
}
