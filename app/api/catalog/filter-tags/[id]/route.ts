import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { filterTags } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { updateFilterTagSchema } from '@/lib/validation/catalog-admin';
import { idParamSchema } from '@/lib/validation/schemas';
import { CATALOG_EDITORS, filterTagProductCount } from '@/lib/catalog/registry';
import { isUniqueViolation } from '@/lib/db/errors';

type RouteContext = { params: Promise<{ id: string }> };

async function readId(context: RouteContext) {
  const { id } = await context.params;
  const parsed = idParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

const BAD_ID = NextResponse.json(
  { error: 'Filter tag id must be a positive integer' },
  { status: 400 },
);
const NOT_FOUND = () => NextResponse.json({ error: 'Filter tag not found' }, { status: 404 });

export const GET = withRole<RouteContext>(
  [...CATALOG_EDITORS],
  async (_request, _auth, context) => {
    try {
      const id = await readId(context);
      if (id === null) return BAD_ID;

      const [row] = await db.select().from(filterTags).where(eq(filterTags.id, id)).limit(1);
      if (!row) return NOT_FOUND();

      const productCount = await filterTagProductCount(id);
      return NextResponse.json({ ...row, productCount });
    } catch (error) {
      console.error('Error fetching filter tag:', error);
      return NextResponse.json({ error: 'Failed to fetch filter tag' }, { status: 500 });
    }
  },
);

export const PUT = withRole<RouteContext>(
  [...CATALOG_EDITORS],
  async (request, _auth, context) => {
    try {
      const id = await readId(context);
      if (id === null) return BAD_ID;

      const parsed = await parseJson(request, updateFilterTagSchema);
      if (!parsed.ok) return parsed.response;

      const [updated] = await db
        .update(filterTags)
        .set(parsed.data)
        .where(eq(filterTags.id, id))
        .returning();

      if (!updated) return NOT_FOUND();

      return NextResponse.json({ success: true, filterTag: updated });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json(
          { error: 'A filter tag with that slug already exists' },
          { status: 409 },
        );
      }
      console.error('Error updating filter tag:', error);
      return NextResponse.json({ error: 'Failed to update filter tag' }, { status: 500 });
    }
  },
);

/**
 * Removes a filter tag, or deactivates it if products still carry it.
 *
 * `product_filter_tags.filter_tag_id` cascades on delete, so hard-deleting a tag in
 * use would strip it off every product that had it — a "Best Seller" label pulled
 * from the whole range by one delete. When products depend on it we deactivate,
 * which takes the tag off the storefront filter and leaves the assignments intact.
 */
export const DELETE = withRole<RouteContext>(['admin'], async (_request, _auth, context) => {
  try {
    const id = await readId(context);
    if (id === null) return BAD_ID;

    const [existing] = await db
      .select({ id: filterTags.id })
      .from(filterTags)
      .where(eq(filterTags.id, id))
      .limit(1);
    if (!existing) return NOT_FOUND();

    const productCount = await filterTagProductCount(id);

    if (productCount > 0) {
      const [deactivated] = await db
        .update(filterTags)
        .set({ isActive: false })
        .where(eq(filterTags.id, id))
        .returning({ id: filterTags.id, isActive: filterTags.isActive });

      return NextResponse.json({
        success: true,
        outcome: 'deactivated',
        productCount,
        filterTag: deactivated,
        message: `Deactivated instead of deleted: ${productCount} product(s) still carry this tag.`,
      });
    }

    await db.delete(filterTags).where(eq(filterTags.id, id));
    return NextResponse.json({ success: true, outcome: 'deleted', filterTag: { id } });
  } catch (error) {
    console.error('Error deleting filter tag:', error);
    return NextResponse.json({ error: 'Failed to delete filter tag' }, { status: 500 });
  }
});
