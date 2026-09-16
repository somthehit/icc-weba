import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { mapDbCategoryToCategoryItem } from '@/lib/adapters/catalog';
import { queryCategories } from '@/lib/queries/catalog';
import { queryAdminCategories } from '@/lib/queries/registry';
import { CATALOG_EDITORS } from '@/lib/catalog/registry';
import { STAFF_ROLES, withRole, type UserRole } from '@/lib/auth/middleware';
import { getUserFromRequest } from '@/lib/auth/utils';
import { parseJson } from '@/lib/validation/parse';
import { createCategorySchema } from '@/lib/validation/catalog-admin';
import { isForeignKeyViolation, isUniqueViolation } from '@/lib/db/errors';

/**
 * Storefront category taxonomy, mapped to the frontend `CategoryItem` contract.
 * `productCount` is a live count of active products, not a stored figure.
 *
 * `?view=admin` switches to the registry shape the Category Tree tab needs: real
 * numeric ids, `parentId`, `displayOrder` and `isActive`. That is a different
 * contract, not a superset — the storefront treats a category's slug as its id, so
 * an admin form built on the public payload has no key to address a row with.
 * Staff-only, and opt-in, so the public response stays byte-identical.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get('view') === 'admin') {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (!STAFF_ROLES.includes(user.role as UserRole)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      const rows = await queryAdminCategories(
        searchParams.get('includeInactive') === 'true',
      );
      return NextResponse.json({ categories: rows });
    }

    const rows = await queryCategories();
    return NextResponse.json({ categories: rows.map(mapDbCategoryToCategoryItem) });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

/**
 * Creates a category.
 *
 * No cycle check here on purpose: a row that does not exist yet cannot be anyone's
 * ancestor, so naming any existing category as its parent is always safe. The
 * check is needed on update, where a parent can be moved under its own descendant.
 */
export const POST = withRole([...CATALOG_EDITORS], async (request) => {
  try {
    const parsed = await parseJson(request, createCategorySchema);
    if (!parsed.ok) return parsed.response;

    const [created] = await db.insert(categories).values(parsed.data).returning();

    return NextResponse.json({ success: true, category: created }, { status: 201 });
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
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
});
