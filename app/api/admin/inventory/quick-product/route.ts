// app/api/admin/inventory/quick-product/route.ts
// Fast product registration endpoint when an unknown barcode is scanned in the warehouse

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products, brands, categories } from '@/db/schema/catalog';
import { inventoryMovements } from '@/db/schema/inventory';
import { auditLogs } from '@/db/schema/audit';
import { eq, or, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      sku,
      barcode,
      category = 'Electronics',
      brand = 'Generic',
      basePrice,
      costPrice,
      initialStock = 0,
      lowStockThreshold = 3,
      warrantyMonths = 12,
    } = body;

    if (!name || !basePrice) {
      return NextResponse.json(
        { success: false, error: 'Product name and retail price are required.' },
        { status: 400 }
      );
    }

    const cleanBarcode = barcode ? String(barcode).trim() : null;
    const cleanSku = sku ? String(sku).trim().toUpperCase() : `SKU-${Date.now().toString().slice(-6)}`;

    // Check if barcode or SKU already exists
    if (cleanBarcode) {
      const [existing] = await db
        .select()
        .from(products)
        .where(or(eq(products.barcode, cleanBarcode), eq(products.sku, cleanSku)))
        .limit(1);

      if (existing) {
        return NextResponse.json(
          { success: false, error: `Product already exists with this barcode or SKU ("${existing.name}").` },
          { status: 409 }
        );
      }
    }

    // Slug generation
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString().slice(-4)}`;

    // Resolve or find brand
    let brandId: number | null = null;
    const [existingBrand] = await db.select().from(brands).where(eq(brands.name, brand)).limit(1);
    if (existingBrand) {
      brandId = existingBrand.id;
    } else {
      const [newBrand] = await db
        .insert(brands)
        .values({
          name: brand,
          slug: `${brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`,
        })
        .returning();
      brandId = newBrand.id;
    }

    // Resolve or find category
    let categoryId: number | null = null;
    const [existingCat] = await db.select().from(categories).where(eq(categories.name, category)).limit(1);
    if (existingCat) {
      categoryId = existingCat.id;
    } else {
      const [newCat] = await db
        .insert(categories)
        .values({
          name: category,
          slug: `${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`,
        })
        .returning();
      categoryId = newCat.id;
    }

    const stockQty = parseInt(String(initialStock), 10) || 0;
    const priceNum = parseFloat(String(basePrice));
    const costNum = costPrice ? parseFloat(String(costPrice)) : priceNum * 0.75;

    const [newProduct] = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(products)
        .values({
          name,
          slug,
          sku: cleanSku,
          barcode: cleanBarcode,
          brandId,
          categoryId,
          basePrice: String(priceNum),
          costPrice: String(costNum),
          stockQuantity: stockQty,
          lowStockThreshold: parseInt(String(lowStockThreshold), 10) || 3,
          stockStatus: stockQty > 0 ? 'in_stock' : 'low_stock',
          warrantyMonths: parseInt(String(warrantyMonths), 10) || 12,
        })
        .returning();

      if (stockQty > 0) {
        await tx.insert(inventoryMovements).values({
          productId: inserted.id,
          productNameSnapshot: inserted.name,
          skuSnapshot: inserted.sku,
          quantityDelta: stockQty,
          quantityAfter: stockQty,
          reason: 'initial_stock',
          unitCostSnapshot: String(costNum),
          referenceNo: `INIT-${inserted.sku}`,
          note: `Initial opening inventory registered via barcode auto-detect: ${cleanBarcode || 'N/A'}`,
          performedByName: 'Storekeeper Barcode Auto-Detect',
        });
      }

      await tx.insert(auditLogs).values({
        action: 'catalog.product_created_from_barcode',
        entityType: 'product',
        entityId: inserted.id,
        metadata: {
          barcode: cleanBarcode,
          sku: cleanSku,
          name,
          price: priceNum,
          initialStock: stockQty,
        },
      });

      return [inserted];
    });

    return NextResponse.json({
      success: true,
      message: `Product "${newProduct.name}" registered successfully!`,
      product: newProduct,
    });
  } catch (error: any) {
    console.error('Quick product creation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
