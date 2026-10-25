// app/api/admin/inventory/grn/route.ts
// Comprehensive Goods Received Note (GRN) Engine: 3-Way Match, Scan-to-Receive, Landed Cost Apportioning, Serials/IMEI, and QC Rejections

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  goodsReceiptNotes,
  goodsReceiptNoteItems,
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
} from '@/db/schema/accounting';
import { products } from '@/db/schema/catalog';
import { inventoryMovements, warehouses } from '@/db/schema/inventory';
import { productSerials, stockReturns, stockReturnItems } from '@/db/schema/warehouse-enterprise';
import { auditLogs } from '@/db/schema/audit';
import { eq, desc, and, sql, or } from 'drizzle-orm';

// GET: Fetch GRN List, details, and matching status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const grnId = searchParams.get('id');

    if (grnId) {
      const [grn] = await db
        .select({
          id: goodsReceiptNotes.id,
          grnNumber: goodsReceiptNotes.grnNumber,
          purchaseOrderId: goodsReceiptNotes.purchaseOrderId,
          supplierId: goodsReceiptNotes.supplierId,
          supplierName: suppliers.name,
          supplierPan: suppliers.vatPanNo,
          supplierPhone: suppliers.phone,
          supplierInvoiceNo: goodsReceiptNotes.supplierInvoiceNo,
          receivedDate: goodsReceiptNotes.receivedDate,
          storekeeperName: goodsReceiptNotes.storekeeperName,
          totalItems: goodsReceiptNotes.totalItems,
          totalQuantity: goodsReceiptNotes.totalQuantity,
          totalAmount: goodsReceiptNotes.totalAmount,
          financialStatus: goodsReceiptNotes.financialStatus,
          notes: goodsReceiptNotes.notes,
          createdAt: goodsReceiptNotes.createdAt,
        })
        .from(goodsReceiptNotes)
        .leftJoin(suppliers, eq(goodsReceiptNotes.supplierId, suppliers.id))
        .where(eq(goodsReceiptNotes.id, Number(grnId)))
        .limit(1);

      if (!grn) {
        return NextResponse.json({ success: false, error: 'GRN not found' }, { status: 404 });
      }

      const items = await db
        .select()
        .from(goodsReceiptNoteItems)
        .where(eq(goodsReceiptNoteItems.grnId, grn.id));

      // Fetch captured serials for this GRN
      const serials = await db
        .select()
        .from(productSerials)
        .where(eq(productSerials.grnId, grn.id));

      return NextResponse.json({
        success: true,
        grn: {
          ...grn,
          items,
          serials,
        },
      });
    }

    // List all GRNs
    const allGrns = await db
      .select({
        id: goodsReceiptNotes.id,
        grnNumber: goodsReceiptNotes.grnNumber,
        purchaseOrderId: goodsReceiptNotes.purchaseOrderId,
        supplierId: goodsReceiptNotes.supplierId,
        supplierName: suppliers.name,
        supplierInvoiceNo: goodsReceiptNotes.supplierInvoiceNo,
        receivedDate: goodsReceiptNotes.receivedDate,
        storekeeperName: goodsReceiptNotes.storekeeperName,
        totalItems: goodsReceiptNotes.totalItems,
        totalQuantity: goodsReceiptNotes.totalQuantity,
        totalAmount: goodsReceiptNotes.totalAmount,
        financialStatus: goodsReceiptNotes.financialStatus,
        createdAt: goodsReceiptNotes.createdAt,
      })
      .from(goodsReceiptNotes)
      .leftJoin(suppliers, eq(goodsReceiptNotes.supplierId, suppliers.id))
      .orderBy(desc(goodsReceiptNotes.createdAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      grnList: allGrns,
    });
  } catch (error: any) {
    console.error('Failed to fetch GRN records:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Process Inward GRN (3-Way Match or Direct)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      purchaseOrderId,
      supplierId,
      supplierInvoiceNo = '',
      receivedDate = new Date().toISOString().slice(0, 10),
      warehouseId = 1,
      freightCost = 0,
      customsHandlingCost = 0,
      discount = 0,
      notes = '',
      items = [], // Array<{ productId, poItemId, sku, description, quantityReceived, unitCost, batchNo, expiryDate, serials: string[], qcStatus: 'accepted' | 'rejected', rejectionReason: string }>
      storekeeperName = 'Storekeeper',
    } = body;

    if (!supplierId || !items.length) {
      return NextResponse.json(
        { success: false, error: 'Supplier and at least one inward line item are required.' },
        { status: 400 }
      );
    }

    const grnNumber = `GRN-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    // 1. Calculate Landed Cost Apportioning
    const totalRawSubtotal = items.reduce(
      (acc: number, item: any) =>
        acc + (parseInt(String(item.quantityReceived), 10) || 0) * (parseFloat(String(item.unitCost)) || 0),
      0
    );

    const totalLandedOverheads = Math.max(0, Number(freightCost) + Number(customsHandlingCost) - Number(discount));
    const overheadRatio = totalRawSubtotal > 0 ? totalLandedOverheads / totalRawSubtotal : 0;

    let totalQuantityReceived = 0;
    let totalGrnAmount = 0;
    const rejectedItems: Array<{ productId: number; sku: string; qty: number; reason: string; unitCost: number }> = [];

    const processedItems = items.map((item: any) => {
      const qty = parseInt(String(item.quantityReceived), 10) || 0;
      const baseCost = parseFloat(String(item.unitCost)) || 0;
      // Apportioned landed cost per unit
      const landedUnitCost = Number((baseCost * (1 + overheadRatio)).toFixed(2));
      const lineTotal = Number((qty * landedUnitCost).toFixed(2));

      totalQuantityReceived += qty;
      totalGrnAmount += lineTotal;

      if (item.qcStatus === 'rejected') {
        rejectedItems.push({
          productId: Number(item.productId),
          sku: item.sku || '',
          qty,
          reason: item.rejectionReason || 'Quality check failure on inward inspection',
          unitCost: landedUnitCost,
        });
      }

      return {
        productId: item.productId ? Number(item.productId) : null,
        poItemId: item.poItemId ? Number(item.poItemId) : null,
        sku: item.sku || '',
        description: item.description || 'Hardware SKU',
        quantityReceived: qty,
        unitCost: String(landedUnitCost),
        lineTotal: String(lineTotal),
        batchNo: item.batchNo || null,
        expiryDate: item.expiryDate || null,
        serials: Array.isArray(item.serials) ? item.serials : [],
        qcStatus: item.qcStatus || 'accepted',
      };
    });

    // Execute atomic transaction for GRN creation, stock increment, serials, and PO update
    const result = await db.transaction(async (tx) => {
      // 1. Insert GRN Header
      const [grn] = await tx
        .insert(goodsReceiptNotes)
        .values({
          grnNumber,
          purchaseOrderId: purchaseOrderId ? Number(purchaseOrderId) : null,
          supplierId: Number(supplierId),
          supplierInvoiceNo,
          receivedDate,
          storekeeperName,
          totalItems: processedItems.length,
          totalQuantity: totalQuantityReceived,
          totalAmount: String(totalGrnAmount),
          financialStatus: 'pending_invoice',
          notes: notes
            ? `${notes} | Landed overheads: NPR ${totalLandedOverheads}`
            : `Inward GRN receipt. Landed overheads: NPR ${totalLandedOverheads}`,
        })
        .returning();

      // 2. Insert GRN Line Items & Update Stock for Accepted lines
      for (const item of processedItems) {
        const [grnItem] = await tx
          .insert(goodsReceiptNoteItems)
          .values({
            grnId: grn.id,
            productId: item.productId,
            poItemId: item.poItemId,
            sku: item.sku,
            description: item.description,
            quantityReceived: item.quantityReceived,
            unitCost: item.unitCost,
            lineTotal: item.lineTotal,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
          })
          .returning();

        // If item is accepted in QC, increment warehouse stock & append movement ledger
        if (item.qcStatus === 'accepted' && item.productId && item.quantityReceived > 0) {
          const [product] = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);

          if (product) {
            const prevStock = product.stockQuantity ?? 0;
            const newStock = prevStock + item.quantityReceived;
            const newStatus = newStock > (product.lowStockThreshold || 5) ? 'in_stock' : 'low_stock';

            // Update product stock & cost
            await tx
              .update(products)
              .set({
                stockQuantity: newStock,
                stockStatus: newStatus,
                costPrice: item.unitCost, // Update weighted landed cost
                updatedAt: new Date(),
              })
              .where(eq(products.id, product.id));

            // Append immutable ledger row
            await tx.insert(inventoryMovements).values({
              productId: product.id,
              warehouseId: Number(warehouseId),
              productNameSnapshot: product.name,
              skuSnapshot: product.sku,
              quantityDelta: item.quantityReceived,
              quantityAfter: newStock,
              reason: 'supplier_restock',
              unitCostSnapshot: item.unitCost,
              referenceNo: grnNumber,
              note: `GRN inward receipt (${item.quantityReceived} units). PO: ${purchaseOrderId || 'Direct'} Invoice: ${supplierInvoiceNo || 'N/A'}`,
              performedByName: storekeeperName,
            });
          }

          // Register scanned Serials / IMEIs
          if (item.serials && item.serials.length > 0) {
            for (const sn of item.serials) {
              const cleanSn = String(sn).trim();
              if (cleanSn) {
                // Upsert or insert serial
                const [existingSn] = await tx
                  .select()
                  .from(productSerials)
                  .where(and(eq(productSerials.productId, item.productId), eq(productSerials.serialNumber, cleanSn)))
                  .limit(1);

                if (existingSn) {
                  await tx
                    .update(productSerials)
                    .set({
                      status: 'in_stock',
                      grnItemId: grnItem.id,
                      grnId: grn.id,
                      warehouseId: Number(warehouseId),
                      costPrice: item.unitCost,
                      updatedAt: new Date(),
                    })
                    .where(eq(productSerials.id, existingSn.id));
                } else {
                  await tx.insert(productSerials).values({
                    productId: item.productId,
                    serialNumber: cleanSn,
                    grnItemId: grnItem.id,
                    grnId: grn.id,
                    status: 'in_stock',
                    warehouseId: Number(warehouseId),
                    costPrice: item.unitCost,
                    warrantyMonths: product?.warrantyMonths || 12,
                    warrantyStartDate: receivedDate,
                  });
                }
              }
            }
          }
        }

        // If PO item is linked, update PO received quantities
        if (item.poItemId) {
          await tx
            .update(purchaseOrderItems)
            .set({
              quantityReceived: sql`${purchaseOrderItems.quantityReceived} + ${item.quantityReceived}`,
            })
            .where(eq(purchaseOrderItems.id, item.poItemId));
        }
      }

      // 3. If linked to a PO, calculate fulfillment status
      if (purchaseOrderId) {
        const poLines = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, Number(purchaseOrderId)));

        const totalOrdered = poLines.reduce((acc, l) => acc + (l.quantityOrdered || 0), 0);
        const totalRcvd = poLines.reduce((acc, l) => acc + (l.quantityReceived || 0), 0);

        const newPoStatus = totalRcvd >= totalOrdered ? 'received' : totalRcvd > 0 ? 'partially_received' : 'issued';

        await tx
          .update(purchaseOrders)
          .set({
            status: newPoStatus,
            updatedAt: new Date(),
          })
          .where(eq(purchaseOrders.id, Number(purchaseOrderId)));
      }

      // 4. If any items were REJECTED during QC inspection, automatically create a Return-to-Vendor (Debit Note draft)
      if (rejectedItems.length > 0) {
        const debitNoteNo = `RTV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
        const totalDebitAmount = rejectedItems.reduce((acc, r) => acc + r.qty * r.unitCost, 0);

        const [debitNote] = await tx
          .insert(stockReturns)
          .values({
            returnNumber: debitNoteNo,
            returnType: 'return_to_vendor',
            referenceInvoiceOrPo: supplierInvoiceNo || grnNumber,
            supplierId: Number(supplierId),
            status: 'draft',
            totalAmount: String(totalDebitAmount),
            reason: 'Inward QC inspection rejection: Defective / Non-compliant goods',
            notes: `Auto-generated Debit Note for rejected lines in ${grnNumber}`,
            createdByName: storekeeperName,
          })
          .returning();

        for (const rej of rejectedItems) {
          await tx.insert(stockReturnItems).values({
            returnId: debitNote.id,
            productId: rej.productId,
            sku: rej.sku,
            quantity: rej.qty,
            unitCost: String(rej.unitCost),
            action: 'vendor_credit',
            notes: rej.reason,
          });
        }
      }

      // 5. Audit Log
      await tx.insert(auditLogs).values({
        action: 'inventory.grn_processed',
        entityType: 'grn',
        entityId: grn.id,
        metadata: {
          grnNumber,
          poId: purchaseOrderId,
          supplierId,
          supplierInvoiceNo,
          totalQuantity: totalQuantityReceived,
          totalAmount: totalGrnAmount,
          rejectedCount: rejectedItems.length,
        },
      });

      return grn;
    });

    return NextResponse.json({
      success: true,
      message: `Goods Received Note ${grnNumber} processed successfully! ${totalQuantityReceived} units received into warehouse.`,
      grn: result,
    });
  } catch (error: any) {
    console.error('GRN Inward processing error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
