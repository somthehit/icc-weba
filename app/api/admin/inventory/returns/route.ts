// app/api/admin/inventory/returns/route.ts
// Customer Returns & Return-to-Vendor (RTV / Debit Notes) API

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { stockReturns, stockReturnItems, productSerials } from '@/db/schema/warehouse-enterprise';
import { products } from '@/db/schema/catalog';
import { suppliers } from '@/db/schema/accounting';
import { inventoryMovements } from '@/db/schema/inventory';
import { auditLogs } from '@/db/schema/audit';
import { eq, desc } from 'drizzle-orm';

// GET: List returns
export async function GET(request: NextRequest) {
  try {
    const returnsList = await db
      .select({
        id: stockReturns.id,
        returnNumber: stockReturns.returnNumber,
        returnType: stockReturns.returnType,
        referenceInvoiceOrPo: stockReturns.referenceInvoiceOrPo,
        supplierId: stockReturns.supplierId,
        supplierName: suppliers.name,
        status: stockReturns.status,
        totalAmount: stockReturns.totalAmount,
        reason: stockReturns.reason,
        notes: stockReturns.notes,
        createdByName: stockReturns.createdByName,
        createdAt: stockReturns.createdAt,
      })
      .from(stockReturns)
      .leftJoin(suppliers, eq(stockReturns.supplierId, suppliers.id))
      .orderBy(desc(stockReturns.createdAt));

    const enriched = await Promise.all(
      returnsList.map(async (ret) => {
        const items = await db
          .select()
          .from(stockReturnItems)
          .where(eq(stockReturnItems.returnId, ret.id));

        return { ...ret, items };
      })
    );

    return NextResponse.json({
      success: true,
      returns: enriched,
    });
  } catch (error: any) {
    console.error('Failed to fetch returns:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Process Return (Customer Return or Vendor Debit Note)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      returnType = 'customer_return', // 'customer_return' | 'return_to_vendor'
      referenceInvoiceOrPo = '',
      supplierId,
      reason = 'Defective / Replacement',
      notes = '',
      items = [], // Array<{ productId, serialNumber, sku, quantity, unitCost, action: 'restock' | 'scrap_damage' | 'vendor_credit' }>
      createdByName = 'Storekeeper',
    } = body;

    if (!items.length) {
      return NextResponse.json({ success: false, error: 'At least one return line item is required.' }, { status: 400 });
    }

    const prefix = returnType === 'customer_return' ? 'RET' : 'RTV';
    const returnNumber = `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    let totalAmountNum = 0;
    const processedItems = items.map((i: any) => {
      const qty = parseInt(String(i.quantity), 10) || 1;
      const cost = parseFloat(String(i.unitCost)) || 0;
      totalAmountNum += qty * cost;
      return {
        productId: Number(i.productId),
        sku: i.sku || 'SKU',
        quantity: qty,
        unitCost: String(cost),
        action: i.action || (returnType === 'customer_return' ? 'restock' : 'vendor_credit'),
        notes: i.notes || '',
        serialNumber: i.serialNumber ? String(i.serialNumber).trim() : null,
      };
    });

    const result = await db.transaction(async (tx) => {
      const [record] = await tx
        .insert(stockReturns)
        .values({
          returnNumber,
          returnType: returnType as any,
          referenceInvoiceOrPo,
          supplierId: supplierId ? Number(supplierId) : null,
          status: 'completed',
          totalAmount: String(totalAmountNum),
          reason,
          notes,
          createdByName,
        })
        .returning();

      for (const item of processedItems) {
        let serialId: number | null = null;
        if (item.serialNumber) {
          const [s] = await tx
            .select()
            .from(productSerials)
            .where(eq(productSerials.serialNumber, item.serialNumber))
            .limit(1);
          if (s) serialId = s.id;
        }

        await tx.insert(stockReturnItems).values({
          returnId: record.id,
          productId: item.productId,
          serialId,
          sku: item.sku,
          quantity: item.quantity,
          unitCost: item.unitCost,
          action: item.action as any,
          notes: item.notes,
        });

        // Stock and Serial Effect
        const [prod] = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);

        if (prod) {
          if (item.action === 'restock') {
            // Re-increment stock
            const prevStock = prod.stockQuantity ?? 0;
            const newStock = prevStock + item.quantity;
            await tx
              .update(products)
              .set({ stockQuantity: newStock, updatedAt: new Date() })
              .where(eq(products.id, prod.id));

            await tx.insert(inventoryMovements).values({
              productId: prod.id,
              productNameSnapshot: prod.name,
              skuSnapshot: prod.sku,
              quantityDelta: item.quantity,
              quantityAfter: newStock,
              reason: 'customer_return',
              referenceNo: returnNumber,
              note: `Customer Return Restock: Ref ${referenceInvoiceOrPo}`,
              performedByName: createdByName,
            });

            if (serialId) {
              await tx
                .update(productSerials)
                .set({ status: 'in_stock', updatedAt: new Date() })
                .where(eq(productSerials.id, serialId));
            }
          } else if (item.action === 'vendor_credit') {
            // Deduct stock (sent back to supplier)
            const prevStock = prod.stockQuantity ?? 0;
            const newStock = Math.max(0, prevStock - item.quantity);
            await tx
              .update(products)
              .set({ stockQuantity: newStock, updatedAt: new Date() })
              .where(eq(products.id, prod.id));

            await tx.insert(inventoryMovements).values({
              productId: prod.id,
              productNameSnapshot: prod.name,
              skuSnapshot: prod.sku,
              quantityDelta: -item.quantity,
              quantityAfter: newStock,
              reason: 'damaged',
              referenceNo: returnNumber,
              note: `Return-to-Vendor Debit Note: ${reason}`,
              performedByName: createdByName,
            });

            if (serialId) {
              await tx
                .update(productSerials)
                .set({ status: 'rma_vendor', updatedAt: new Date() })
                .where(eq(productSerials.id, serialId));
            }
          }
        }
      }

      await tx.insert(auditLogs).values({
        action: 'inventory.return_processed',
        entityType: 'stock_return',
        entityId: record.id,
        metadata: { returnNumber, returnType, totalAmountNum, createdByName },
      });

      return record;
    });

    return NextResponse.json({
      success: true,
      message: `${returnType === 'customer_return' ? 'Customer Return' : 'Vendor Debit Note'} ${returnNumber} processed successfully!`,
      returnRecord: result,
    });
  } catch (error: any) {
    console.error('Failed to process return:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
