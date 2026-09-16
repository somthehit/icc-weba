// lib/queries/catalog.ts
//
// Server-side catalogue reads. Shared by the /api/catalog routes and (for SSR
// pages) by server components, so there is exactly one definition of "what a
// product row looks like" feeding lib/adapters/catalog.ts.

import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import {
  brands,
  categories,
  productImages,
  products,
  productSpecs,
} from '@/db/schema';
import type { DbBrandRow, DbCategoryRow, DbProductRow } from '@/lib/adapters/catalog';

/** Every product column the storefront renders, plus resolved brand/category. */
const productColumns = {
  id: products.id,
  sku: products.sku,
  name: products.name,
  slug: products.slug,
  description: products.description,
  shortDescription: products.shortDescription,
  basePrice: products.basePrice,
  compareAtPrice: products.compareAtPrice,
  subcategory: products.subcategory,
  warrantyText: products.warrantyText,
  warrantyMonths: products.warrantyMonths,
  releaseDate: products.releaseDate,
  tags: products.tags,
  features: products.features,
  whatsInTheBox: products.whatsInTheBox,
  ratingAverage: products.ratingAverage,
  reviewCount: products.reviewCount,
  stockQuantity: products.stockQuantity,
  lowStockThreshold: products.lowStockThreshold,
  stockStatus: products.stockStatus,
  status: products.status,
  isFeatured: products.isFeatured,
  isNewArrival: products.isNewArrival,
  isBestSeller: products.isBestSeller,
  isTrending: products.isTrending,
  isDealOfDay: products.isDealOfDay,
  offerEnabled: products.offerEnabled,
  offerDiscountType: products.offerDiscountType,
  offerDiscountValue: products.offerDiscountValue,
  offerStartsAt: products.offerStartsAt,
  offerEndsAt: products.offerEndsAt,
  offerIsFlashSale: products.offerIsFlashSale,
  offerStackable: products.offerStackable,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
  // Per-SKU search metadata, so the storefront's product page can prefer the
  // operator's title over the generated regional one.
  metaTitle: products.metaTitle,
  metaDescription: products.metaDescription,
  brandId: products.brandId,
  categoryId: products.categoryId,
  brandName: brands.name,
  brandSlug: brands.slug,
  categoryName: categories.name,
  categorySlug: categories.slug,
} as const;

export interface ProductQuery {
  id?: number;
  slug?: string;
  categoryId?: number;
  categorySlug?: string;
  brandId?: number;
  brandSlug?: string;
  search?: string;
  /** DB product_status. Defaults to 'active' for storefront reads. */
  status?: string | null;
  isFeatured?: boolean;
  limit?: number;
  offset?: number;
  /** Spec sheets are only needed by product detail; skip them for listings. */
  includeSpecs?: boolean;
}

type ProductRowWithRelations = DbProductRow & Record<string, unknown>;

/** Attaches ordered image URLs (primary first) and optional spec rows. */
async function attachRelations(
  rows: ProductRowWithRelations[],
  includeSpecs: boolean,
): Promise<ProductRowWithRelations[]> {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.id);

  const imageRows = await db
    .select({
      productId: productImages.productId,
      url: productImages.url,
    })
    .from(productImages)
    .where(inArray(productImages.productId, ids))
    .orderBy(desc(productImages.isPrimary), asc(productImages.displayOrder), asc(productImages.id));

  const imagesByProduct = new Map<number, string[]>();
  for (const img of imageRows) {
    const bucket = imagesByProduct.get(img.productId);
    if (bucket) bucket.push(img.url);
    else imagesByProduct.set(img.productId, [img.url]);
  }

  let specsByProduct: Map<number, Array<{ specKey: string; specValue: string }>> | null = null;
  if (includeSpecs) {
    const specRows = await db
      .select({
        productId: productSpecs.productId,
        specKey: productSpecs.specKey,
        specValue: productSpecs.specValue,
      })
      .from(productSpecs)
      .where(inArray(productSpecs.productId, ids))
      .orderBy(asc(productSpecs.displayOrder), asc(productSpecs.id));

    specsByProduct = new Map();
    for (const spec of specRows) {
      const bucket = specsByProduct.get(spec.productId);
      const entry = { specKey: spec.specKey, specValue: spec.specValue };
      if (bucket) bucket.push(entry);
      else specsByProduct.set(spec.productId, [entry]);
    }
  }

  for (const row of rows) {
    row.images = imagesByProduct.get(row.id) ?? [];
    if (specsByProduct) row.specs = specsByProduct.get(row.id) ?? [];
  }
  return rows;
}

function productConditions(q: ProductQuery): SQL[] {
  const conditions: SQL[] = [];
  if (q.id !== undefined) conditions.push(eq(products.id, q.id));
  if (q.slug) conditions.push(eq(products.slug, q.slug));
  if (q.categoryId !== undefined) conditions.push(eq(products.categoryId, q.categoryId));
  if (q.categorySlug) conditions.push(eq(categories.slug, q.categorySlug));
  if (q.brandId !== undefined) conditions.push(eq(products.brandId, q.brandId));
  if (q.brandSlug) conditions.push(eq(brands.slug, q.brandSlug));
  if (q.isFeatured !== undefined) conditions.push(eq(products.isFeatured, q.isFeatured));
  // `status: null` explicitly means "any status" (admin listings).
  if (q.status !== null) {
    conditions.push(eq(products.status, (q.status ?? 'active') as 'active'));
  }
  if (q.search) {
    const like = `%${q.search}%`;
    const match = or(
      ilike(products.name, like),
      ilike(products.sku, like),
      ilike(products.shortDescription, like),
      ilike(brands.name, like),
    );
    if (match) conditions.push(match);
  }
  return conditions;
}

export async function queryProducts(
  q: ProductQuery = {},
): Promise<{ rows: DbProductRow[]; total: number }> {
  const conditions = productConditions(q);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  // Hard ceiling so a crafted ?limit= can't ask for the whole table.
  const limit = Math.min(Math.max(q.limit ?? 60, 1), 200);
  const offset = Math.max(q.offset ?? 0, 0);

  const rows = (await db
    .select(productColumns)
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(where)
    .orderBy(desc(products.createdAt), desc(products.id))
    .limit(limit)
    .offset(offset)) as unknown as ProductRowWithRelations[];

  await attachRelations(rows, q.includeSpecs ?? false);

  // Counted with the same filters as the page — otherwise pagination lies.
  const [counted] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(where);

  return { rows, total: counted?.count ?? rows.length };
}

/** Single product by slug or id, with spec sheet attached. */
export async function queryProduct(
  by: { slug: string } | { id: number },
): Promise<DbProductRow | null> {
  const { rows } = await queryProducts({
    ...by,
    status: null,
    limit: 1,
    includeSpecs: true,
  });
  return rows[0] ?? null;
}

export async function queryCategories(): Promise<DbCategoryRow[]> {
  // productCount is derived, not stored, so it can never drift from the catalogue.
  // Grouping by categories.id alone is enough — the rest are functionally
  // dependent on the primary key.
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      iconName: categories.iconName,
      subcategories: categories.subcategories,
      imageUrl: categories.imageUrl,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(
      products,
      and(eq(products.categoryId, categories.id), eq(products.status, 'active')),
    )
    .where(eq(categories.isActive, true))
    .groupBy(categories.id)
    .orderBy(asc(categories.displayOrder), asc(categories.id));
  return rows;
}

export async function queryBrands(opts: { partnersOnly?: boolean } = {}): Promise<DbBrandRow[]> {
  const conditions: SQL[] = [eq(brands.isActive, true)];
  if (opts.partnersOnly) conditions.push(eq(brands.isPartner, true));

  return db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      logoUrl: brands.logoUrl,
      description: brands.description,
      isPartner: brands.isPartner,
      categorySlugs: brands.categorySlugs,
    })
    .from(brands)
    .where(and(...conditions))
    .orderBy(desc(brands.isPartner), asc(brands.name));
}
