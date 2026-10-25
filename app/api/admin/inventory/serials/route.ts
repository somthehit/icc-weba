// app/api/admin/inventory/serials/route.ts
// Product Serial / IMEI Lookup & Full Lifecycle History (GRN -> Sale -> Return -> Warranty RMA)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { productSerials, warehouseBins, warrantyClaims } from '@/db/schema/warehouse-enterprise';
import { products } from '@/db/schema/catalog';
import { goodsReceiptNotes } from '@/db/schema/accounting';
import { warehouses } from '@/db/schema/inventory';
import { auditLogs } from '@/db/schema/audit';
import { eq, or, desc, ilike } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const productId = searchParams.get('productId');
    const status = searchParams.get('status');

    if (query) {
      // Find specific serial number
      const serialResults = await db
        .select({
          id: productSerials.id,
          productId: productSerials.productId,
          productName: products.name,
          sku: products.sku,
          barcode: products.barcode,
          serialNumber: productSerials.serialNumber,
          status: productSerials.status,
          warehouseId: productSerials.warehouseId,
          warehouseName: warehouses.name,
          binId: productSerials.binId,
          binCode: warehouseBins.code,
          costPrice: productSerials.costPrice,
          sellingPrice: productSerials.sellingPrice,
          warrantyMonths: productSerials.warrantyMonths,
          warrantyStartDate: productSerials.warrantyStartDate,
          warrantyEndDate: productSerials.warrantyEndDate,
          soldInvoiceNo: productSerials.soldInvoiceNo,
          soldDate: productSerials.soldDate,
          notes: productSerials.notes,
          createdAt: productSerials.createdAt,
          grnNumber: goodsReceiptNotes.grnNumber,
          grnDate: goodsReceiptNotes.receivedDate,
        })
        .from(productSerials)
        .leftJoin(products, eq(productSerials.productId, products.id))
        .leftJoin(warehouses, eq(productSerials.warehouseId, warehouses.id))
        .leftJoin(warehouseBins, eq(productSerials.binId, warehouseBins.id))
        .leftJoin(goodsReceiptNotes, eq(productSerials.grnId, goodsReceiptNotes.id))
        .where(
          or(
            ilike(productSerials.serialNumber, `%${query}%`),
            ilike(products.sku, `%${query}%`),
            ilike(products.name, `%${query}%`),
            eq(productSerials.soldInvoiceNo, query)
          )
        )
        .limit(25);

      // Attach warranty claims if a single serial is matched
      const enriched = await Promise.all(
        serialResults.map(async (item) => {
          const claims = await db
            .select()
            .from(warrantyClaims)
            .where(eq(warrantyClaims.serialId, item.id))
            .orderBy(desc(warrantyClaims.createdAt));

          return {
            ...item,
            warrantyClaims: claims,
          };
        })
      );

      return NextResponse.json({
        success: true,
        serials: enriched,
      });
    }

    // Filter by product or status
    const allSerials = await db
      .select({
        id: productSerials.id,
        productId: productSerials.productId,
        productName: products.name,
        sku: products.sku,
        serialNumber: productSerials.serialNumber,
        status: productSerials.status,
        warehouseName: warehouses.name,
        binCode: warehouseBins.code,
        costPrice: productSerials.costPrice,
        warrantyMonths: productSerials.warrantyMonths,
        warrantyEndDate: productSerials.warrantyEndDate,
        soldInvoiceNo: productSerials.soldInvoiceNo,
        createdAt: productSerials.createdAt,
      })
      .from(productSerials)
      .leftJoin(products, eq(productSerials.productId, products.id))
      .leftJoin(warehouses, eq(productSerials.warehouseId, warehouses.id))
      .leftJoin(warehouseBins, eq(productSerials.binId, warehouseBins.id))
      .orderBy(desc(productSerials.createdAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      serials: allSerials,
    });
  } catch (error: any) {
    console.error('Failed to lookup serials:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
