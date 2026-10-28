import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { brands, categories, products, productImages } from '@/db/schema';
import { eq, or, ilike, sql, and, asc, inArray } from 'drizzle-orm';
import { PosProfiler } from '@/lib/pos/perf';
import { posCache } from '@/lib/redis/client';
import { generate16DigitBarcode } from '@/lib/barcode/barcode16';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const profiler = new PosProfiler('products-get');
  const timerTotal = profiler.start('total', 'Total POS Product Fetch');

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const barcode = searchParams.get('barcode')?.trim();
    const categorySlug = searchParams.get('category');
    const stockFilter = searchParams.get('stock'); // 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(Number(searchParams.get('limit')) || 60, 200);
    const offset = (page - 1) * limit;
    const includeMeta = searchParams.get('meta') === 'true'; // Only compute when requested, default false for search

    // 1. Direct Barcode Cache Lookup
    if (barcode) {
      const barcodeCacheKey = `barcode:${barcode}`;
      const cachedProduct = await posCache.get<any>(barcodeCacheKey);
      if (cachedProduct) {
        timerTotal();
        const res = NextResponse.json({
          success: true,
          count: 1,
          products: [cachedProduct],
          source: 'redis_cache',
          timestamp: new Date().toISOString(),
        });
        res.headers.set('Server-Timing', profiler.getServerTimingHeader());
        return res;
      }
    }

    // 2. Build Query Conditions
    const conditions: ReturnType<typeof eq>[] = [];
    conditions.push(eq(products.status, 'active'));

    if (barcode) {
      conditions.push(eq(products.barcode, barcode));
    } else if (search) {
      conditions.push(
        or(
          eq(products.barcode, search),
          eq(products.sku, search),
          ilike(products.sku, `${search}%`),
          ilike(products.name, `%${search}%`)
        ) as ReturnType<typeof eq>
      );
    }

    if (categorySlug && categorySlug !== 'all') {
      const [cat] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, categorySlug))
        .limit(1);
      if (cat) {
        conditions.push(eq(products.categoryId, cat.id));
      }
    }

    if (stockFilter && stockFilter !== 'all') {
      if (stockFilter === 'out_of_stock') {
        conditions.push(eq(products.stockStatus, 'out_of_stock'));
      } else if (stockFilter === 'low_stock') {
        conditions.push(eq(products.stockStatus, 'low_stock'));
      } else if (stockFilter === 'in_stock') {
        conditions.push(eq(products.stockStatus, 'in_stock'));
      }
    }

    // 3. Execute Indexed Query with Profiling
    const stopDbTimer = profiler.start('db_products', 'Indexed Products Query');
    const rows = await db
      .select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        slug: products.slug,
        basePrice: products.basePrice,
        compareAtPrice: products.compareAtPrice,
        costPrice: products.costPrice,
        stockQuantity: products.stockQuantity,
        stockStatus: products.stockStatus,
        lowStockThreshold: products.lowStockThreshold,
        warrantyMonths: products.warrantyMonths,
        warrantyType: products.warrantyType,
        warrantyText: products.warrantyText,
        brandId: products.brandId,
        brandName: brands.name,
        categoryId: products.categoryId,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(products.name))
      .limit(limit)
      .offset(offset);
    stopDbTimer();

    // 4. Batch Fetch Images
    const stopImgTimer = profiler.start('db_images', 'Product Images Batch');
    const productIds = rows.map((r) => r.id);
    const imagesByProduct: Record<string, string> = {};

    if (productIds.length > 0) {
      const imgRows = await db
        .select({
          productId: productImages.productId,
          imageUrl: productImages.url,
          isPrimary: productImages.isPrimary,
        })
        .from(productImages)
        .where(inArray(productImages.productId, productIds));

      for (const img of imgRows) {
        if (!imagesByProduct[img.productId] || img.isPrimary) {
          imagesByProduct[img.productId] = img.imageUrl;
        }
      }
    }
    stopImgTimer();

    const items = rows.map((r) => {
      const price = Number(r.basePrice);
      const comparePrice = r.compareAtPrice ? Number(r.compareAtPrice) : price;
      const stock = r.stockQuantity ?? 0;
      const threshold = r.lowStockThreshold || 5;
      const finalBarcode = (r.barcode && /^\d{16}$/.test(r.barcode.trim()))
        ? r.barcode.trim()
        : generate16DigitBarcode(r.id || r.sku);
      const itemObj = {
        id: r.id,
        sku: r.sku,
        barcode: finalBarcode,
        name: r.name,
        slug: r.slug,
        price,
        compareAtPrice: comparePrice,
        costPrice: r.costPrice ? Number(r.costPrice) : null,
        stockQuantity: stock,
        stockStatus: r.stockStatus,
        inStock: stock > 0 && r.stockStatus !== 'out_of_stock',
        lowStockThreshold: threshold,
        isLowStock: stock > 0 && stock <= threshold,
        isSerialized: ['laptop', 'desktop', 'gpu', 'phone', 'tablet', 'monitor'].some(
          (k) =>
            (r.categorySlug || '').toLowerCase().includes(k) ||
            (r.name || '').toLowerCase().includes(k)
        ),
        warrantyMonths: r.warrantyMonths || 0,
        warrantyType: r.warrantyType || 'official_np',
        warrantyText: r.warrantyText || (r.warrantyMonths ? `${r.warrantyMonths} Months Warranty` : 'No Warranty'),
        brandName: r.brandName || 'Intel Tech',
        categoryName: r.categoryName || 'General Hardware',
        categorySlug: r.categorySlug || 'hardware',
        categoryId: r.categoryId,
        imageUrl: imagesByProduct[r.id] || '/pos-assets/1_pos_logo.png',
      };

      // Populate Redis barcode cache asynchronously for future instant hits
      if (r.barcode) {
        posCache.set(`barcode:${r.barcode}`, itemObj, 3600).catch(() => {});
      }
      posCache.set(`sku:${r.sku}`, itemObj, 3600).catch(() => {});

      return itemObj;
    });

    // 5. Category counts & inventory summary (Cached with 60s TTL)
    let meta: Record<string, unknown> | null = null;
    if (includeMeta && !barcode) {
      const stopMetaTimer = profiler.start('meta_cache', 'Meta & Category Aggregation');
      const cachedMeta = await posCache.get<Record<string, unknown>>('catalog:meta:v1');
      if (cachedMeta) {
        meta = cachedMeta;
      } else {
        // Run aggregation query rather than scanning all product columns
        const catCounts = await db
          .select({
            categorySlug: categories.slug,
            categoryName: categories.name,
            count: sql<number>`count(${products.id})::int`,
          })
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .where(eq(products.status, 'active'))
          .groupBy(categories.slug, categories.name);

        meta = {
          categories: catCounts.map((c) => ({
            slug: c.categorySlug || 'hardware',
            name: c.categoryName || 'General Hardware',
            count: Number(c.count) || 0,
          })),
        };
        await posCache.set('catalog:meta:v1', meta, 60);
      }
      stopMetaTimer();
    }

    timerTotal();
    profiler.logSummary();

    const response = NextResponse.json({
      success: true,
      count: items.length,
      page,
      limit,
      products: items,
      ...(meta ? { meta } : {}),
      timestamp: new Date().toISOString(),
    });

    response.headers.set('Server-Timing', profiler.getServerTimingHeader());
    return response;
  } catch (error: any) {
    timerTotal();
    console.error('POS Products lookup failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch POS products' },
      { status: 500 }
    );
  }
}
