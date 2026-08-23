import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { discountTypeEnum, productStatusEnum, stockStatusEnum } from './enums';

export const brands = pgTable(
  'brands',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 140 }).notNull(),
    logoUrl: varchar('logo_url', { length: 500 }),
    description: text('description'),
    // Curated "Official Partner Brand" flag. Every brand a product references gets
    // a row here, but only partners are merchandised on the Brands page.
    isPartner: boolean('is_partner').notNull().default(false),
    // Category slugs this brand is merchandised under (display-only ordering hint).
    categorySlugs: jsonb('category_slugs').$type<string[]>(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('brands_slug_idx').on(t.slug),
  }),
);

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 140 }).notNull(),
    description: text('description'),
    // lucide-react icon name rendered by the storefront category tiles, e.g. "Laptop".
    iconName: varchar('icon_name', { length: 60 }),
    // Subcategory labels shown in the category drilldown. Display-only, so jsonb
    // rather than a self-join through categories.parentId.
    subcategories: jsonb('subcategories').$type<string[]>(),
    // self-referencing for nested categories, e.g. Laptops > Gaming Laptops
    parentId: integer('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'set null',
    }),
    imageUrl: varchar('image_url', { length: 500 }),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    slugIdx: uniqueIndex('categories_slug_idx').on(t.slug),
    parentIdx: index('categories_parent_idx').on(t.parentId),
  }),
);

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    sku: varchar('sku', { length: 60 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 220 }).notNull(),
    brandId: integer('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    categoryId: integer('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    shortDescription: varchar('short_description', { length: 500 }),
    basePrice: numeric('base_price', { precision: 12, scale: 2 }).notNull(),
    compareAtPrice: numeric('compare_at_price', { precision: 12, scale: 2 }), // strike-through / "-7% OFF" price
    costPrice: numeric('cost_price', { precision: 12, scale: 2 }),
    warrantyMonths: integer('warranty_months').default(0),
    warrantyType: varchar('warranty_type', { length: 60 }).default('official_np'),
    // Human-readable warranty blurb shown on the PDP, e.g.
    // "2 Years Lenovo Official Nepal Warranty + 1 Year ADP". warrantyMonths alone
    // can't round-trip this copy.
    warrantyText: varchar('warranty_text', { length: 250 }),
    subcategory: varchar('subcategory', { length: 120 }),
    releaseDate: date('release_date', { mode: 'string' }),
    // Free-form storefront content: search tags, bullet features, box contents.
    // jsonb (not a join table) because these are display-only string lists.
    tags: jsonb('tags').$type<string[]>(),
    features: jsonb('features').$type<string[]>(),
    whatsInTheBox: jsonb('whats_in_the_box').$type<string[]>(),
    // Denormalized review aggregates so listing pages don't join reviews.
    ratingAverage: numeric('rating_average', { precision: 2, scale: 1 }).notNull().default('0'),
    reviewCount: integer('review_count').notNull().default(0),
    isFeatured: boolean('is_featured').notNull().default(false),
    isDealOfDay: boolean('is_deal_of_day').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    // lifecycle + merchandising flags (denormalized onto the product row)
    status: productStatusEnum('status').notNull().default('active'),
    isNewArrival: boolean('is_new_arrival').notNull().default(false),
    isBestSeller: boolean('is_best_seller').notNull().default(false),
    isTrending: boolean('is_trending').notNull().default(false),
    // stock — single-warehouse denormalization; the `inventory` table stays for multi-warehouse
    stockQuantity: integer('stock_quantity').notNull().default(0),
    reservedQuantity: integer('reserved_quantity').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    stockStatus: stockStatusEnum('stock_status').notNull().default('in_stock'),
    // per-product timed offer (mirrors the frontend ProductOffer shape)
    offerEnabled: boolean('offer_enabled').notNull().default(false),
    offerDiscountType: discountTypeEnum('offer_discount_type'),
    offerDiscountValue: numeric('offer_discount_value', { precision: 12, scale: 2 }),
    offerMaxDiscountAmount: numeric('offer_max_discount_amount', { precision: 12, scale: 2 }),
    offerStartsAt: timestamp('offer_starts_at'),
    offerEndsAt: timestamp('offer_ends_at'),
    offerIsFlashSale: boolean('offer_is_flash_sale').notNull().default(false),
    offerStackable: boolean('offer_stackable').notNull().default(false),
    metaTitle: varchar('meta_title', { length: 200 }),
    metaDescription: varchar('meta_description', { length: 500 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    skuIdx: uniqueIndex('products_sku_idx').on(t.sku),
    slugIdx: uniqueIndex('products_slug_idx').on(t.slug),
    brandIdx: index('products_brand_idx').on(t.brandId),
    categoryIdx: index('products_category_idx').on(t.categoryId),
    statusIdx: index('products_status_idx').on(t.status),
  }),
);

// Flexible spec-sheet rows (CPU / RAM / GPU / Display / Warranty …) — same
// pattern as the spec card on the storefront hero. Add any spec without a migration.
export const productSpecs = pgTable(
  'product_specs',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    specKey: varchar('spec_key', { length: 60 }).notNull(), // "CPU", "RAM", "GPU", "DISPLAY"...
    specValue: varchar('spec_value', { length: 200 }).notNull(),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (t) => ({
    productIdx: index('product_specs_product_idx').on(t.productId),
  }),
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantName: varchar('variant_name', { length: 120 }).notNull(), // e.g. "16GB / 512GB"
    sku: varchar('sku', { length: 60 }).notNull(),
    priceAdjustment: numeric('price_adjustment', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    skuIdx: uniqueIndex('product_variants_sku_idx').on(t.sku),
    productIdx: index('product_variants_product_idx').on(t.productId),
  }),
);

export const productImages = pgTable(
  'product_images',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 500 }).notNull(),
    altText: varchar('alt_text', { length: 200 }),
    displayOrder: integer('display_order').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => ({
    productIdx: index('product_images_product_idx').on(t.productId),
  }),
);

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  specs: many(productSpecs),
  variants: many(productVariants),
  images: many(productImages),
}));

export const productSpecsRelations = relations(productSpecs, ({ one }) => ({
  product: one(products, { fields: [productSpecs.productId], references: [products.id] }),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));
