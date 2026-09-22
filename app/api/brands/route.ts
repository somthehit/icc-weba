import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { brands } from '@/db/schema';
import { mapDbBrandToBrand } from '@/lib/adapters/catalog';
import { queryBrands } from '@/lib/queries/catalog';
import { queryAdminBrands } from '@/lib/queries/registry';
import { CATALOG_EDITORS } from '@/lib/catalog/registry';
import { STAFF_ROLES, withRole, type UserRole } from '@/lib/auth/middleware';
import { getUserFromRequest } from '@/lib/auth/utils';
import { parseJson } from '@/lib/validation/parse';
import { createBrandSchema } from '@/lib/validation/catalog-admin';
import { isUniqueViolation } from '@/lib/db/errors';
import { INITIAL_BRANDS } from '@/lib/data/initial-data';

/**
 * Brand list, mapped to the frontend `Brand` contract. Returns every active brand
 * (so the shop's brand filter can offer them all); pass ?partners=true for just
 * the curated brands merchandised on the Brands page.
 *
 * `?view=admin` returns the registry shape instead: numeric ids, `isFeatured`,
 * `isActive` and a live product count. Staff-only. The public payload publishes the
 * slug as each brand's id, so it has no key the edit form can address a row with,
 * and it drops `isFeatured` entirely.
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

      const rows = await queryAdminBrands(searchParams.get('includeInactive') === 'true');
      return NextResponse.json({ brands: rows });
    }

    const partnersOnly = searchParams.get('partners') === 'true';
    const rows = await queryBrands({ partnersOnly });
    if (rows && rows.length > 0) {
      return NextResponse.json({ brands: rows.map(mapDbBrandToBrand) });
    }
    return NextResponse.json({
      brands: partnersOnly ? INITIAL_BRANDS.filter((b) => b.isPartner) : INITIAL_BRANDS,
    });
  } catch (error) {
    console.error('Error fetching brands, serving fallback initial data:', error);
    const partnersOnly = new URL(request.url).searchParams.get('partners') === 'true';
    return NextResponse.json({
      brands: partnersOnly ? INITIAL_BRANDS.filter((b) => b.isPartner) : INITIAL_BRANDS,
      fallback: true,
    });
  }
}

export const POST = withRole([...CATALOG_EDITORS], async (request) => {
  try {
    const parsed = await parseJson(request, createBrandSchema);
    if (!parsed.ok) return parsed.response;

    const [created] = await db.insert(brands).values(parsed.data).returning();

    return NextResponse.json({ success: true, brand: created }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'A brand with that slug already exists' },
        { status: 409 },
      );
    }
    console.error('Error creating brand:', error);
    return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 });
  }
});
