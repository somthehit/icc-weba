// lib/catalog/registry.ts
//
// Write-side helpers for the catalog reference-data registries: the checks and the
// multi-table replacements that both the collection and the item routes need.
//
// Two things here are the reason this file exists rather than the logic sitting
// inline in a route:
//
//   * `categoryWouldCycle` — Postgres accepts a cycle through
//     `categories.parent_id` without complaint, and the first thing to walk the
//     tree then recurses until it runs out of stack. The check needs stored rows,
//     so it cannot live in a Zod schema.
//   * `replaceAttributeOptions` — options are reconciled by id, not wiped and
//     re-inserted. `product_attribute_values.option_id` cascades on delete, so a
//     delete-then-insert would silently clear the chosen value off every product
//     that had picked that option, on a save that only renamed it.

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  attributeCategories,
  attributeOptions,
  categories,
  productAttributeValues,
  productFilterTags,
  products,
} from '@/db/schema';
import type { DbClient } from '@/lib/pricing/quote';
import type { AttributeOptionInput } from '@/lib/validation/catalog-admin';

/** Everyone who may edit the catalog and its reference data. */
export const CATALOG_EDITORS = ['admin', 'sales', 'inventory_manager'] as const;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);

/* ------------------------------------------------------------- delete guards */

const scalarCount = async (query: Promise<Array<{ count: number }>>): Promise<number> => {
  const [row] = await query;
  return row?.count ?? 0;
};

/** Products pointing at a category, any status — a discontinued product still references it. */
export const categoryProductCount = (categoryId: number) =>
  scalarCount(
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.categoryId, categoryId)),
  );

export const brandProductCount = (brandId: number) =>
  scalarCount(
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.brandId, brandId)),
  );

export const attributeValueCount = (attributeId: number) =>
  scalarCount(
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productAttributeValues)
      .where(eq(productAttributeValues.attributeId, attributeId)),
  );

export const filterTagProductCount = (filterTagId: number) =>
  scalarCount(
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productFilterTags)
      .where(eq(productFilterTags.filterTagId, filterTagId)),
  );

/** Child categories, so the tree view can warn before a parent is deactivated. */
export const categoryChildCount = (categoryId: number) =>
  scalarCount(
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
      .where(eq(categories.parentId, categoryId)),
  );

/* ----------------------------------------------------------------- the tree */

/**
 * Would making `parentId` the parent of `categoryId` create a cycle?
 *
 * Walks up the proposed parent's ancestor chain. If `categoryId` turns up, the
 * proposed parent is already one of its descendants and the link would close a
 * loop. Self-parenting is the depth-zero case of the same test.
 *
 * The `seen` set is not for the cycle we are trying to prevent — it is a
 * termination guard, so a cycle that somehow already exists in the data makes this
 * function return rather than loop forever.
 */
export async function categoryWouldCycle(
  categoryId: number,
  parentId: number,
): Promise<boolean> {
  let cursor: number | null = parentId;
  const seen = new Set<number>();

  while (cursor !== null) {
    if (cursor === categoryId) return true;
    if (seen.has(cursor)) return false;
    seen.add(cursor);

    const [row] = await db
      .select({ parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, cursor))
      .limit(1);
    if (!row) return false;
    cursor = row.parentId;
  }

  return false;
}

/* --------------------------------------------------- attribute scope + options */

/**
 * Replaces which categories an attribute applies to.
 *
 * Delete-then-insert is safe here, unlike for options: these rows carry no
 * meaning of their own and nothing references them.
 */
export async function replaceAttributeCategories(
  tx: DbClient,
  attributeId: number,
  categoryIds: number[],
): Promise<void> {
  await tx
    .delete(attributeCategories)
    .where(eq(attributeCategories.attributeId, attributeId));
  if (categoryIds.length === 0) return;

  // De-duplicated: the unique index on (attribute_id, category_id) would reject
  // the whole insert if the form sent the same category twice.
  const unique = [...new Set(categoryIds)];
  await tx
    .insert(attributeCategories)
    .values(unique.map((categoryId) => ({ attributeId, categoryId })));
}

/**
 * Brings an attribute's option list to exactly `options`, reconciling by id.
 *
 * An option that arrives with an `id` is updated in place, so a product that had
 * chosen it keeps its value through a rename. An option missing from the list is
 * deleted, which does cascade its product values away — but that is the admin
 * explicitly removing a choice, not a side effect of editing the label.
 *
 * Slugs are derived from the value when the caller doesn't supply one, then made
 * unique within the set: "Wi-Fi 6" and "Wi Fi 6" are different values that slugify
 * to the same string, and `attribute_options_attribute_slug_idx` would reject the
 * second one.
 *
 * Returns the resulting option count so the caller can enforce "a select attribute
 * must have at least one option" against what actually landed.
 */
export async function replaceAttributeOptions(
  tx: DbClient,
  attributeId: number,
  options: AttributeOptionInput[],
): Promise<number> {
  const existing = await tx
    .select({ id: attributeOptions.id })
    .from(attributeOptions)
    .where(eq(attributeOptions.attributeId, attributeId));

  const keep = new Set(
    options.map((o) => o.id).filter((id): id is number => id !== undefined),
  );
  const remove = existing.filter((row) => !keep.has(row.id)).map((row) => row.id);
  if (remove.length > 0) {
    await tx.delete(attributeOptions).where(inArray(attributeOptions.id, remove));
  }

  const used = new Set<string>();
  const uniqueSlug = (base: string): string => {
    const root = base || 'option';
    let candidate = root;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${root}-${n}`;
      n += 1;
    }
    used.add(candidate);
    return candidate;
  };

  for (const [index, option] of options.entries()) {
    const slug = uniqueSlug(slugify(option.slug ?? option.value));
    const displayOrder = option.displayOrder ?? index;

    if (option.id !== undefined) {
      // Scoped to the attribute as well as the id, so a caller cannot reassign
      // another attribute's option to this one by guessing its id.
      await tx
        .update(attributeOptions)
        .set({ value: option.value, slug, displayOrder })
        .where(
          and(
            eq(attributeOptions.id, option.id),
            eq(attributeOptions.attributeId, attributeId),
          ),
        );
    } else {
      await tx
        .insert(attributeOptions)
        .values({ attributeId, value: option.value, slug, displayOrder });
    }
  }

  return scalarCount(
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(attributeOptions)
      .where(eq(attributeOptions.attributeId, attributeId)),
  );
}

/** Drops every option, for an attribute that is no longer a `select`. */
export async function clearAttributeOptions(
  tx: DbClient,
  attributeId: number,
): Promise<void> {
  await tx.delete(attributeOptions).where(eq(attributeOptions.attributeId, attributeId));
}

/* ------------------------------------------------------- shared HTTP helpers */

/**
 * The registries all delete the same way, so the rule is stated once here.
 *
 * A row nothing references is removed outright — a mistyped attribute should be
 * able to actually go away, not linger as a deactivated ghost. A row products
 * depend on is deactivated instead: hard-deleting a brand would null out
 * `products.brand_id` (the FK is `set null`), and hard-deleting an attribute would
 * cascade every product's value for it. Neither is something a delete button
 * should do silently.
 */
export type DeleteOutcome = 'deleted' | 'deactivated';
