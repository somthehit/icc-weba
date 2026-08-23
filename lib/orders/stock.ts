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

import { and, eq, gte, sql, type SQL } from 'drizzle-orm';

import { orderItems, products } from '@/db/schema';
import type { DbClient, QuoteLine } from '@/lib/pricing/quote';

/**
 * Recomputes `stock_status` from the quantity the same statement is writing.
 *
 * `pre_order` and `discontinued` are left alone: they describe how the product is
 * sold, not how many are on the shelf, and recomputing them from stock would
 * quietly turn a pre-order listing into a normal one.
 */
function stockStatusFrom(newQuantity: SQL): SQL {
  return sql`CASE
    WHEN ${products.stockStatus} IN ('pre_order', 'discontinued') THEN ${products.stockStatus}
    WHEN ${newQuantity} <= 0 THEN 'out_of_stock'
    WHEN ${newQuantity} <= ${products.lowStockThreshold} THEN 'low_stock'
    ELSE 'in_stock'
  END`;
}

export type StockResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Takes the ordered quantities off the shelf.
 *
 * Call inside a transaction: a failure part-way through leaves earlier lines
 * decremented, and only a rollback puts them back.
 */
export async function decrementStock(
  client: DbClient,
  lines: QuoteLine[],
): Promise<StockResult> {
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
      .returning({ id: products.id });

    if (!taken) {
      return {
        ok: false,
        status: 409,
        error: `${line.productNameSnapshot} just sold out — please review your cart`,
      };
    }
  }

  return { ok: true };
}

/**
 * Puts a cancelled order's stock back.
 *
 * Without this a cancellation leaks inventory: the units stay reserved to an
 * order nobody is going to receive. Lines whose product has since been deleted
 * (`product_id` is nulled by the FK) have nothing to restock and are skipped.
 */
export async function restockOrder(client: DbClient, orderId: number): Promise<void> {
  const lines = await client
    .select({ productId: orderItems.productId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const line of lines) {
    if (line.productId === null) continue;

    const restored = sql`${products.stockQuantity} + ${line.quantity}`;

    await client
      .update(products)
      .set({
        stockQuantity: restored,
        stockStatus: stockStatusFrom(restored),
        updatedAt: new Date(),
      })
      .where(eq(products.id, line.productId));
  }
}
