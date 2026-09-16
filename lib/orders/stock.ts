// lib/orders/stock.ts
//
// Stock movements that go with placing and cancelling an order.
//
// `POST /api/orders` never touched stock, so the shop could sell the same last
// laptop to ten customers and the storefront would keep calling it in stock. The
// decrement here is a single guarded UPDATE per line: the `>= quantity`
// predicate is evaluated by Postgres while the row is locked, so two checkouts
// racing for the last unit cannot both win — the loser matches no row and gets a
// 409 instead of a negative stock count.
//
// Each decrement also appends a row to `inventory_movements`. Without it the audit
// log would only ever show manual adjustments, and the largest cause of stock leaving
// the shop — selling it — would be the one thing with no record. The ledger row comes
// out of the same `RETURNING` clause as the guard, so it costs no extra query and no
// extra lock: Drizzle returns post-UPDATE values, which means the returned
// `stockQuantity` *is* the movement's `quantity_after`.

import { and, eq, gte, sql, type SQL, type SQLWrapper } from 'drizzle-orm';

import { orderItems, products } from '@/db/schema';
import {
  mirrorWarehouseStock,
  recordMovement,
  resolveDefaultWarehouse,
} from '@/lib/inventory/movements';
import type { InventoryMovementReason } from '@/lib/inventory/reasons';
import type { DbClient, QuoteLine } from '@/lib/pricing/quote';

/**
 * Recomputes `stock_status` from the quantity the same statement is writing.
 *
 * `pre_order` and `discontinued` are left alone: they describe how the product is
 * sold, not how many are on the shelf, and recomputing them from stock would
 * quietly turn a pre-order listing into a normal one.
 *
 * `threshold` defaults to reading `low_stock_threshold` off the row, which is right for
 * every caller that is not changing it. The reorder-point route *is* changing it, and
 * must pass the new value: expressions in an `UPDATE … SET` clause see the **old** row,
 * so reading the column there would compare against the threshold being replaced and
 * leave the badge one edit behind.
 *
 * Exported because the manual adjustment route writes stock too, and a second copy of
 * this CASE is how those two paths would drift apart on exactly the two statuses that
 * matter.
 */
export function stockStatusFrom(
  newQuantity: SQL | SQLWrapper | number,
  threshold: SQLWrapper | number = products.lowStockThreshold,
): SQL {
  return sql`CASE
    WHEN ${products.stockStatus} IN ('pre_order', 'discontinued') THEN ${products.stockStatus}
    WHEN ${newQuantity} <= 0 THEN 'out_of_stock'
    WHEN ${newQuantity} <= ${threshold} THEN 'low_stock'
    ELSE 'in_stock'
  END`;
}

/** One product's worth of what just happened, ready to be written to the ledger. */
export interface StockChange {
  productId: number;
  variantId: number | null;
  productName: string;
  sku: string;
  /** Signed: negative when units left the shelf. */
  quantityDelta: number;
  /** On-hand after the UPDATE. */
  quantityAfter: number;
  unitCost: string | null;
}

export type StockResult =
  | { ok: true; changes: StockChange[] }
  | { ok: false; status: number; error: string };

/**
 * Takes the ordered quantities off the shelf.
 *
 * Call inside a transaction: a failure part-way through leaves earlier lines
 * decremented, and only a rollback puts them back.
 *
 * Returns what changed rather than writing the ledger itself, because this runs
 * *before* the order row exists — the 409 for "just sold out" has to abort the
 * checkout before an order number and a coupon redemption are spent on it. The caller
 * passes the result to `recordSaleMovements` once it has an order id, inside the same
 * transaction.
 */
export async function decrementStock(
  client: DbClient,
  lines: QuoteLine[],
): Promise<StockResult> {
  const changes: StockChange[] = [];

  for (const line of lines) {
    const remaining = sql`${products.stockQuantity} - ${line.quantity}`;

    // A pre-order is sold before the stock arrives, so its only guard is that the
    // product still exists. The count is allowed to go negative: -3 is an honest
    // record of three units owed, and `stock_status` stays `pre_order` either way.
    const scope = line.allowBackorder
      ? eq(products.id, line.productId)
      : and(eq(products.id, line.productId), gte(products.stockQuantity, line.quantity));

    const [taken] = await client
      .update(products)
      .set({
        stockQuantity: remaining,
        stockStatus: stockStatusFrom(remaining),
        updatedAt: new Date(),
      })
      .where(scope)
      .returning({
        id: products.id,
        name: products.name,
        sku: products.sku,
        stockQuantity: products.stockQuantity,
        costPrice: products.costPrice,
      });

    if (!taken) {
      return {
        ok: false,
        status: 409,
        error: `${line.productNameSnapshot} just sold out — please review your cart`,
      };
    }

    changes.push({
      productId: taken.id,
      variantId: line.variantId,
      productName: taken.name,
      sku: taken.sku,
      quantityDelta: -line.quantity,
      quantityAfter: taken.stockQuantity,
      unitCost: taken.costPrice,
    });
  }

  return { ok: true, changes };
}

/**
 * Writes the ledger rows for a set of stock changes and keeps the warehouse mirror in
 * step.
 *
 * The warehouse is resolved once for the whole batch, and is null whenever the shop
 * has more than one active warehouse — a web order is not fulfilled from a warehouse
 * this code can identify, and guessing would put units back on the wrong shelf. See
 * `resolveDefaultWarehouse`.
 */
export async function recordSaleMovements(
  client: DbClient,
  args: {
    orderId: number;
    changes: StockChange[];
    reason: Extract<InventoryMovementReason, 'sale' | 'sale_cancelled'>;
    note?: string | null;
    performedBy?: number | null;
    performedByName?: string | null;
  },
): Promise<void> {
  if (args.changes.length === 0) return;

  const warehouseId = await resolveDefaultWarehouse(client);

  for (const change of args.changes) {
    await recordMovement(client, {
      productId: change.productId,
      variantId: change.variantId,
      warehouseId,
      productName: change.productName,
      sku: change.sku,
      quantityDelta: change.quantityDelta,
      quantityAfter: change.quantityAfter,
      reason: args.reason,
      unitCost: change.unitCost,
      note: args.note ?? null,
      orderId: args.orderId,
      performedBy: args.performedBy ?? null,
      performedByName: args.performedByName ?? null,
    });

    await mirrorWarehouseStock(client, {
      productId: change.productId,
      variantId: change.variantId,
      warehouseId,
      quantityOnHand: change.quantityAfter,
    });
  }
}

/**
 * Puts a cancelled order's stock back.
 *
 * Without this a cancellation leaks inventory: the units stay reserved to an
 * order nobody is going to receive. Lines whose product has since been deleted
 * (`product_id` is nulled by the FK) have nothing to restock and are skipped.
 *
 * The paired `sale_cancelled` movements are valued at the cost the *order line* froze
 * rather than the product's cost today, so undoing a sale is worth what the sale was
 * worth even if someone has corrected the purchase price since.
 */
export async function restockOrder(
  client: DbClient,
  orderId: number,
  actor?: { userId: number; name?: string | null },
): Promise<void> {
  const lines = await client
    .select({
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      quantity: orderItems.quantity,
      unitCostSnapshot: orderItems.unitCostSnapshot,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const changes: StockChange[] = [];

  for (const line of lines) {
    if (line.productId === null) continue;

    const restored = sql`${products.stockQuantity} + ${line.quantity}`;

    const [put] = await client
      .update(products)
      .set({
        stockQuantity: restored,
        stockStatus: stockStatusFrom(restored),
        updatedAt: new Date(),
      })
      .where(eq(products.id, line.productId))
      .returning({
        id: products.id,
        name: products.name,
        sku: products.sku,
        stockQuantity: products.stockQuantity,
      });

    if (!put) continue;

    changes.push({
      productId: put.id,
      variantId: line.variantId,
      productName: put.name,
      sku: put.sku,
      quantityDelta: line.quantity,
      quantityAfter: put.stockQuantity,
      unitCost: line.unitCostSnapshot,
    });
  }

  await recordSaleMovements(client, {
    orderId,
    changes,
    reason: 'sale_cancelled',
    note: 'Order cancelled — units returned to stock.',
    performedBy: actor?.userId ?? null,
    performedByName: actor?.name ?? null,
  });
}
