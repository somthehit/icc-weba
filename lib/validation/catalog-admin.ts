// lib/validation/catalog-admin.ts
//
// Request shapes for the four catalog reference-data registries: categories,
// brands, attributes (with their options and category scoping) and filter tags.
//
// Like the other schemas here, each doubles as an allowlist — a field it does not
// name is dropped before the object reaches Drizzle. That is what stops a caller
// posting `{ id: 1 }` at a category or inventing a `productCount` on a brand.
//
// Two rules that matter here are business rules rather than shape checks:
//
//   1. Only `select` attributes may carry options. Enforced below on create. A
//      "number" attribute with an option list is a contradiction — nothing would
//      ever read those options, so accepting them stores data that can never be
//      chosen.
//   2. A category may not be its own parent, nor a descendant of itself. Postgres
//      accepts a cycle through a self-referencing FK quite happily, and the first
//      thing to walk the tree then recurses until it runs out of stack. That check
//      needs the stored rows, so it lives in `lib/catalog/tree.ts` and is called by
//      the route — a request body cannot be inspected for it.

import { z } from 'zod';
import { idParamSchema } from './schemas';

/** Matches `attributeDataTypeEnum` in db/schema/enums.ts. */
export const ATTRIBUTE_DATA_TYPES = ['text', 'number', 'boolean', 'select'] as const;
export type AttributeDataType = (typeof ATTRIBUTE_DATA_TYPES)[number];

/**
 * Badge tones a filter tag may use.
 *
 * A closed list rather than a free-text colour: the tag renders as a Tailwind class
 * pair, so an arbitrary string would either be dropped by the compiler's content
 * scan or, worse, interpolated into a class attribute. Named tones keep the styling
 * decision in the design system instead of in the database.
 */
export const FILTER_TAG_COLORS = [
  'blue',
  'emerald',
  'amber',
  'rose',
  'violet',
  'slate',
] as const;
export type FilterTagColor = (typeof FILTER_TAG_COLORS)[number];

/**
 * A URL-safe slug.
 *
 * Lowercase, digits and single hyphens. The storefront resolves categories, brands
 * and facets on these, so a slug with a space or a slash in it produces a URL that
 * 404s — better to refuse it at the edge than to write it and find out later.
 */
const slug = z
  .string()
  .trim()
  .min(1, 'Slug is required')
  .max(140, 'Slug is too long')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and single hyphens, e.g. gaming-laptops',
  );

const name = z.string().trim().min(1, 'Name is required').max(120, 'Name is too long');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    // An empty textarea posts "", which should clear the column rather than store a
    // blank string that renders as a stray empty line on the storefront.
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const displayOrder = z.coerce.number().int().min(0).max(9999).default(0);

/* ---------------------------------------------------------------- categories */

const categoryFields = {
  name,
  slug,
  description: optionalText(1000),
  iconName: z.string().trim().max(60).nullable().optional(),
  imageUrl: z.string().trim().url('Enter a valid URL').max(500).nullable().optional(),
  // Free-text drilldown labels the storefront renders. Display-only, which is why
  // they stay a jsonb array rather than becoming child category rows.
  subcategories: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  parentId: idParamSchema.nullable().optional(),
  displayOrder,
  isActive: z.boolean().default(true),
};

export const createCategorySchema = z.object(categoryFields);

/**
 * Every field optional, but at least one present.
 *
 * `.partial()` alone would accept `{}` and issue an UPDATE that sets nothing, which
 * answers 200 while doing nothing — indistinguishable to the caller from a change
 * that was applied.
 */
export const updateCategorySchema = z
  .object(categoryFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

/* -------------------------------------------------------------------- brands */

const brandFields = {
  name,
  slug,
  description: optionalText(1000),
  logoUrl: z.string().trim().url('Enter a valid URL').max(500).nullable().optional(),
  // Two independent flags. `isPartner` asserts an authorized dealership — a
  // commercial fact. `isFeatured` is a merchandising choice about the homepage
  // strip. See the note on db/schema/catalog.ts.
  isPartner: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  categorySlugs: z.array(slug).max(40).optional(),
  isActive: z.boolean().default(true),
};

export const createBrandSchema = z.object(brandFields);

export const updateBrandSchema = z
  .object(brandFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

/* ---------------------------------------------------------------- attributes */

const attributeOptionInput = z.object({
  // Present when editing an existing option, absent when adding a new one. Carrying
  // the id lets a rename keep the row — and therefore keep every product pointing
  // at it — instead of deleting and re-inserting, which would silently clear the
  // value off every product that had chosen it.
  id: idParamSchema.optional(),
  value: z.string().trim().min(1, 'Option value is required').max(120),
  slug: slug.optional(),
  displayOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

const attributeFields = {
  name,
  slug,
  description: optionalText(300),
  dataType: z.enum(ATTRIBUTE_DATA_TYPES).default('text'),
  unit: z.string().trim().max(20).nullable().optional(),
  isFilterable: z.boolean().default(true),
  displayOrder,
  isActive: z.boolean().default(true),
  /** Empty or absent means "applies to every category". */
  categoryIds: z.array(idParamSchema).max(100).optional(),
  options: z.array(attributeOptionInput).max(100).optional(),
};

type OptionShape = { value: string };

/**
 * Duplicate option values within one attribute would render as two identical facet
 * checkboxes filtering to different product sets. Compared case-insensitively —
 * "SSD" and "ssd" are the same choice to a shopper.
 */
const optionsAreUnique = (options: OptionShape[] | undefined) => {
  const values = (options ?? []).map((o) => o.value.trim().toLowerCase());
  return new Set(values).size === values.length;
};

const UNIQUE_OPTIONS = {
  message: 'Option values must be unique within an attribute',
  path: ['options'],
};

export const createAttributeSchema = z
  .object(attributeFields)
  .refine((data) => data.dataType !== 'select' || (data.options?.length ?? 0) > 0, {
    message: 'A select attribute needs at least one option, or nothing can be chosen',
    path: ['options'],
  })
  .refine((data) => data.dataType === 'select' || (data.options?.length ?? 0) === 0, {
    message: 'Only a select attribute can have options',
    path: ['options'],
  })
  .refine((data) => optionsAreUnique(data.options), UNIQUE_OPTIONS);

/**
 * Update is deliberately looser than create about the `dataType`/`options` pair,
 * because a PATCH sees only what changed.
 *
 * Omitting `options` means "leave the option list alone" — renaming a select
 * attribute must not require resending its options, and an earlier draft of this
 * schema rejected exactly that. So the "select needs options" rule can only be
 * checked against the stored row, which lives in the route. What is checkable here:
 * a caller must not send a non-select `dataType` together with a non-empty option
 * list, and whatever list they do send must have no duplicates.
 */
export const updateAttributeSchema = z
  .object(attributeFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  })
  .refine(
    (data) =>
      data.dataType === undefined ||
      data.dataType === 'select' ||
      (data.options?.length ?? 0) === 0,
    { message: 'Only a select attribute can have options', path: ['options'] },
  )
  .refine((data) => optionsAreUnique(data.options), UNIQUE_OPTIONS);

/* -------------------------------------------------------------- filter tags */

const filterTagFields = {
  name: z.string().trim().min(1, 'Name is required').max(80),
  slug: slug.max(100),
  description: optionalText(300),
  color: z.enum(FILTER_TAG_COLORS).default('blue'),
  displayOrder,
  isActive: z.boolean().default(true),
};

export const createFilterTagSchema = z.object(filterTagFields);

export const updateFilterTagSchema = z
  .object(filterTagFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

/* ------------------------------------------- per-product values and tagging */

/**
 * One product's value for one attribute.
 *
 * Exactly one of `optionId` / `valueText` — the same rule the
 * `product_attribute_values_one_value` CHECK enforces in the database. Refused here
 * as well so the caller gets a field-level message instead of a 500 from a
 * constraint violation.
 */
export const productAttributeValueInput = z
  .object({
    attributeId: idParamSchema,
    optionId: idParamSchema.nullable().optional(),
    valueText: z.string().trim().max(200).nullable().optional(),
  })
  .refine(
    (data) =>
      (data.optionId != null && (data.valueText == null || data.valueText === '')) ||
      (data.optionId == null && data.valueText != null && data.valueText !== ''),
    {
      message: 'Provide either an option or a text value, not both and not neither',
      path: ['valueText'],
    },
  );

/** Replaces a product's whole attribute value set; an empty array clears it. */
export const setProductAttributeValuesSchema = z.object({
  values: z.array(productAttributeValueInput).max(200),
});

/** Replaces a product's whole tag set; an empty array clears it. */
export const setProductFilterTagsSchema = z.object({
  filterTagIds: z.array(idParamSchema).max(100),
});

/* ------------------------------------------------------------------ queries */

export const registryQuerySchema = z.object({
  // Staff editing the registry need to see deactivated rows to reactivate them;
  // the storefront never asks for them.
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  categoryId: idParamSchema.optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;
export type UpdateAttributeInput = z.infer<typeof updateAttributeSchema>;
export type CreateFilterTagInput = z.infer<typeof createFilterTagSchema>;
export type UpdateFilterTagInput = z.infer<typeof updateFilterTagSchema>;
export type AttributeOptionInput = z.infer<typeof attributeOptionInput>;
