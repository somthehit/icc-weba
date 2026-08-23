import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { mapDbProductToProduct } from '@/lib/adapters/catalog';
import { queryProduct, queryProducts } from '@/lib/queries/catalog';
import { parseJson } from '@/lib/validation/parse';
import { createProductSchema } from '@/lib/validation/commerce';
import { isForeignKeyViolation, isUniqueViolation } from '@/lib/db/errors';

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
      const row = id !== undefined ? await queryProduct({ id }) : await queryProduct({ slug: slug! });
      if (!row) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      return NextResponse.json({ product: mapDbProductToProduct(row) });
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

    return NextResponse.json({
      products: rows.map(mapDbProductToProduct),
      total,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 },
    );
  }
}

export const POST = withRole(['admin', 'sales', 'inventory_manager'], async (request: NextRequest) => {
  try {
    const parsed = await parseJson(request, createProductSchema);
    if (!parsed.ok) return parsed.response;
    const { seoTitle, seoDescription, ...fields } = parsed.data;

    const [product] = await db
      .insert(products)
      .values({
        ...fields,
        metaTitle: fields.metaTitle ?? seoTitle,
        metaDescription: fields.metaDescription ?? seoDescription,
      })
      .returning();

    return NextResponse.json({ success: true, product }, { status: 201 });
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
