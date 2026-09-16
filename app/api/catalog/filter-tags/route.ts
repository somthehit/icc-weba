import { NextResponse } from 'next/server';
import { db } from '@/db';
import { filterTags } from '@/db/schema';
import { queryAdminFilterTags } from '@/lib/queries/registry';
import { CATALOG_EDITORS } from '@/lib/catalog/registry';
import { STAFF_ROLES, withRole } from '@/lib/auth/middleware';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import { createFilterTagSchema, registryQuerySchema } from '@/lib/validation/catalog-admin';
import { isUniqueViolation } from '@/lib/db/errors';

/**
 * Merchandising tags — "Best Seller", "Under NPR 50,000" — kept distinct from
 * attributes because they are labels the shop applies, not properties of a product.
 *
 * Staff-only; `?includeInactive=true` surfaces disabled tags so they can be
 * re-enabled. Each row carries a live `productCount` for the delete guard and badge.
 */
export const GET = withRole(STAFF_ROLES, async (request) => {
  try {
    const parsed = parseQuery(request.url, registryQuerySchema);
    if (!parsed.ok) return parsed.response;

    const rows = await queryAdminFilterTags(parsed.data.includeInactive);
    return NextResponse.json({ filterTags: rows });
  } catch (error) {
    console.error('Error fetching filter tags:', error);
    return NextResponse.json({ error: 'Failed to fetch filter tags' }, { status: 500 });
  }
});

export const POST = withRole([...CATALOG_EDITORS], async (request) => {
  try {
    const parsed = await parseJson(request, createFilterTagSchema);
    if (!parsed.ok) return parsed.response;

    const [created] = await db.insert(filterTags).values(parsed.data).returning();

    return NextResponse.json({ success: true, filterTag: created }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'A filter tag with that slug already exists' },
        { status: 409 },
      );
    }
    console.error('Error creating filter tag:', error);
    return NextResponse.json({ error: 'Failed to create filter tag' }, { status: 500 });
  }
});
