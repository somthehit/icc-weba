import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { inventory, warehouses, products } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { withRole } from '@/lib/auth/middleware';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import {
  createInventorySchema,
  inventoryQuerySchema,
  updateInventorySchema,
} from '@/lib/validation/commerce';
import { isForeignKeyViolation, isUniqueViolation } from '@/lib/db/errors';

const inventoryColumns = {
  id: inventory.id,
  productId: inventory.productId,
  warehouseId: inventory.warehouseId,
  quantityOnHand: inventory.quantityOnHand,
  quantityReserved: inventory.quantityReserved,
  lowStockThreshold: inventory.lowStockThreshold,
  reorderPoint: inventory.reorderPoint,
  warehouseName: warehouses.name,
  productName: products.name,
} as const;

export async function GET(request: NextRequest) {
  try {
    const query = parseQuery(request.url, inventoryQuerySchema);
    if (!query.ok) return query.response;
    const { productId, warehouseId } = query.data;

    const conditions = [
      productId !== undefined ? eq(inventory.productId, productId) : undefined,
      warehouseId !== undefined ? eq(inventory.warehouseId, warehouseId) : undefined,
    ].filter(Boolean);

    const results = await db
      .select(inventoryColumns)
      .from(inventory)
      .leftJoin(warehouses, eq(inventory.warehouseId, warehouses.id))
      .leftJoin(products, eq(inventory.productId, products.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({ inventory: results });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 },
    );
  }
}

export const POST = withRole(['admin', 'inventory_manager'], async (request: NextRequest) => {
  try {
    const parsed = await parseJson(request, createInventorySchema);
    if (!parsed.ok) return parsed.response;

    const [item] = await db.insert(inventory).values(parsed.data).returning();

    return NextResponse.json({ success: true, inventory: item }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'That product already has a stock record in this warehouse' },
        { status: 409 },
      );
    }
    if (isForeignKeyViolation(error)) {
      return NextResponse.json(
        { error: 'productId or warehouseId does not exist' },
        { status: 400 },
      );
    }
    console.error('Error creating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to create inventory' },
      { status: 500 },
    );
  }
});

export const PUT = withRole(['admin', 'inventory_manager'], async (request: NextRequest) => {
  try {
    const parsed = await parseJson(request, updateInventorySchema);
    if (!parsed.ok) return parsed.response;
    const { id, ...updateData } = parsed.data;

    const [updated] = await db
      .update(inventory)
      .set(updateData)
      .where(eq(inventory.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, inventory: updated });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory' },
      { status: 500 },
    );
  }
});
