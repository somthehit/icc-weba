import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products, productImages, productSpecs, productVariants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { updateProductSchema } from '@/lib/validation/commerce';
import { idParamSchema } from '@/lib/validation/schemas';

type RouteContext = { params: Promise<{ id: string }> };

/** Everyone who may edit the catalog. */
const CATALOG_EDITORS = ['admin', 'sales', 'inventory_manager'] as const;

/**
 * `parseInt('abc')` is NaN, which Drizzle happily sends to Postgres as an
 * invalid bind parameter and turns into a 500. Validate first and answer 400.
 */
async function readId(context: RouteContext) {
  const { id } = await context.params;
  const parsed = idParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

const BAD_ID = NextResponse.json({ error: 'Product id must be a positive integer' }, { status: 400 });
const NOT_FOUND = () => NextResponse.json({ error: 'Product not found' }, { status: 404 });

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const productId = await readId(context);
    if (productId === null) return BAD_ID;

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) return NOT_FOUND();

    const images = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.displayOrder);

    const specs = await db
      .select()
      .from(productSpecs)
      .where(eq(productSpecs.productId, productId))
      .orderBy(productSpecs.displayOrder);

    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    return NextResponse.json({
      ...product,
      images,
      specs,
      variants,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 },
    );
  }
}

export const PUT = withRole<RouteContext>([...CATALOG_EDITORS], async (request, _auth, context) => {
  try {
    const productId = await readId(context);
    if (productId === null) return BAD_ID;

    // This used to be `.set({ ...body })`, which accepted any column name the
    // caller invented — including `ratingAverage`, `reviewCount` and `id`.
    const parsed = await parseJson(request, updateProductSchema);
    if (!parsed.ok) return parsed.response;
    const { seoTitle, seoDescription, ...fields } = parsed.data;

    const [updated] = await db
      .update(products)
      .set({
        ...fields,
        ...(seoTitle !== undefined ? { metaTitle: seoTitle } : {}),
        ...(seoDescription !== undefined ? { metaDescription: seoDescription } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();

    if (!updated) return NOT_FOUND();

    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 },
    );
  }
});

/**
 * Retires a product instead of deleting the row.
 *
 * A hard delete cascaded into `order_items`, silently rewriting the history of
 * orders that had already been placed and paid for. Setting the product
 * inactive removes it from the storefront and leaves those records intact.
 */
export const DELETE = withRole<RouteContext>(['admin'], async (_request, _auth, context) => {
  try {
    const productId = await readId(context);
    if (productId === null) return BAD_ID;

    const [archived] = await db
      .update(products)
      .set({ isActive: false, status: 'discontinued', updatedAt: new Date() })
      .where(eq(products.id, productId))
      .returning({ id: products.id, status: products.status });

    if (!archived) return NOT_FOUND();

    return NextResponse.json({ success: true, product: archived });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 },
    );
  }
});
