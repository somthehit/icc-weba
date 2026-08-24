// lib/catalog/write.ts
//
// Shared write-side helpers for the product endpoints. The admin form posts one
// object describing a whole product — the row, its spec sheet and its gallery —
// so the pieces that touch more than one table live here rather than being
// duplicated between POST /api/products and PUT /api/products/[id].

import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { brands, categories, productImages, productSpecs, products } from '@/db/schema';
import type { DbClient } from '@/lib/pricing/quote';

export interface SpecInput {
  specKey: string;
  specValue: string;
  displayOrder?: number;
}

export interface ImageInput {
  url: string;
  altText?: string;
  displayOrder?: number;
  isPrimary?: boolean;
}

/**
 * Turns the brand/category slugs the admin UI works in into the row ids the
 * `products` foreign keys need.
 *
 * `/api/brands` and `/api/categories` publish the slug as each record's `id`
 * (see `mapDbBrandToBrand`), so the numeric key never reaches the client. An
 * unknown slug is the caller's mistake and comes back as a message rather than
 * as a foreign-key violation from Postgres.
 */
export async function resolveCatalogRefs(input: {
  brandSlug?: string;
  categorySlug?: string;
}): Promise<
  | { ok: true; brandId?: number; categoryId?: number }
  | { ok: false; error: string }
> {
  const resolved: { brandId?: number; categoryId?: number } = {};

  if (input.brandSlug) {
    const [brand] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, input.brandSlug))
      .limit(1);
    if (!brand) return { ok: false, error: `No brand with slug "${input.brandSlug}"` };
    resolved.brandId = brand.id;
  }

  if (input.categorySlug) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, input.categorySlug))
      .limit(1);
    if (!category) {
      return { ok: false, error: `No category with slug "${input.categorySlug}"` };
    }
    resolved.categoryId = category.id;
  }

  return { ok: true, ...resolved };
}

/**
 * Replaces a product's spec sheet with `specs`.
 *
 * Delete-then-insert rather than diffing: `product_specs` rows carry no meaning
 * of their own — nothing references them, and the form always sends the full
 * sheet — so matching them up by id would be work with no payoff. Callers pass a
 * transaction handle so the specs land with the product row or not at all.
 */
export async function replaceSpecs(
  tx: DbClient,
  productId: number,
  specs: SpecInput[],
): Promise<void> {
  await tx.delete(productSpecs).where(eq(productSpecs.productId, productId));
  if (specs.length === 0) return;

  await tx.insert(productSpecs).values(
    specs.map((spec, index) => ({
      productId,
      specKey: spec.specKey,
      specValue: spec.specValue,
      displayOrder: spec.displayOrder ?? index,
    })),
  );
}

/**
 * Replaces a product's gallery with `images`, and guarantees exactly one primary.
 *
 * The storefront reads the primary image as the card thumbnail, so "none marked"
 * and "two marked" are both broken states. Whatever the form sends, the first
 * flagged image wins and everything else is demoted; with nothing flagged, the
 * first image in display order becomes primary.
 */
export async function replaceImages(
  tx: DbClient,
  productId: number,
  images: ImageInput[],
): Promise<void> {
  await tx.delete(productImages).where(eq(productImages.productId, productId));
  if (images.length === 0) return;

  const ordered = images.map((image, index) => ({
    ...image,
    displayOrder: image.displayOrder ?? index,
  }));

  const primaryIndex = Math.max(
    0,
    ordered.findIndex((image) => image.isPrimary),
  );

  await tx.insert(productImages).values(
    ordered.map((image, index) => ({
      productId,
      url: image.url,
      altText: image.altText ?? null,
      displayOrder: image.displayOrder,
      isPrimary: index === primaryIndex,
    })),
  );
}

/**
 * `stock_status` recomputed from the quantity being written.
 *
 * Deliberately the same arithmetic as `stockStatusFrom` in lib/orders/stock.ts,
 * which does this in SQL when an order draws stock down — the two must not
 * disagree, or a product's badge would depend on whether it was last touched by
 * a sale or by the admin form.
 *
 * `pre_order` and `discontinued` describe how a product is sold rather than what
 * is on the shelf, so they survive a restock instead of quietly becoming
 * `in_stock`.
 */
export function deriveStockStatus(
  quantity: number,
  lowStockThreshold: number,
  current?: string | null,
): 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order' | 'discontinued' {
  if (current === 'pre_order' || current === 'discontinued') return current;
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

/**
 * A URL-safe slug derived from a product name, unique against `products.slug`.
 *
 * `products_slug_idx` is unique and the slug is what the storefront product page
 * resolves on, so a second "Legion Pro 5" has to become `legion-pro-5-2` rather
 * than failing the insert. `excludeId` keeps a product from colliding with
 * itself when it is being renamed.
 */
export async function uniqueProductSlug(
  name: string,
  excludeId?: number,
): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200) || 'product';

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await db
      .select({ id: products.id })
      .from(products)
      .where(
        excludeId === undefined
          ? eq(products.slug, candidate)
          : and(eq(products.slug, candidate), ne(products.id, excludeId)),
      )
      .limit(1);
    if (clash.length === 0) return candidate;
  }

  // 50 products sharing a name is not a real catalogue; fall back to something
  // that cannot collide rather than looping forever.
  return `${base}-${Date.now().toString(36)}`;
}
