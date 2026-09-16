import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { updateCategorySchema } from '@/lib/validation/catalog-admin';
import { idParamSchema } from '@/lib/validation/schemas';
import {
  CATALOG_EDITORS,
  categoryChildCount,
  categoryProductCount,
  categoryWouldCycle,
} from '@/lib/catalog/registry';
import { isForeignKeyViolation, isUniqueViolation } from '@/lib/db/errors';

type RouteContext = { params: Promise<{ id: string }> };

async function readId(context: RouteContext) {
  const { id } = await context.params;
  const parsed = idParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

const BAD_ID = NextResponse.json(
  { error: 'Category id must be a positive integer' },
  { status: 400 },
);
const NOT_FOUND = () => NextResponse.json({ error: 'Category not found' }, { status: 404 });

/** One category with its live reference counts, for the edit form. */
export const GET = withRole<RouteContext>(
  [...CATALOG_EDITORS],
  async (_request, _auth, context) => {
    try {
      const id = await readId(context);
      if (id === null) return BAD_ID;

      const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
      if (!row) return NOT_FOUND();

      const [productCount, childCount] = await Promise.all([
        categoryProductCount(id),
        categoryChildCount(id),
      ]);

      return NextResponse.json({ ...row, productCount, childCount });
    } catch (error) {
      console.error('Error fetching category:', error);
      return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 });
    }
  },
);

export const PUT = withRole<RouteContext>(
  [...CATALOG_EDITORS],
  async (request, _auth, context) => {
    try {
      const id = await readId(context);
      if (id === null) return BAD_ID;

      const parsed = await parseJson(request, updateCategorySchema);
      if (!parsed.ok) return parsed.response;

      // Both halves of the cycle rule. Self-parenting is caught first because it
      // reads better as its own message than as "would create a loop".
      if (parsed.data.parentId != null) {
        if (parsed.data.parentId === id) {
          return NextResponse.json(
            { error: 'A category cannot be its own parent' },
            { status: 400 },
          );
        }
        if (await categoryWouldCycle(id, parsed.data.parentId)) {
          return NextResponse.json(
            {
              error:
                'That parent is already a descendant of this category, which would create a loop',
            },
            { status: 400 },
          );
        }
      }

      const [updated] = await db
        .update(categories)
        .set(parsed.data)
        .where(eq(categories.id, id))
        .returning();

      if (!updated) return NOT_FOUND();

      return NextResponse.json({ success: true, category: updated });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json(
          { error: 'A category with that slug already exists' },
          { status: 409 },
        );
      }
      if (isForeignKeyViolation(error)) {
        return NextResponse.json(
          { error: 'The parent category does not exist' },
          { status: 400 },
        );
      }
      console.error('Error updating category:', error);
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
    }
  },
);

/**
 * Removes a category, or deactivates it if anything still depends on it.
 *
 * `products.category_id` is `ON DELETE SET NULL`, so hard-deleting a category in
 * use would quietly leave those products uncategorised — they would vanish from
 * every category page while still appearing in search, which looks like data loss
 * because it is. Deactivating keeps the link intact and takes it off the
 * storefront, and the response says which of the two happened rather than
 * reporting "deleted" either way.
 *
 * Child categories block for the same reason: their `parent_id` would be nulled
 * and a whole subtree would silently surface at the top level.
 */
export const DELETE = withRole<RouteContext>(['admin'], async (_request, _auth, context) => {
  try {
    const id = await readId(context);
    if (id === null) return BAD_ID;

    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    if (!existing) return NOT_FOUND();

    const [productCount, childCount] = await Promise.all([
      categoryProductCount(id),
      categoryChildCount(id),
    ]);

    if (productCount > 0 || childCount > 0) {
      const [deactivated] = await db
        .update(categories)
        .set({ isActive: false })
        .where(eq(categories.id, id))
        .returning({ id: categories.id, isActive: categories.isActive });

      return NextResponse.json({
        success: true,
        outcome: 'deactivated',
        productCount,
        childCount,
        category: deactivated,
        message:
          productCount > 0
            ? `Deactivated instead of deleted: ${productCount} product(s) are still in this category.`
            : `Deactivated instead of deleted: it still has ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'}.`,
      });
    }

    await db.delete(categories).where(eq(categories.id, id));
    return NextResponse.json({ success: true, outcome: 'deleted', category: { id } });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
});
