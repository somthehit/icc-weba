import { and, eq, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { inventory, warehouses } from '@/db/schema';
import { withSuperAdmin } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { updateWarehouseSchema } from '@/lib/validation/inventory';
import { idParamSchema } from '@/lib/validation/schemas';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Rename, relocate or close a warehouse. Owner only.
 *
 * There is no `DELETE`. `inventory.warehouse_id` and `inventory_movements.warehouse_id`
 * are both `ON DELETE RESTRICT`, so Postgres would refuse the moment a single row
 * referenced it — and it should: a closed branch's stock history is exactly the thing you
 * want to still be able to read. Closing is `isActive = false`, which takes it out of the
 * pickers and leaves the ledger intact.
 */
export const PUT = withSuperAdmin<RouteContext>(async (request, _auth, context) => {
  const { id } = await context.params;
  const warehouseId = idParamSchema.safeParse(id);
  if (!warehouseId.success) {
    return NextResponse.json(
      { error: 'Warehouse id must be a positive integer' },
      { status: 400 },
    );
  }

  const parsed = await parseJson(request, updateWarehouseSchema);
  if (!parsed.ok) return parsed.response;

  const { name, province, district, isActive } = parsed.data;

  try {
    if (name !== undefined) {
      const [clash] = await db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(
          and(
            sql`lower(${warehouses.name}) = lower(${name})`,
            eq(warehouses.isActive, true),
            ne(warehouses.id, warehouseId.data),
          ),
        )
        .limit(1);

      if (clash && isActive !== false) {
        return NextResponse.json(
          { error: 'An active warehouse already uses that name' },
          { status: 409 },
        );
      }
    }

    // Closing a warehouse that is still holding units. Refused rather than allowed
    // quietly: those units are counted in the shop's valuation, and a warehouse nobody
    // can select is a warehouse nobody can empty. Move or write the stock off first.
    if (isActive === false) {
      const [held] = await db
        .select({
          rows: sql<number>`count(*)::int`,
          units: sql<number>`coalesce(sum(${inventory.quantityOnHand}), 0)::int`,
        })
        .from(inventory)
        .where(eq(inventory.warehouseId, warehouseId.data));

      if (held && held.units > 0) {
        return NextResponse.json(
          {
            error: `This warehouse still holds ${held.units} unit${held.units === 1 ? '' : 's'} across ${held.rows} product${held.rows === 1 ? '' : 's'}. Move or write off the stock before closing it.`,
            unitsOnHand: held.units,
            stockRows: held.rows,
          },
          { status: 409 },
        );
      }
    }

    const [updated] = await db
      .update(warehouses)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(province !== undefined ? { province: province ?? null } : {}),
        ...(district !== undefined ? { district: district ?? null } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      })
      .where(eq(warehouses.id, warehouseId.data))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, warehouse: updated });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    return NextResponse.json({ error: 'Failed to update warehouse' }, { status: 500 });
  }
});
