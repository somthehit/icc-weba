import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { purchaseOrders, purchaseOrderItems, suppliers } from '@/db/schema/accounting';
import { products } from '@/db/schema/catalog';
import { inventoryMovements } from '@/db/schema/inventory';
import { desc, eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const poList = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        supplierId: purchaseOrders.supplierId,
        orderDate: purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        subtotal: purchaseOrders.subtotal,
        vatAmount: purchaseOrders.vatAmount,
        totalAmount: purchaseOrders.totalAmount,
        status: purchaseOrders.status,
        paymentTerms: purchaseOrders.paymentTerms,
        notes: purchaseOrders.notes,
        createdByName: purchaseOrders.createdByName,
        createdAt: purchaseOrders.createdAt,
        supplierName: suppliers.name,
        supplierPan: suppliers.vatPanNo,
        supplierPhone: suppliers.phone,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .orderBy(desc(purchaseOrders.createdAt));

    const posWithItems = await Promise.all(
      poList.map(async (po) => {
        const items = await db
          .select({
            id: purchaseOrderItems.id,
            productId: purchaseOrderItems.productId,
            sku: purchaseOrderItems.sku,
            description: purchaseOrderItems.description,
            quantityOrdered: purchaseOrderItems.quantityOrdered,
            quantityReceived: purchaseOrderItems.quantityReceived,
            unitCost: purchaseOrderItems.unitCost,
            lineTotal: purchaseOrderItems.lineTotal,
          })
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, po.id));

        return {
          ...po,
          items,
          totalItemsCount: items.length,
          totalUnitsOrdered: items.reduce((acc, it) => acc + (it.quantityOrdered || 0), 0),
          totalUnitsReceived: items.reduce((acc, it) => acc + (it.quantityReceived || 0), 0),
        };
      })
    );

    return NextResponse.json({
      success: true,
      purchaseOrders: posWithItems,
    });
  } catch (error: any) {
    console.error('Purchase Orders GET Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch purchase orders',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      supplierId,
      orderDate,
      expectedDeliveryDate,
      paymentTerms,
      notes,
      createdByName,
      items,
    } = body;

    if (!supplierId) {
      return NextResponse.json({ success: false, error: 'Supplier is required' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one line item is required' }, { status: 400 });
    }

    // Generate PO Number (PO-2026-XXXX)
    const countRes = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseOrders);
    const nextNum = (countRes[0]?.count || 0) + 1;
    const poNumber = `PO-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

    let subtotal = 0;
    for (const it of items) {
      const qty = Math.max(1, Number(it.quantityOrdered) || 1);
      const cost = Number(it.unitCost) || 0;
      subtotal += qty * cost;
    }

    const vatAmount = subtotal * 0.13;
    const totalAmount = subtotal + vatAmount;

    const [newPo] = await db
      .insert(purchaseOrders)
      .values({
        poNumber,
        supplierId: Number(supplierId),
        orderDate: orderDate || new Date().toISOString().slice(0, 10),
        expectedDeliveryDate: expectedDeliveryDate || null,
        subtotal: subtotal.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        status: 'draft',
        paymentTerms: paymentTerms || 'Net 30 Days',
        notes: notes || null,
        createdByName: createdByName || 'Accounting Manager',
      })
      .returning();

    // Insert PO Items
    for (const it of items) {
      const qty = Math.max(1, Number(it.quantityOrdered) || 1);
      const cost = Number(it.unitCost) || 0;
      await db.insert(purchaseOrderItems).values({
        purchaseOrderId: newPo.id,
        productId: it.productId ? Number(it.productId) : null,
        sku: it.sku || null,
        description: it.description || 'Procured item',
        quantityOrdered: qty,
        quantityReceived: 0,
        unitCost: cost.toFixed(2),
        lineTotal: (qty * cost).toFixed(2),
      });
    }

    return NextResponse.json({
      success: true,
      purchaseOrder: newPo,
      poNumber,
    });
  } catch (error: any) {
    console.error('Purchase Orders POST Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create purchase order',
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, status, itemsReceived, performedByName } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'PO ID is required' }, { status: 400 });
    }

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, Number(id))).limit(1);
    if (!po) {
      return NextResponse.json({ success: false, error: 'Purchase Order not found' }, { status: 404 });
    }

    if (action === 'update_status' && status) {
      const [updated] = await db
        .update(purchaseOrders)
        .set({ status, updatedAt: new Date() })
        .where(eq(purchaseOrders.id, Number(id)))
        .returning();

      return NextResponse.json({ success: true, purchaseOrder: updated });
    }

    if (action === 'receive_items' && Array.isArray(itemsReceived)) {
      let fullyReceived = true;

      for (const rec of itemsReceived) {
        const itemId = Number(rec.itemId);
        const qtyToReceive = Number(rec.quantityReceived) || 0;

        if (qtyToReceive > 0) {
          const [poItem] = await db
            .select()
            .from(purchaseOrderItems)
            .where(eq(purchaseOrderItems.id, itemId))
            .limit(1);

          if (poItem) {
            const newReceived = (poItem.quantityReceived || 0) + qtyToReceive;
            await db
              .update(purchaseOrderItems)
              .set({ quantityReceived: newReceived })
              .where(eq(purchaseOrderItems.id, itemId));

            if (newReceived < poItem.quantityOrdered) {
              fullyReceived = false;
            }

            // Sync with inventory and products stock if productId is linked!
            if (poItem.productId) {
              const [prod] = await db
                .select()
                .from(products)
                .where(eq(products.id, poItem.productId))
                .limit(1);

              if (prod) {
                const currentStock = prod.stockQuantity || 0;
                const newStock = currentStock + qtyToReceive;

                await db
                  .update(products)
                  .set({
                    stockQuantity: newStock,
                    stockStatus: newStock > 0 ? 'in_stock' : 'out_of_stock',
                    updatedAt: new Date(),
                  })
                  .where(eq(products.id, poItem.productId));

                // Log inventory movement
                try {
                  await db.insert(inventoryMovements).values({
                    productId: prod.id,
                    productNameSnapshot: prod.name,
                    skuSnapshot: prod.sku || 'SKU-PO',
                    quantityDelta: qtyToReceive,
                    quantityAfter: newStock,
                    reason: 'supplier_restock',
                    referenceNo: po.poNumber,
                    note: `Received from ${po.poNumber} by ${performedByName || 'Accountant/Storekeeper'}`,
                    unitCostSnapshot: poItem.unitCost,
                    performedByName: performedByName || 'Accounting Manager',
                  });
                } catch (movErr) {
                  console.warn('Could not record inventory movement:', movErr);
                }
              }
            }
          }
        }
      }

      const newStatus = fullyReceived ? 'received' : 'partially_received';
      const [updatedPo] = await db
        .update(purchaseOrders)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(purchaseOrders.id, Number(id)))
        .returning();

      return NextResponse.json({
        success: true,
        purchaseOrder: updatedPo,
        status: newStatus,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action specified' }, { status: 400 });
  } catch (error: any) {
    console.error('Purchase Orders PATCH Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update purchase order',
    }, { status: 500 });
  }
}
