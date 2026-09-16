// db/schema/attributes.ts
//
// Catalog reference data: the attribute vocabulary and the merchandising tags.
//
// These are the registries the rest of the catalog leans on. A product cannot carry
// a real, filterable spec until the spec exists as a definition — which is the gap
// that made faceted filtering impossible. `product_specs` (in ./catalog) lets any
// product invent its own key, so "Processor", "processor", "CPU" and "Proccesor" all
// coexist and nothing can be grouped by.
//
//   attributes                a spec defined once, with a data type and unit
//   attributeOptions          the allowed values, for select-type attributes only
//   attributeCategories       which categories an attribute applies to
//   productAttributeValues    a specific product's value for a specific attribute
//   filterTags                cross-category merchandising labels
//   productFilterTags         which products carry which label
//
// `productSpecs` is intentionally still here and unchanged: it is the prose spec
// sheet the PDP renders. This file is the structured data behind filtering. The two
// answer different questions and both are legitimate.
//
// Filter tags are separate from attributes by design. "16GB RAM" is a fact about the
// hardware; "Student Pick" is a decision someone makes on a Tuesday and reverses on
// Friday. Same-shaped admin UI, different data, different lifecycle.
//
// See drizzle/migrations/0007_catalog_reference_data.sql for the DDL these mirror.

import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { attributeDataTypeEnum } from './enums';
import { categories, products } from './catalog';

export const attributes = pgTable(
  'attributes',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 140 }).notNull(),
    description: varchar('description', { length: 300 }),
    dataType: attributeDataTypeEnum('data_type').notNull().default('text'),
    // e.g. "GB", "GHz", "MP", "inch". Kept out of the value so "16" GB and "16"
    // inches are not the same string, and a numeric filter can compare them.
    unit: varchar('unit', { length: 20 }),
    // Not every spec is worth browsing by — "Box Contents" is one nobody filters on.
    isFilterable: boolean('is_filterable').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('attributes_slug_idx').on(t.slug),
  }),
);

export const attributeOptions = pgTable(
  'attribute_options',
  {
    id: serial('id').primaryKey(),
    attributeId: integer('attribute_id')
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    value: varchar('value', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 140 }).notNull(),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (t) => ({
    // Unique per attribute rather than globally: "Black" is a legitimate option for
    // both Chassis Colour and Keyboard Colour.
    attributeSlugIdx: uniqueIndex('attribute_options_attribute_slug_idx').on(
      t.attributeId,
      t.slug,
    ),
    attributeIdx: index('attribute_options_attribute_idx').on(t.attributeId),
  }),
);

/**
 * Which categories an attribute applies to.
 *
 * A join table rather than the jsonb-array-of-slugs shape `brands.categorySlugs`
 * uses, because this is queried in the other direction — "which attributes should
 * the Laptops filter sidebar offer?" — and a jsonb containment scan cannot use an
 * index the way this can.
 *
 * No rows for an attribute means it applies everywhere, which is the right default
 * for something like "Warranty Type".
 */
export const attributeCategories = pgTable(
  'attribute_categories',
  {
    id: serial('id').primaryKey(),
    attributeId: integer('attribute_id')
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pairIdx: uniqueIndex('attribute_categories_pair_idx').on(t.attributeId, t.categoryId),
    categoryIdx: index('attribute_categories_category_idx').on(t.categoryId),
  }),
);

/**
 * A product's value for an attribute.
 *
 * Two value columns, and exactly one is populated — the DB enforces it with a CHECK
 * constraint (`option_id IS NULL <> value_text IS NULL`). A select-type value is a
 * foreign key into `attributeOptions`, so renaming "SSD" to "Solid State" updates
 * every product at once and a typo cannot create a phantom facet. Text, number and
 * boolean values are free-form and live in `valueText`.
 *
 * Unique on (product, attribute): a laptop has one RAM figure, and a second row
 * would make the facet count that laptop twice.
 */
export const productAttributeValues = pgTable(
  'product_attribute_values',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attributeId: integer('attribute_id')
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    optionId: integer('option_id').references(() => attributeOptions.id, {
      onDelete: 'cascade',
    }),
    valueText: varchar('value_text', { length: 200 }),
  },
  (t) => ({
    pairIdx: uniqueIndex('product_attribute_values_pair_idx').on(t.productId, t.attributeId),
    attributeIdx: index('product_attribute_values_attribute_idx').on(t.attributeId),
    optionIdx: index('product_attribute_values_option_idx').on(t.optionId),
  }),
);

export const filterTags = pgTable(
  'filter_tags',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: varchar('description', { length: 300 }),
    // Badge tone picked once in the admin UI so a tag looks the same everywhere it
    // is rendered, instead of each surface choosing its own colour.
    color: varchar('color', { length: 20 }).notNull().default('blue'),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('filter_tags_slug_idx').on(t.slug),
  }),
);

export const productFilterTags = pgTable(
  'product_filter_tags',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    filterTagId: integer('filter_tag_id')
      .notNull()
      .references(() => filterTags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pairIdx: uniqueIndex('product_filter_tags_pair_idx').on(t.productId, t.filterTagId),
    tagIdx: index('product_filter_tags_tag_idx').on(t.filterTagId),
  }),
);

export const attributesRelations = relations(attributes, ({ many }) => ({
  options: many(attributeOptions),
  categories: many(attributeCategories),
  values: many(productAttributeValues),
}));

export const attributeOptionsRelations = relations(attributeOptions, ({ one, many }) => ({
  attribute: one(attributes, {
    fields: [attributeOptions.attributeId],
    references: [attributes.id],
  }),
  values: many(productAttributeValues),
}));

export const attributeCategoriesRelations = relations(attributeCategories, ({ one }) => ({
  attribute: one(attributes, {
    fields: [attributeCategories.attributeId],
    references: [attributes.id],
  }),
  category: one(categories, {
    fields: [attributeCategories.categoryId],
    references: [categories.id],
  }),
}));

export const productAttributeValuesRelations = relations(
  productAttributeValues,
  ({ one }) => ({
    product: one(products, {
      fields: [productAttributeValues.productId],
      references: [products.id],
    }),
    attribute: one(attributes, {
      fields: [productAttributeValues.attributeId],
      references: [attributes.id],
    }),
    option: one(attributeOptions, {
      fields: [productAttributeValues.optionId],
      references: [attributeOptions.id],
    }),
  }),
);

export const filterTagsRelations = relations(filterTags, ({ many }) => ({
  products: many(productFilterTags),
}));

export const productFilterTagsRelations = relations(productFilterTags, ({ one }) => ({
  product: one(products, {
    fields: [productFilterTags.productId],
    references: [products.id],
  }),
  filterTag: one(filterTags, {
    fields: [productFilterTags.filterTagId],
    references: [filterTags.id],
  }),
}));
