import { NextResponse } from 'next/server';
import { db } from '@/db';
import { attributes } from '@/db/schema';
import { queryAdminAttributes } from '@/lib/queries/registry';
import {
  CATALOG_EDITORS,
  replaceAttributeCategories,
  replaceAttributeOptions,
} from '@/lib/catalog/registry';
import { STAFF_ROLES, withRole } from '@/lib/auth/middleware';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import { createAttributeSchema, registryQuerySchema } from '@/lib/validation/catalog-admin';
import { isForeignKeyViolation, isUniqueViolation } from '@/lib/db/errors';

/**
 * The attribute vocabulary that drives faceted filtering — each spec defined once,
 * with a data type, unit, its option list and the categories it applies to.
 *
 * Staff-only in full. `?categoryId=` narrows to what a given category's filter
 * sidebar should offer: the attributes scoped to it plus the unscoped ones, which
 * apply everywhere. `?includeInactive=true` shows disabled rows so they can be
 * re-enabled.
 */
export const GET = withRole(STAFF_ROLES, async (request) => {
  try {
    const parsed = parseQuery(request.url, registryQuerySchema);
    if (!parsed.ok) return parsed.response;

    const rows = await queryAdminAttributes({
      includeInactive: parsed.data.includeInactive,
      categoryId: parsed.data.categoryId,
    });
    return NextResponse.json({ attributes: rows });
  } catch (error) {
    console.error('Error fetching attributes:', error);
    return NextResponse.json({ error: 'Failed to fetch attributes' }, { status: 500 });
  }
});

/**
 * Defines an attribute, with its options and category scope in one request.
 *
 * All three land together or none do: an attribute row whose options failed to
 * insert is a `select` with nothing to select, which the storefront would render
 * as an empty facet rather than as the error it is.
 */
export const POST = withRole([...CATALOG_EDITORS], async (request) => {
  try {
    const parsed = await parseJson(request, createAttributeSchema);
    if (!parsed.ok) return parsed.response;
    const { categoryIds, options, ...fields } = parsed.data;

    const created = await db.transaction(async (tx) => {
      const [attribute] = await tx.insert(attributes).values(fields).returning();

      if (categoryIds?.length) {
        await replaceAttributeCategories(tx, attribute.id, categoryIds);
      }
      if (options?.length) {
        await replaceAttributeOptions(tx, attribute.id, options);
      }

      return attribute;
    });

    // Re-read through the registry query so the caller gets the attribute with its
    // options and scope attached, ids and all, instead of the bare inserted row.
    const [row] = await queryAdminAttributes({ includeInactive: true }).then((rows) =>
      rows.filter((a) => a.id === created.id),
    );

    return NextResponse.json({ success: true, attribute: row ?? created }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'An attribute with that slug already exists' },
        { status: 409 },
      );
    }
    if (isForeignKeyViolation(error)) {
      return NextResponse.json(
        { error: 'One of those categories does not exist' },
        { status: 400 },
      );
    }
    console.error('Error creating attribute:', error);
    return NextResponse.json({ error: 'Failed to create attribute' }, { status: 500 });
  }
});
