import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { mapDbProductToProduct } from '@/lib/adapters/catalog';
import { queryProduct, queryProducts } from '@/lib/queries/catalog';
import { parseJson } from '@/lib/validation/parse';
import { createProductSchema } from '@/lib/validation/commerce';
import { deriveStockStatus, replaceImages, replaceSpecs, resolveCatalogRefs } from '@/lib/catalog/write';
import { isForeignKeyViolation, isUniqueViolation } from '@/lib/db/errors';
import { INITIAL_PRODUCTS } from '@/lib/data/initial-data';

const intParam = (v: string | null): number | undefined => {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Storefront catalogue read. Returns products already mapped to the frontend
 * `Product` contract (see lib/adapters/catalog.ts) so the UI never deals with
 * column names, string numerics or the DB's extra lifecycle states.
 *
 * ?slug= / ?id=  single product (with spec sheet)
 * otherwise      filtered list + total
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = intParam(searchParams.get('id'));
    const slug = searchParams.get('slug');

    if (id !== undefined || slug) {
      try {
        const row = id !== undefined ? await queryProduct({ id }) : await queryProduct({ slug: slug! });
        if (row) {
          return NextResponse.json({ product: mapDbProductToProduct(row) });
        }
      } catch (err) {
        console.warn('DB queryProduct failed, checking INITIAL_PRODUCTS:', err);
      }

      const fallback = INITIAL_PRODUCTS.find(
        (p) => (id !== undefined && p.id === String(id)) || (slug && p.slug === slug),
      );
      if (fallback) {
        return NextResponse.json({ product: fallback });
      }
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const status = searchParams.get('status');
    const { rows, total } = await queryProducts({
      categoryId: intParam(searchParams.get('categoryId')),
      categorySlug: searchParams.get('category') ?? undefined,
      brandId: intParam(searchParams.get('brandId')),
      brandSlug: searchParams.get('brand') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      // ?status=all lets the admin catalogue see drafts and discontinued rows.
      status: status === 'all' ? null : status,
      isFeatured: searchParams.get('featured') === 'true' ? true : undefined,
      limit: intParam(searchParams.get('limit')),
      offset: intParam(searchParams.get('offset')),
      includeSpecs: searchParams.get('includeSpecs') !== 'false',
    });

    if (rows && rows.length > 0) {
      return NextResponse.json({
        products: rows.map(mapDbProductToProduct),
        total,
      });
    }

    // Fallback if DB table is empty
    return NextResponse.json({
      products: INITIAL_PRODUCTS,
      total: INITIAL_PRODUCTS.length,
    });
  } catch (error) {
    console.error('Error fetching products from DB, serving fallback initial data:', error);
    return NextResponse.json({
      products: INITIAL_PRODUCTS,
      total: INITIAL_PRODUCTS.length,
      fallback: true,
    });
  }
}

export const POST = withRole(['admin', 'sales', 'inventory_manager'], async (request: NextRequest) => {
  try {
    const parsed = await parseJson(request, createProductSchema);
    if (!parsed.ok) return parsed.response;
    const { seoTitle, seoDescription, brandSlug, categorySlug, specs, images, ...fields } =
      parsed.data;

    const refs = await resolveCatalogRefs({ brandSlug, categorySlug });
    if (!refs.ok) return NextResponse.json({ error: refs.error }, { status: 400 });

    // The spec sheet and the gallery live in their own tables, so a half-written
    // product — row saved, images lost — is the failure mode to avoid.
    const created = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          ...fields,
          ...(refs.brandId !== undefined ? { brandId: refs.brandId } : {}),
          ...(refs.categoryId !== undefined ? { categoryId: refs.categoryId } : {}),
          // The form sends a quantity, not a shelf state. Deriving it here keeps a
          // product stocked at 0 from being listed as `in_stock`.
          stockStatus: deriveStockStatus(fields.stockQuantity, fields.lowStockThreshold),
          metaTitle: fields.metaTitle ?? seoTitle,
          metaDescription: fields.metaDescription ?? seoDescription,
        })
        .returning();

      if (specs) await replaceSpecs(tx, product.id, specs);
      if (images) await replaceImages(tx, product.id, images);

      return product;
    });

    // Re-read through the same query the storefront uses, so the caller gets the
    // product with its brand name, category slug, images and specs attached
    // rather than the bare row it just inserted.
    const row = await queryProduct({ id: created.id });

    return NextResponse.json(
      { success: true, product: row ? mapDbProductToProduct(row) : created },
      { status: 201 },
    );
  } catch (error) {
    // `sku` and `slug` are unique; a clash is the caller's mistake, not a fault.
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'A product with that SKU or slug already exists' },
        { status: 409 },
      );
    }
    if (isForeignKeyViolation(error)) {
      return NextResponse.json(
        { error: 'brandId or categoryId does not exist' },
        { status: 400 },
      );
    }
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 },
    );
  }
});
