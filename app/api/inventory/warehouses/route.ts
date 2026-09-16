import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { warehouses } from '@/db/schema';
import { withInventory, withSuperAdmin } from '@/lib/auth/middleware';
import { queryWarehouses } from '@/lib/queries/inventory';
import { parseJson } from '@/lib/validation/parse';
import { createWarehouseSchema } from '@/lib/validation/inventory';

/**
 * The shop's warehouses, with how much each is holding.
 *
 * Inactive ones are included: the stock-level filter and the movement log both need to
 * name a warehouse that has since been closed, and a filter that cannot select a value
 * present in the data is a filter that hides rows without saying so.
 */
export const GET = withInventory(async () => {
  try {
    return NextResponse.json({ data: await queryWarehouses(true) });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
  }
});

/**
 * Open a warehouse. Owner only — it changes where every future movement can be filed.
 *
 * Worth knowing before adding a second one: `resolveDefaultWarehouse` returns null once
 * more than one is active, so sales stop being mirrored to any warehouse. That is
 * deliberate — nothing in this codebase knows which branch a web order shipped from, and
 * a guess would put units on the wrong shelf. The product-level count stays correct
 * either way.
 */
export const POST = withSuperAdmin(async (request) => {
  const parsed = await parseJson(request, createWarehouseSchema);
  if (!parsed.ok) return parsed.response;

  const { name, province, district, isActive } = parsed.data;

  try {
    // Checked in code rather than by a unique index, because the column has none and a
    // constraint would be wrong: a shop that closes "Butwal Branch" and reopens it a year
    // later needs that name back. Two *active* warehouses with one name is the actual
    // problem — the dropdown stops telling you which shelf you are filing against.
    const [clash] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          sql`lower(${warehouses.name}) = lower(${name})`,
          eq(warehouses.isActive, true),
        ),
      )
      .limit(1);

    if (clash && isActive !== false) {
      return NextResponse.json(
        { error: 'An active warehouse already uses that name' },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(warehouses)
      .values({
        name,
        province: province ?? null,
        district: district ?? null,
        isActive: isActive ?? true,
      })
      .returning();

    return NextResponse.json({ success: true, warehouse: created }, { status: 201 });
  } catch (error) {
    console.error('Error creating warehouse:', error);
    return NextResponse.json({ error: 'Failed to create warehouse' }, { status: 500 });
  }
});
