import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  brands,
  categories,
  products,
  productImages,
  productSpecs,
  productVariants,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { updateProductSchema } from '@/lib/validation/commerce';
import { idParamSchema } from '@/lib/validation/schemas';
import {
  deriveStockStatus,
  replaceImages,
  replaceSpecs,
  resolveCatalogRefs,
} from '@/lib/catalog/write';
import { queryProduct } from '@/lib/queries/catalog';
import { mapDbProductToProduct } from '@/lib/adapters/catalog';
import { isUniqueViolation } from '@/lib/db/errors';

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

/**
 * The raw product row, for the admin product form to edit.
 *
 * Staff-only, and not the endpoint the storefront reads: this returns every
 * column — including `cost_price`, which is what the shop paid the supplier —
 * plus draft and discontinued rows. Customers get `GET /api/products?slug=`,
 * which goes through `mapDbProductToProduct` and carries neither.
 *
 * `brandSlug` and `categorySlug` are joined in because the form works in slugs
 * (the numeric keys never reach the browser) and `PUT` expects them back.
 */
export const GET = withRole<RouteContext>([...CATALOG_EDITORS], async (_request, _auth, context) => {
  try {
    const productId = await readId(context);
    if (productId === null) return BAD_ID;

    const [row] = await db
      .select({
        product: products,
        brandSlug: brands.slug,
        categorySlug: categories.slug,
      })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, productId))
      .limit(1);

    if (!row) return NOT_FOUND();

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
      ...row.product,
      brandSlug: row.brandSlug,
      categorySlug: row.categorySlug,
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
});

export const PUT = withRole<RouteContext>([...CATALOG_EDITORS], async (request, _auth, context) => {
  try {
    const productId = await readId(context);
    if (productId === null) return BAD_ID;

    // This used to be `.set({ ...body })`, which accepted any column name the
    // caller invented — including `ratingAverage`, `reviewCount` and `id`.
    const parsed = await parseJson(request, updateProductSchema);
    if (!parsed.ok) return parsed.response;
    const { seoTitle, seoDescription, brandSlug, categorySlug, specs, images, ...fields } =
      parsed.data;

    const refs = await resolveCatalogRefs({ brandSlug, categorySlug });
    if (!refs.ok) return NextResponse.json({ error: refs.error }, { status: 400 });

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(products)
        .set({
          ...fields,
          ...(refs.brandId !== undefined ? { brandId: refs.brandId } : {}),
          ...(refs.categoryId !== undefined ? { categoryId: refs.categoryId } : {}),
          ...(seoTitle !== undefined ? { metaTitle: seoTitle } : {}),
          ...(seoDescription !== undefined ? { metaDescription: seoDescription } : {}),
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId))
        .returning();

      if (!row) return null;

      // Absent means "leave the spec sheet alone"; an empty array means "clear
      // it". Treating the two the same would wipe every spec on a form that
      // only touched the price.
      if (specs) await replaceSpecs(tx, productId, specs);
      if (images) await replaceImages(tx, productId, images);

      // `stock_status` is denormalized off `stock_quantity` and the form only
      // sends the quantity, so recompute it rather than leaving a product with
      // no units left still advertised as `in_stock`.
      const stockStatus = deriveStockStatus(
        row.stockQuantity,
        row.lowStockThreshold,
        row.stockStatus,
      );
      if (stockStatus !== row.stockStatus) {
        const [restated] = await tx
          .update(products)
          .set({ stockStatus })
          .where(eq(products.id, productId))
          .returning();
        return restated ?? row;
      }

      return row;
    });

    if (!updated) return NOT_FOUND();

    const row = await queryProduct({ id: productId });

    return NextResponse.json({
      success: true,
      product: row ? mapDbProductToProduct(row) : updated,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'A product with that SKU or slug already exists' },
        { status: 409 },
      );
    }
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
