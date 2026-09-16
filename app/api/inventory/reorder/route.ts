import { eq, isNull, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { inventory, products } from '@/db/schema';
import { withInventory } from '@/lib/auth/middleware';
import { resolveDefaultWarehouse } from '@/lib/inventory/movements';
import { stockStatusFrom } from '@/lib/orders/stock';
import { queryReorderList } from '@/lib/queries/inventory';
import { parseJson } from '@/lib/validation/parse';
import { reorderPointSchema } from '@/lib/validation/inventory';
import { idParamSchema } from '@/lib/validation/schemas';

/**
 * Everything at or below its buying line, shortest first.
 *
 * The line is `inventory.reorder_point` where a row sets one and
 * `products.low_stock_threshold` otherwise, and each row says which of the two it used —
 * a buying list that will not tell you where its numbers came from is a list nobody
 * acts on.
 *
 * Deliberately *not* the same predicate as the Low Stock KPI card, which is
 * `0 < stock <= low_stock_threshold`. This one includes zero (out of stock is the most
 * urgent thing to buy, not something to leave off the list) and honours a per-warehouse
 * reorder point above the threshold. The two counts will differ, and each row shows its
 * own line so the difference is legible rather than mysterious.
 */
export const GET = withInventory(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('limit');
    const parsedLimit = raw === null ? null : idParamSchema.safeParse(raw);

    if (parsedLimit && !parsedLimit.success) {
      return NextResponse.json({ error: 'limit must be a positive integer' }, { status: 400 });
    }

    const limit = parsedLimit?.success ? Math.min(parsedLimit.data, 500) : 100;

    const data = await queryReorderList(limit);
    return NextResponse.json({ data, limit, truncated: data.length === limit });
  } catch (error) {
    console.error('Error fetching reorder list:', error);
    return NextResponse.json({ error: 'Failed to fetch reorder list' }, { status: 500 });
  }
});

/**
 * Set a product's buying line.
 *
 * Two different columns, on purpose:
 *
 *   - `products.low_stock_threshold` drives `stock_status`, so it is the one the
 *     storefront badge and the KPI card read.
 *   - `inventory.reorder_point` is per-warehouse and drives only this planner.
 *
 * Changing the threshold recomputes `stock_status` **in the same statement**, with the
 * new value passed explicitly. A `SET` expression reads the old row, so recomputing from
 * the column would compare against the threshold being replaced and leave the badge one
 * edit stale — a product would sit at "In Stock" until the next sale nudged it.
 */
export const PUT = withInventory(async (request) => {
  const parsed = await parseJson(request, reorderPointSchema);
  if (!parsed.ok) return parsed.response;

  const { productId, reorderPoint, lowStockThreshold } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          stockQuantity: products.stockQuantity,
          lowStockThreshold: products.lowStockThreshold,
        })
        .from(products)
        .where(eq(products.id, productId))
        .for('update')
        .limit(1);

      if (!locked) return null;

      let product = locked;

      if (lowStockThreshold !== undefined) {
        const [updated] = await tx
          .update(products)
          .set({
            lowStockThreshold,
            stockStatus: stockStatusFrom(products.stockQuantity, lowStockThreshold),
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId))
          .returning({
            id: products.id,
            sku: products.sku,
            name: products.name,
            stockQuantity: products.stockQuantity,
            lowStockThreshold: products.lowStockThreshold,
          });

        product = updated;
      }

      let warehouseId: number | null = null;

      if (reorderPoint !== undefined) {
        warehouseId =
          parsed.data.warehouseId === undefined
            ? await resolveDefaultWarehouse(tx)
            : parsed.data.warehouseId;

        if (warehouseId !== null) {
          // Update-then-insert rather than `ON CONFLICT`, for the same reason as
          // `mirrorWarehouseStock`: `variant_id` is null on every row this app writes
          // and two nulls never conflict in Postgres, so the upsert would insert a
          // duplicate every time. Safe here because the product row is locked above.
          const scope = and(
            eq(inventory.productId, productId),
            eq(inventory.warehouseId, warehouseId),
            isNull(inventory.variantId),
          );

          const touched = await tx
            .update(inventory)
            .set({ reorderPoint, updatedAt: new Date() })
            .where(scope)
            .returning({ id: inventory.id });

          if (touched.length === 0) {
            // A product added through the admin form has no inventory row yet. Seed it
            // from the authoritative count so the new row does not claim zero on hand.
            await tx.insert(inventory).values({
              productId,
              warehouseId,
              quantityOnHand: product.stockQuantity,
              reorderPoint,
            });
          }
        }
      }

      return { product, warehouseId };
    });

    if (!result) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // `reorderPoint` was asked for but there was no single active warehouse to hang it
    // on. Reported rather than swallowed: the planner would otherwise keep using the
    // threshold and nobody would know why the number they typed had no effect.
    const unsetReorderPoint = reorderPoint !== undefined && result.warehouseId === null;

    const message = unsetReorderPoint
      ? `The reorder point needs a warehouse — pick one, since the shop has more than one active.${
          lowStockThreshold === undefined ? '' : ' The low-stock threshold was saved.'
        }`
      : `Buying line saved for ${result.product.sku}.`;

    return NextResponse.json({
      success: true,
      product: result.product,
      warehouseId: result.warehouseId,
      reorderPoint: unsetReorderPoint ? null : (reorderPoint ?? null),
      unsetReorderPoint,
      message,
    });
  } catch (error) {
    console.error('Error setting reorder point:', error);
    return NextResponse.json({ error: 'Failed to set reorder point' }, { status: 500 });
  }
});
