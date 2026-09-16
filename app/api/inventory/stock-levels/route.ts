import { NextResponse } from 'next/server';

import { withInventory } from '@/lib/auth/middleware';
import { queryStockLevel, queryStockLevels } from '@/lib/queries/inventory';
import { parseQuery } from '@/lib/validation/parse';
import { stockLevelQuerySchema } from '@/lib/validation/inventory';
import { idParamSchema } from '@/lib/validation/schemas';

/**
 * Live stock, one row per product.
 *
 * The authoritative count is `products.stock_quantity` — the same figure checkout
 * decrements and the storefront enforces — not the `inventory` mirror. Each row also
 * carries the mirror and a `drift` flag, so a disagreement between the two is visible
 * rather than something you find out about from a customer.
 *
 * `?productId=` returns that one product for the adjustment form. It is not a filter
 * on the table, so it is read here rather than in the table's query schema.
 */
export const GET = withInventory(async (request) => {
  try {
    const { searchParams } = new URL(request.url);

    const single = searchParams.get('productId');
    if (single !== null) {
      const productId = idParamSchema.safeParse(single);
      if (!productId.success) {
        return NextResponse.json(
          { error: 'productId must be a positive integer' },
          { status: 400 },
        );
      }

      const warehouse = searchParams.get('warehouseId');
      const warehouseId = warehouse === null ? undefined : idParamSchema.safeParse(warehouse);
      if (warehouseId !== undefined && !warehouseId.success) {
        return NextResponse.json(
          { error: 'warehouseId must be a positive integer' },
          { status: 400 },
        );
      }

      const row = await queryStockLevel(
        productId.data,
        warehouseId === undefined ? undefined : warehouseId.data,
      );

      if (!row) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      return NextResponse.json({ data: [row], pagination: { total: 1, page: 1, limit: 1, pages: 1 } });
    }

    const query = parseQuery(request.url, stockLevelQuerySchema);
    if (!query.ok) return query.response;

    return NextResponse.json(await queryStockLevels(query.data));
  } catch (error) {
    console.error('Error fetching stock levels:', error);
    return NextResponse.json({ error: 'Failed to fetch stock levels' }, { status: 500 });
  }
});
