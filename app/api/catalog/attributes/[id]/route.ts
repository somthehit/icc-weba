import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { attributes } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { updateAttributeSchema } from '@/lib/validation/catalog-admin';
import { idParamSchema } from '@/lib/validation/schemas';
import {
  CATALOG_EDITORS,
  attributeValueCount,
  clearAttributeOptions,
  replaceAttributeCategories,
  replaceAttributeOptions,
} from '@/lib/catalog/registry';
import { queryAdminAttributes } from '@/lib/queries/registry';
import { isForeignKeyViolation, isUniqueViolation } from '@/lib/db/errors';

type RouteContext = { params: Promise<{ id: string }> };

async function readId(context: RouteContext) {
  const { id } = await context.params;
  const parsed = idParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

const BAD_ID = NextResponse.json(
  { error: 'Attribute id must be a positive integer' },
  { status: 400 },
);
const NOT_FOUND = () => NextResponse.json({ error: 'Attribute not found' }, { status: 404 });

export const GET = withRole<RouteContext>(
  [...CATALOG_EDITORS],
  async (_request, _auth, context) => {
    try {
      const id = await readId(context);
      if (id === null) return BAD_ID;

      const [row] = await queryAdminAttributes({ includeInactive: true }).then((rows) =>
        rows.filter((a) => a.id === id),
      );
      if (!row) return NOT_FOUND();

      return NextResponse.json(row);
    } catch (error) {
      console.error('Error fetching attribute:', error);
      return NextResponse.json({ error: 'Failed to fetch attribute' }, { status: 500 });
    }
  },
);

/**
 * Thrown inside the update transaction to roll it back.
 *
 * Returning a failure flag from the callback would *commit* — Drizzle only rolls
 * back on a throw — so the attribute would have been left as a `select` with no
 * options, which is the exact state this check exists to prevent.
 */
class SelectNeedsOptions extends Error {}

/**
 * Updates an attribute, reconciling its options and category scope.
 *
 * The `dataType`/`options` rules that the schema cannot fully check land here,
 * because they depend on the stored row:
 *
 *   * The *effective* data type is what the body sends, or the stored one if the
 *     body is silent. That is what decides whether options are allowed at all.
 *   * Switching an attribute away from `select` clears its options — a "number"
 *     attribute with a leftover option list is the contradiction the whole design
 *     is meant to avoid.
 *   * A `select` attribute must still have at least one option after the save. The
 *     schema enforces this on create; on update it can only be checked against what
 *     actually lands, since the options may be stored rather than resent.
 */
export const PUT = withRole<RouteContext>(
  [...CATALOG_EDITORS],
  async (request, _auth, context) => {
    try {
      const id = await readId(context);
      if (id === null) return BAD_ID;

      const parsed = await parseJson(request, updateAttributeSchema);
      if (!parsed.ok) return parsed.response;
      const { categoryIds, options, ...fields } = parsed.data;

      const [current] = await db
        .select({ dataType: attributes.dataType })
        .from(attributes)
        .where(eq(attributes.id, id))
        .limit(1);
      if (!current) return NOT_FOUND();

      const effectiveType = fields.dataType ?? current.dataType;

      // The schema catches this only when `dataType` is in the body; when it is
      // omitted and the stored type is non-select, the options would otherwise be
      // dropped on the floor. Refusing beats silently discarding what was sent.
      if (effectiveType !== 'select' && (options?.length ?? 0) > 0) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: [`options: Only a select attribute can have options`],
          },
          { status: 400 },
        );
      }

      await db.transaction(async (tx) => {
        if (Object.keys(fields).length > 0) {
          await tx.update(attributes).set(fields).where(eq(attributes.id, id));
        }

        if (categoryIds !== undefined) {
          await replaceAttributeCategories(tx, id, categoryIds);
        }

        if (effectiveType !== 'select') {
          // Became non-select (or already was): options are meaningless, drop them.
          await clearAttributeOptions(tx, id);
        } else if (options !== undefined) {
          const remaining = await replaceAttributeOptions(tx, id, options);
          if (remaining === 0) throw new SelectNeedsOptions();
        }
      });

      const [row] = await queryAdminAttributes({ includeInactive: true }).then((rows) =>
        rows.filter((a) => a.id === id),
      );

      return NextResponse.json({ success: true, attribute: row });
    } catch (error) {
      if (error instanceof SelectNeedsOptions) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: ['options: A select attribute needs at least one option'],
          },
          { status: 400 },
        );
      }
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
      console.error('Error updating attribute:', error);
      return NextResponse.json({ error: 'Failed to update attribute' }, { status: 500 });
    }
  },
);

/**
 * Removes an attribute, or deactivates it if products have recorded values for it.
 *
 * `product_attribute_values.attribute_id` cascades on delete, so hard-deleting an
 * attribute in use would erase every product's value for it — the RAM figure off
 * every laptop. When values exist we deactivate, which takes the facet off the
 * storefront and leaves the recorded data intact. Options and category scope, which
 * nothing outside this attribute references, cascade away with a real delete.
 */
export const DELETE = withRole<RouteContext>(['admin'], async (_request, _auth, context) => {
  try {
    const id = await readId(context);
    if (id === null) return BAD_ID;

    const [existing] = await db
      .select({ id: attributes.id })
      .from(attributes)
      .where(eq(attributes.id, id))
      .limit(1);
    if (!existing) return NOT_FOUND();

    const valueCount = await attributeValueCount(id);

    if (valueCount > 0) {
      const [deactivated] = await db
        .update(attributes)
        .set({ isActive: false })
        .where(eq(attributes.id, id))
        .returning({ id: attributes.id, isActive: attributes.isActive });

      return NextResponse.json({
        success: true,
        outcome: 'deactivated',
        valueCount,
        attribute: deactivated,
        message: `Deactivated instead of deleted: ${valueCount} product value(s) reference this attribute.`,
      });
    }

    await db.delete(attributes).where(eq(attributes.id, id));
    return NextResponse.json({ success: true, outcome: 'deleted', attribute: { id } });
  } catch (error) {
    console.error('Error deleting attribute:', error);
    return NextResponse.json({ error: 'Failed to delete attribute' }, { status: 500 });
  }
});
