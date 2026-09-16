// lib/inventory/movements.ts
//
// The one place stock is allowed to move.
//
// Every path that changes a stock figure — checkout, cancellation, a manual
// adjustment, a reversal — writes its ledger row through `recordMovement` and keeps
// the per-warehouse mirror in step through `mirrorWarehouseStock`. Nothing here
// updates `products.stock_quantity` itself: that stays with the caller, because the
// callers have different concurrency needs (checkout uses a guarded UPDATE,
// adjustment uses SELECT … FOR UPDATE) and folding them together would mean picking
// the wrong one for one of them.
//
// Two invariants this module exists to protect:
//
//   1. `sum(quantity_delta)` per product equals `products.stock_quantity`. If it
//      doesn't, something wrote stock without coming through here.
//   2. Value that leaves the business without being sold appears in the shop books
//      exactly once — see `booksWriteOff` in ./reasons for the rule and why `sale` is
//      excluded from it.
//
// Every function takes an explicit `client` so it can join the caller's transaction.
// The ledger row must commit or roll back with the stock change it describes; a
// movement recorded for a change that was rolled back is worse than no movement at
// all, because it is a lie that reconciles.

import { and, eq, isNull } from 'drizzle-orm';

import {
  expenseCategories,
  expenses,
  inventory,
  inventoryMovements,
  warehouses,
} from '@/db/schema';
import type { DbClient } from '@/lib/pricing/quote';
import { toPaisa, toRupees } from '@/lib/pricing/quote';
import {
  WRITE_OFF_CATEGORY_DESCRIPTION,
  WRITE_OFF_CATEGORY_NAME,
  REASON_LABELS,
  type InventoryMovementReason,
} from './reasons';

/**
 * Today's date as the shop would write it.
 *
 * Nepal is a fixed UTC+05:45 with no daylight saving, and this server may well run in
 * UTC. Using the raw UTC date would file a 9pm write-off in Dhangadhi against
 * yesterday, which is the sort of off-by-one that only ever shows up as an
 * unexplainable expense at month end.
 */
export function todayInNepal(): string {
  const NEPAL_OFFSET_MINUTES = 5 * 60 + 45;
  const shifted = new Date(Date.now() + NEPAL_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export interface MovementInput {
  productId: number;
  variantId?: number | null;
  /**
   * Null means "against the authoritative product-level count" — which is what a
   * sale is, since `products.stock_quantity` is not per-warehouse.
   */
  warehouseId?: number | null;
  productName: string;
  sku: string;
  /** Signed. Zero is rejected by a CHECK constraint, so callers must not pass it. */
  quantityDelta: number;
  /** On-hand immediately after this movement, i.e. the post-UPDATE value. */
  quantityAfter: number;
  reason: InventoryMovementReason;
  /** `products.cost_price` at this moment, or null when none is on record. */
  unitCost?: string | null;
  note?: string | null;
  referenceNo?: string | null;
  orderId?: number | null;
  expenseId?: number | null;
  reversesMovementId?: number | null;
  performedBy?: number | null;
  performedByName?: string | null;
}

export type MovementRow = typeof inventoryMovements.$inferSelect;

/** Appends one row to the ledger and returns it. There is no update or delete path. */
export async function recordMovement(
  client: DbClient,
  input: MovementInput,
): Promise<MovementRow> {
  // A movement of zero units is not a movement, and the CHECK constraint would reject
  // it with a message about a constraint rather than about the mistake.
  if (input.quantityDelta === 0) {
    throw new Error('A stock movement of zero units is not a movement.');
  }

  const [row] = await client
    .insert(inventoryMovements)
    .values({
      productId: input.productId,
      variantId: input.variantId ?? null,
      warehouseId: input.warehouseId ?? null,
      productNameSnapshot: input.productName,
      skuSnapshot: input.sku,
      quantityDelta: input.quantityDelta,
      quantityAfter: input.quantityAfter,
      reason: input.reason,
      unitCostSnapshot: input.unitCost ?? null,
      note: input.note ?? null,
      referenceNo: input.referenceNo ?? null,
      orderId: input.orderId ?? null,
      expenseId: input.expenseId ?? null,
      reversesMovementId: input.reversesMovementId ?? null,
      performedBy: input.performedBy ?? null,
      performedByName: input.performedByName ?? null,
    })
    .returning();

  return row;
}

/**
 * The single active warehouse, or null when there is not exactly one.
 *
 * Used by the sale and cancellation paths, which have no warehouse of their own to
 * name. Returning null for "two or more" is deliberate: once the shop has a second
 * branch, guessing which one a web order shipped from would be an invention, and a
 * null mirror is more honest than a wrong one.
 */
export async function resolveDefaultWarehouse(client: DbClient): Promise<number | null> {
  const active = await client
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(eq(warehouses.isActive, true))
    .limit(2);

  return active.length === 1 ? active[0].id : null;
}

/**
 * Keeps `inventory.quantity_on_hand` in step with the authoritative count on the
 * product row.
 *
 * Two things make this less trivial than an UPDATE:
 *
 *   - A product created through the admin form has a `products` row and **no
 *     `inventory` row** — only the seed writes those. A plain UPDATE would silently
 *     match nothing, so this inserts when it has to, which also makes the mirror
 *     self-healing for every product added since the seed.
 *   - `ON CONFLICT` cannot be used here. The unique index is on
 *     `(product_id, variant_id, warehouse_id)` and `variant_id` is null for every row
 *     this app writes; in Postgres two nulls never conflict, so the upsert would
 *     insert a duplicate row every single time instead of updating the existing one.
 *
 * **Call inside the transaction that already holds the product row lock** (the guarded
 * UPDATE in `decrementStock`, or `SELECT … FOR UPDATE` in the adjust route). That lock
 * is what makes this read-then-write safe against two adjustments racing on the same
 * product.
 *
 * Returns false when there was no warehouse to mirror into, which is not an error —
 * see `resolveDefaultWarehouse`.
 */
export async function mirrorWarehouseStock(
  client: DbClient,
  args: {
    productId: number;
    variantId?: number | null;
    warehouseId: number | null;
    quantityOnHand: number;
  },
): Promise<boolean> {
  if (args.warehouseId === null) return false;

  const variantId = args.variantId ?? null;
  const scope = and(
    eq(inventory.productId, args.productId),
    eq(inventory.warehouseId, args.warehouseId),
    variantId === null ? isNull(inventory.variantId) : eq(inventory.variantId, variantId),
  );

  const updated = await client
    .update(inventory)
    .set({ quantityOnHand: args.quantityOnHand, updatedAt: new Date() })
    .where(scope)
    .returning({ id: inventory.id });

  if (updated.length > 0) return true;

  await client.insert(inventory).values({
    productId: args.productId,
    variantId,
    warehouseId: args.warehouseId,
    quantityOnHand: args.quantityOnHand,
  });

  return true;
}

/**
 * Finds the write-off expense category, creating it the first time one is needed.
 *
 * The nine categories the seed writes are all trading overheads (rent, salaries,
 * utilities…); none of them fits stock that was destroyed, so this one is created on
 * demand rather than requiring a reseed before the first write-off can be recorded.
 */
export async function ensureWriteOffCategory(client: DbClient): Promise<number> {
  const [created] = await client
    .insert(expenseCategories)
    .values({
      name: WRITE_OFF_CATEGORY_NAME,
      description: WRITE_OFF_CATEGORY_DESCRIPTION,
    })
    .onConflictDoNothing({ target: expenseCategories.name })
    .returning({ id: expenseCategories.id });

  if (created) return created.id;

  const [existing] = await client
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(eq(expenseCategories.name, WRITE_OFF_CATEGORY_NAME))
    .limit(1);

  return existing.id;
}

export interface WriteOffInput {
  productName: string;
  sku: string;
  /** Signed, as on the movement. Negative books a cost; a reversal's positive delta credits it back. */
  quantityDelta: number;
  unitCost: string | null;
  reason: InventoryMovementReason;
  note?: string | null;
  referenceNo?: string | null;
  performedBy?: number | null;
  /** Set when this is undoing an earlier write-off, which is the only positive movement that books. */
  isReversal?: boolean;
}

export interface WriteOffResult {
  expenseId: number | null;
  /** Rupees, signed — negative on a reversal. Null when nothing was booked. */
  amount: string | null;
  /** True when the movement should have booked but the product has no cost price. */
  costMissing: boolean;
  categoryName: string;
}

/**
 * Books the value of stock that left without being sold.
 *
 * Amount is always `-(quantityDelta × unitCost)`: a write-off of 2 units at NPR 30,500
 * is an expense of NPR 61,000, and reversing it books NPR −61,000 so the P&L returns
 * to where it was. `vat_amount` is zero because the VAT on those goods was already
 * reclaimed on the purchase bill — destroying stock does not entitle the shop to
 * reclaim it twice. `payment_method` is `non_cash` because no money left the till;
 * what left was value.
 *
 * When `cost_price` is null nothing is booked and `costMissing` is true. Booking zero
 * would report a loss of nothing for goods that certainly cost something, which is the
 * same confident-wrong figure the reports' `skusMissingCost` caption exists to avoid.
 *
 * A positive restock deliberately does **not** create a purchase bill. The money side
 * of buying stock is a `purchase_bills` row entered in Accounting against the real
 * invoice; generating one here would double-count the moment that invoice arrives.
 */
export async function bookWriteOff(
  client: DbClient,
  input: WriteOffInput,
): Promise<WriteOffResult> {
  if (input.unitCost === null || input.unitCost === undefined) {
    return {
      expenseId: null,
      amount: null,
      costMissing: true,
      categoryName: WRITE_OFF_CATEGORY_NAME,
    };
  }

  // Integer paisa throughout, so 30,500.50 × 3 cannot drift the way float rupees do.
  const amountPaisa = -toPaisa(input.unitCost) * input.quantityDelta;
  if (amountPaisa === 0) {
    return {
      expenseId: null,
      amount: null,
      costMissing: false,
      categoryName: WRITE_OFF_CATEGORY_NAME,
    };
  }

  const categoryId = await ensureWriteOffCategory(client);
  const units = Math.abs(input.quantityDelta);
  const verb = input.isReversal ? 'Reversed write-off' : 'Stock write-off';
  const description = `${verb} — ${REASON_LABELS[input.reason].toLowerCase()}: ${units} × ${input.productName} (${input.sku})`;

  const [row] = await client
    .insert(expenses)
    .values({
      categoryId,
      description: description.slice(0, 300),
      amount: toRupees(amountPaisa),
      vatAmount: '0',
      expenseDate: todayInNepal(),
      paymentMethod: 'non_cash',
      referenceNo: input.referenceNo ?? null,
      recordedBy: input.performedBy ?? null,
    })
    .returning({ id: expenses.id });

  return {
    expenseId: row.id,
    amount: toRupees(amountPaisa),
    costMissing: false,
    categoryName: WRITE_OFF_CATEGORY_NAME,
  };
}

/**
 * Recomputes `stock_status` from a quantity known in JavaScript.
 *
 * Deliberately absent. The one implementation is `stockStatusFrom` in
 * `lib/orders/stock.ts`, which computes it in SQL from the expression the UPDATE is
 * writing; the adjust route imports and reuses it. A second copy here would be the
 * place `pre_order` and `discontinued` eventually start being handled differently in
 * one path than the other.
 */
