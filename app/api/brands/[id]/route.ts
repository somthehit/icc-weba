import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { brands } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { updateBrandSchema } from '@/lib/validation/catalog-admin';
import { idParamSchema } from '@/lib/validation/schemas';
import { CATALOG_EDITORS, brandProductCount } from '@/lib/catalog/registry';
import { isUniqueViolation } from '@/lib/db/errors';

type RouteContext = { params: Promise<{ id: string }> };

async function readId(context: RouteContext) {
  const { id } = await context.params;
  const parsed = idParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

const BAD_ID = NextResponse.json(
  { error: 'Brand id must be a positive integer' },
  { status: 400 },
);
const NOT_FOUND = () => NextResponse.json({ error: 'Brand not found' }, { status: 404 });

export const GET = withRole<RouteContext>(
  [...CATALOG_EDITORS],
  async (_request, _auth, context) => {
    try {
      const id = await readId(context);
      if (id === null) return BAD_ID;

      const [row] = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
      if (!row) return NOT_FOUND();

      const productCount = await brandProductCount(id);
      return NextResponse.json({ ...row, productCount });
    } catch (error) {
      console.error('Error fetching brand:', error);
      return NextResponse.json({ error: 'Failed to fetch brand' }, { status: 500 });
    }
  },
);

export const PUT = withRole<RouteContext>(
  [...CATALOG_EDITORS],
  async (request, _auth, context) => {
    try {
      const id = await readId(context);
      if (id === null) return BAD_ID;

      const parsed = await parseJson(request, updateBrandSchema);
      if (!parsed.ok) return parsed.response;

      const [updated] = await db
        .update(brands)
        .set(parsed.data)
        .where(eq(brands.id, id))
        .returning();

      if (!updated) return NOT_FOUND();

      return NextResponse.json({ success: true, brand: updated });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json(
          { error: 'A brand with that slug already exists' },
          { status: 409 },
        );
      }
      console.error('Error updating brand:', error);
      return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 });
    }
  },
);

/**
 * Removes a brand, or deactivates it if products still carry it.
 *
 * `products.brand_id` is `ON DELETE SET NULL`: hard-deleting a brand in use would
 * strip the brand off every product that had it, so a "Lenovo" typo fix that
 * deleted and recreated the brand would orphan the whole Lenovo range. When
 * products depend on it we deactivate instead, and the response says so.
 */
export const DELETE = withRole<RouteContext>(['admin'], async (_request, _auth, context) => {
  try {
    const id = await readId(context);
    if (id === null) return BAD_ID;

    const [existing] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.id, id))
      .limit(1);
    if (!existing) return NOT_FOUND();

    const productCount = await brandProductCount(id);

    if (productCount > 0) {
      const [deactivated] = await db
        .update(brands)
        .set({ isActive: false })
        .where(eq(brands.id, id))
        .returning({ id: brands.id, isActive: brands.isActive });

      return NextResponse.json({
        success: true,
        outcome: 'deactivated',
        productCount,
        brand: deactivated,
        message: `Deactivated instead of deleted: ${productCount} product(s) still carry this brand.`,
      });
    }

    await db.delete(brands).where(eq(brands.id, id));
    return NextResponse.json({ success: true, outcome: 'deleted', brand: { id } });
  } catch (error) {
    console.error('Error deleting brand:', error);
    return NextResponse.json({ error: 'Failed to delete brand' }, { status: 500 });
  }
});
