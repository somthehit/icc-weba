// lib/queries/registry.ts
//
// Admin-side reads for the four catalog reference-data registries. These differ
// from the storefront reads in lib/queries/catalog.ts in two ways that matter:
//
//   1. They return every column the edit form needs — including `isActive`,
//      `parentId`, `isFeatured` and the option/category-scope lists — not the
//      trimmed storefront contract.
//   2. They can return deactivated rows, because staff editing the registry need
//      to see a disabled category to re-enable it. The storefront never asks.
//
// Each row also carries a live reference count (`productCount` / `valueCount`),
// computed by the query rather than stored, so the delete guard and the UI badge
// read the same number and it can never drift from the catalogue.

import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import {
  attributeCategories,
  attributeOptions,
  attributes,
  brands,
  categories,
  filterTags,
  productAttributeValues,
  productFilterTags,
  products,
} from '@/db/schema';

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  iconName: string | null;
  imageUrl: string | null;
  subcategories: string[];
  parentId: number | null;
  displayOrder: number;
  isActive: boolean;
  /** Products referencing this category, any status — the delete guard's number. */
  productCount: number;
}

export interface AdminBrand {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  isPartner: boolean;
  isFeatured: boolean;
  categorySlugs: string[];
  isActive: boolean;
  productCount: number;
}

export interface AdminAttributeOption {
  id: number;
  value: string;
  slug: string;
  displayOrder: number;
}

export interface AdminAttribute {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  dataType: 'text' | 'number' | 'boolean' | 'select';
  unit: string | null;
  isFilterable: boolean;
  displayOrder: number;
  isActive: boolean;
  /** Empty means "applies to every category". */
  categoryIds: number[];
  options: AdminAttributeOption[];
  /** Product values recorded against this attribute — the delete guard's number. */
  valueCount: number;
}

export interface AdminFilterTag {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  displayOrder: number;
  isActive: boolean;
  /** Products carrying this tag. */
  productCount: number;
}

/* ------------------------------------------------------------- categories */

export async function queryAdminCategories(
  includeInactive = false,
): Promise<AdminCategory[]> {
  const where = includeInactive ? undefined : eq(categories.isActive, true);
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      iconName: categories.iconName,
      imageUrl: categories.imageUrl,
      subcategories: categories.subcategories,
      parentId: categories.parentId,
      displayOrder: categories.displayOrder,
      isActive: categories.isActive,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(where)
    .groupBy(categories.id)
    .orderBy(asc(categories.displayOrder), asc(categories.name));

  return rows.map((r) => ({ ...r, subcategories: r.subcategories ?? [] }));
}

/* ----------------------------------------------------------------- brands */

export async function queryAdminBrands(includeInactive = false): Promise<AdminBrand[]> {
  const where = includeInactive ? undefined : eq(brands.isActive, true);
  const rows = await db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      logoUrl: brands.logoUrl,
      description: brands.description,
      isPartner: brands.isPartner,
      isFeatured: brands.isFeatured,
      categorySlugs: brands.categorySlugs,
      isActive: brands.isActive,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(brands)
    .leftJoin(products, eq(products.brandId, brands.id))
    .where(where)
    .groupBy(brands.id)
    .orderBy(desc(brands.isFeatured), asc(brands.name));

  return rows.map((r) => ({ ...r, categorySlugs: r.categorySlugs ?? [] }));
}

/* ------------------------------------------------------------- attributes */

/**
 * Attributes with their options and category scope stitched in.
 *
 * Three queries rather than one join: an attribute fans out to many options and
 * many category rows at once, so a single join would multiply them together and
 * the counts would be wrong. Same shape as `attachRelations` in the catalog
 * queries.
 */
export async function queryAdminAttributes(
  opts: { includeInactive?: boolean; categoryId?: number } = {},
): Promise<AdminAttribute[]> {
  const conditions: SQL[] = [];
  if (!opts.includeInactive) conditions.push(eq(attributes.isActive, true));

  const base = await db
    .select({
      id: attributes.id,
      name: attributes.name,
      slug: attributes.slug,
      description: attributes.description,
      dataType: attributes.dataType,
      unit: attributes.unit,
      isFilterable: attributes.isFilterable,
      displayOrder: attributes.displayOrder,
      isActive: attributes.isActive,
      valueCount: sql<number>`count(${productAttributeValues.id})::int`,
    })
    .from(attributes)
    .leftJoin(
      productAttributeValues,
      eq(productAttributeValues.attributeId, attributes.id),
    )
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(attributes.id)
    .orderBy(asc(attributes.displayOrder), asc(attributes.name));

  if (base.length === 0) return [];
  const ids = base.map((a) => a.id);

  const optionRows = await db
    .select({
      attributeId: attributeOptions.attributeId,
      id: attributeOptions.id,
      value: attributeOptions.value,
      slug: attributeOptions.slug,
      displayOrder: attributeOptions.displayOrder,
    })
    .from(attributeOptions)
    .where(inArray(attributeOptions.attributeId, ids))
    .orderBy(asc(attributeOptions.displayOrder), asc(attributeOptions.id));

  const scopeRows = await db
    .select({
      attributeId: attributeCategories.attributeId,
      categoryId: attributeCategories.categoryId,
    })
    .from(attributeCategories)
    .where(inArray(attributeCategories.attributeId, ids));

  const optionsByAttr = new Map<number, AdminAttributeOption[]>();
  for (const o of optionRows) {
    const entry = { id: o.id, value: o.value, slug: o.slug, displayOrder: o.displayOrder };
    const bucket = optionsByAttr.get(o.attributeId);
    if (bucket) bucket.push(entry);
    else optionsByAttr.set(o.attributeId, [entry]);
  }

  const scopeByAttr = new Map<number, number[]>();
  for (const s of scopeRows) {
    const bucket = scopeByAttr.get(s.attributeId);
    if (bucket) bucket.push(s.categoryId);
    else scopeByAttr.set(s.attributeId, [s.categoryId]);
  }

  let result = base.map((a) => ({
    ...a,
    categoryIds: scopeByAttr.get(a.id) ?? [],
    options: optionsByAttr.get(a.id) ?? [],
  }));

  // Category filter is applied after stitching: an attribute with *no* scope rows
  // applies everywhere, so "which attributes does the Laptops sidebar offer?"
  // includes both the ones scoped to Laptops and the unscoped ones.
  if (opts.categoryId !== undefined) {
    const target = opts.categoryId;
    result = result.filter(
      (a) => a.categoryIds.length === 0 || a.categoryIds.includes(target),
    );
  }

  return result;
}

/* ------------------------------------------------------------ filter tags */

export async function queryAdminFilterTags(
  includeInactive = false,
): Promise<AdminFilterTag[]> {
  const where = includeInactive ? undefined : eq(filterTags.isActive, true);
  return db
    .select({
      id: filterTags.id,
      name: filterTags.name,
      slug: filterTags.slug,
      description: filterTags.description,
      color: filterTags.color,
      displayOrder: filterTags.displayOrder,
      isActive: filterTags.isActive,
      productCount: sql<number>`count(${productFilterTags.id})::int`,
    })
    .from(filterTags)
    .leftJoin(productFilterTags, eq(productFilterTags.filterTagId, filterTags.id))
    .where(where)
    .groupBy(filterTags.id)
    .orderBy(asc(filterTags.displayOrder), asc(filterTags.name));
}
