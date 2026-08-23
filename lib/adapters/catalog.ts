// lib/adapters/catalog.ts
//
// The one place that translates database rows into the frontend contracts in
// types/index.ts. Every catalogue read (API routes, server components, the store
// context) goes through here so the UI never has to know that `mrp` is really
// `compare_at_price`, or that a category "id" is a slug.
//
// Keep these functions pure and defensive: rows arrive over the wire as JSON, so
// numerics come back as strings and timestamps as ISO strings.

import type {
  Brand,
  CategoryItem,
  Product,
  ProductCategory,
  ProductOffer,
  ProductSpecification,
} from '@/types';

/** Numeric/decimal columns arrive as strings from postgres; nulls become 0. */
const num = (v: string | number | null | undefined, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** Timestamps may already be Date (server-side) or ISO string (over the wire). */
const iso = (v: Date | string | null | undefined): string | undefined => {
  if (!v) return undefined;
  return v instanceof Date ? v.toISOString() : v;
};

/**
 * Shape returned by the catalogue endpoints and by direct server-side selects.
 * Deliberately loose on numerics/dates so the same adapter works for a Drizzle
 * row and for its JSON round-trip.
 */
export interface DbProductRow {
  id: number;
  sku: string;
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  basePrice: string | number;
  compareAtPrice?: string | number | null;
  brandName?: string | null;
  categorySlug?: string | null;
  subcategory?: string | null;
  warrantyText?: string | null;
  warrantyMonths?: number | null;
  releaseDate?: string | null;
  tags?: unknown;
  features?: unknown;
  whatsInTheBox?: unknown;
  ratingAverage?: string | number | null;
  reviewCount?: number | null;
  stockQuantity?: number | null;
  lowStockThreshold?: number | null;
  stockStatus?: string | null;
  status?: string | null;
  isFeatured?: boolean | null;
  isNewArrival?: boolean | null;
  isBestSeller?: boolean | null;
  isTrending?: boolean | null;
  isDealOfDay?: boolean | null;
  offerEnabled?: boolean | null;
  offerDiscountType?: string | null;
  offerDiscountValue?: string | number | null;
  offerStartsAt?: Date | string | null;
  offerEndsAt?: Date | string | null;
  offerIsFlashSale?: boolean | null;
  offerStackable?: boolean | null;
  createdAt?: Date | string | null;
  /** Ordered image URLs (primary first). */
  images?: string[] | null;
  specs?: Array<{ specKey: string; specValue: string }> | null;
}

const mapOffer = (row: DbProductRow): ProductOffer | undefined => {
  if (!row.offerEnabled || !row.offerDiscountType) return undefined;
  return {
    enabled: true,
    discountType: row.offerDiscountType === 'fixed' ? 'fixed' : 'percentage',
    discountValue: num(row.offerDiscountValue),
    startsAt: iso(row.offerStartsAt),
    endsAt: iso(row.offerEndsAt),
    isFlashSale: row.offerIsFlashSale ?? false,
    isStackableWithCoupons: row.offerStackable ?? false,
  };
};

const mapSpecs = (row: DbProductRow): ProductSpecification[] | undefined => {
  if (!row.specs?.length) return undefined;
  return row.specs.map((s) => ({ key: s.specKey, value: s.specValue }));
};

export function mapDbProductToProduct(row: DbProductRow): Product {
  const sellingPrice = num(row.basePrice);
  // compare_at_price is the strike-through MRP; fall back to the selling price so
  // the UI never renders a "was NPR 0" line for products without a list price.
  const mrp = num(row.compareAtPrice, sellingPrice) || sellingPrice;
  const stockQuantity = row.stockQuantity ?? 0;

  return {
    // String so it lines up with the frontend's string ids and with the numeric
    // productId the reviews API returns (String(dbId) on both sides).
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    brand: row.brandName ?? 'Unbranded',
    category: (row.categorySlug ?? 'computers-laptops') as ProductCategory,
    subcategory: str(row.subcategory),
    shortDescription: row.shortDescription ?? '',
    longDescription: str(row.description),
    mrp,
    sellingPrice,
    discountPercent:
      mrp > sellingPrice ? Math.round(((mrp - sellingPrice) / mrp) * 100) : undefined,
    inStock: row.stockStatus !== 'out_of_stock' && stockQuantity > 0,
    stockQuantity,
    lowStockThreshold: row.lowStockThreshold ?? undefined,
    rating: num(row.ratingAverage),
    reviewCount: row.reviewCount ?? 0,
    isFeatured: row.isFeatured ?? false,
    isNewArrival: row.isNewArrival ?? false,
    isBestSeller: row.isBestSeller ?? false,
    isTrending: row.isTrending ?? false,
    isDealOfDay: row.isDealOfDay ?? false,
    offer: mapOffer(row),
    warranty: str(row.warrantyText),
    warrantyMonths: row.warrantyMonths ?? undefined,
    images: list(row.images),
    specifications: mapSpecs(row),
    features: row.features ? list(row.features) : undefined,
    tags: list(row.tags),
    whatsInTheBox: row.whatsInTheBox ? list(row.whatsInTheBox) : undefined,
    // The DB has draft/active/inactive/discontinued; the storefront only cares
    // whether a product is still sold.
    status: row.status === 'discontinued' ? 'discontinued' : 'active',
    createdAt: iso(row.createdAt),
    releaseDate: str(row.releaseDate),
  };
}

export interface DbCategoryRow {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  iconName?: string | null;
  subcategories?: unknown;
  imageUrl?: string | null;
  /** Live count of active products, computed by the endpoint. */
  productCount?: number | string | null;
}

export function mapDbCategoryToCategoryItem(row: DbCategoryRow): CategoryItem {
  return {
    // The storefront treats the slug as the category id (ProductCategory union).
    id: row.slug as ProductCategory,
    name: row.name,
    description: row.description ?? '',
    iconName: row.iconName ?? 'Package',
    image: row.imageUrl ?? '',
    productCount: num(row.productCount),
    subcategories: list(row.subcategories),
  };
}

export interface DbBrandRow {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  isPartner?: boolean | null;
  categorySlugs?: unknown;
}

export function mapDbBrandToBrand(row: DbBrandRow): Brand {
  return {
    id: row.slug,
    name: row.name,
    logo: row.logoUrl ?? '',
    description: row.description ?? '',
    isPartner: row.isPartner ?? false,
    categories: list(row.categorySlugs) as ProductCategory[],
  };
}
