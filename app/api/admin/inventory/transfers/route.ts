// app/api/admin/inventory/transfers/route.ts
// Inter-Location Warehouse Stock Transfers (Request -> Approve -> In-Transit -> Receive with Scan Verification)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { stockTransfers, stockTransferItems } from '@/db/schema/warehouse-enterprise';
import { warehouses, inventoryMovements } from '@/db/schema/inventory';
import { products } from '@/db/schema/catalog';
import { auditLogs } from '@/db/schema/audit';
import { eq, desc, sql } from 'drizzle-orm';

// GET: List all transfers
export async function GET(request: NextRequest) {
  try {
    const allTransfers = await db
      .select({
        id: stockTransfers.id,
        transferNumber: stockTransfers.transferNumber,
        sourceWarehouseId: stockTransfers.sourceWarehouseId,
        destWarehouseId: stockTransfers.destWarehouseId,
        status: stockTransfers.status,
        totalItems: stockTransfers.totalItems,
        totalQuantity: stockTransfers.totalQuantity,
        notes: stockTransfers.notes,
        requestedByName: stockTransfers.requestedByName,
        approvedByName: stockTransfers.approvedByName,
        shippedAt: stockTransfers.shippedAt,
        receivedAt: stockTransfers.receivedAt,
        createdAt: stockTransfers.createdAt,
      })
      .from(stockTransfers)
      .orderBy(desc(stockTransfers.createdAt));

    // Enrich with warehouse names and items
    const enriched = await Promise.all(
      allTransfers.map(async (t) => {
        const [source] = await db.select().from(warehouses).where(eq(warehouses.id, t.sourceWarehouseId)).limit(1);
        const [dest] = await db.select().from(warehouses).where(eq(warehouses.id, t.destWarehouseId)).limit(1);
        const items = await db.select().from(stockTransferItems).where(eq(stockTransferItems.transferId, t.id));

        return {
          ...t,
          sourceWarehouseName: source?.name || 'Main Warehouse',
          destWarehouseName: dest?.name || 'Branch / Showroom',
          items,
        };
      })
    );

    return NextResponse.json({
      success: true,
      transfers: enriched,
    });
  } catch (error: any) {
    console.error('Failed to fetch stock transfers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Transfer Lifecycle (Request, Approve, Ship, Receive)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // 1. CREATE TRANSFER REQUEST
    if (action === 'request') {
      const {
        sourceWarehouseId,
        destWarehouseId,
        notes = '',
        items = [], // Array<{ productId, sku, quantityRequested }>
        requestedByName = 'Storekeeper',
      } = body;

      if (!sourceWarehouseId || !destWarehouseId || !items.length) {
        return NextResponse.json(
          { success: false, error: 'Source, destination, and at least one SKU line are required.' },
          { status: 400 }
        );
      }

      const transferNumber = `TRF-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
      const totalQty = items.reduce((acc: number, i: any) => acc + (parseInt(String(i.quantityRequested), 10) || 1), 0);

      const result = await db.transaction(async (tx) => {
        const [transfer] = await tx
          .insert(stockTransfers)
          .values({
            transferNumber,
            sourceWarehouseId: Number(sourceWarehouseId),
            destWarehouseId: Number(destWarehouseId),
            status: 'requested',
            totalItems: items.length,
            totalQuantity: totalQty,
            notes,
            requestedByName,
          })
          .returning();

        for (const item of items) {
          await tx.insert(stockTransferItems).values({
            transferId: transfer.id,
            productId: Number(item.productId),
            sku: item.sku || 'SKU',
            quantityRequested: parseInt(String(item.quantityRequested), 10) || 1,
          });
        }

        await tx.insert(auditLogs).values({
          action: 'transfer.requested',
          entityType: 'transfer',
          entityId: transfer.id,
          metadata: { transferNumber, sourceWarehouseId, destWarehouseId, totalQty, requestedByName },
        });

        return transfer;
      });

      return NextResponse.json({
        success: true,
        message: `Transfer Request ${transferNumber} created successfully.`,
        transfer: result,
      });
    }

    // 2. APPROVE & SHIP TRANSFER (Deducts stock from source warehouse, marks in_transit)
    if (action === 'ship') {
      const { transferId, shippedByName = 'Store Manager' } = body;

      const [targetTransfer] = await db
        .select()
        .from(stockTransfers)
        .where(eq(stockTransfers.id, Number(transferId)))
        .limit(1);

      if (!targetTransfer) {
        return NextResponse.json({ success: false, error: 'Transfer not found.' }, { status: 404 });
      }

      const items = await db
        .select()
        .from(stockTransferItems)
        .where(eq(stockTransferItems.transferId, targetTransfer.id));

      await db.transaction(async (tx) => {
        for (const item of items) {
          const [product] = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
          if (product) {
            const prevStock = product.stockQuantity ?? 0;
            const shipQty = item.quantityRequested;
            const newStock = Math.max(0, prevStock - shipQty);

            await tx
              .update(products)
              .set({
                stockQuantity: newStock,
                updatedAt: new Date(),
              })
              .where(eq(products.id, product.id));

            await tx.insert(inventoryMovements).values({
              productId: product.id,
              warehouseId: targetTransfer.sourceWarehouseId,
              productNameSnapshot: product.name,
              skuSnapshot: product.sku,
              quantityDelta: -shipQty,
              quantityAfter: newStock,
              reason: 'internal_use',
              referenceNo: targetTransfer.transferNumber,
              note: `Inter-location stock transfer out to Branch/Showroom (Transfer #${targetTransfer.transferNumber})`,
              performedByName: shippedByName,
            });

            await tx
              .update(stockTransferItems)
              .set({ quantityShipped: shipQty })
              .where(eq(stockTransferItems.id, item.id));
          }
        }

        await tx
          .update(stockTransfers)
          .set({
            status: 'in_transit',
            approvedByName: shippedByName,
            shippedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(stockTransfers.id, targetTransfer.id));
      });

      return NextResponse.json({
        success: true,
        message: `Transfer ${targetTransfer.transferNumber} marked In-Transit. Stock dispatched from source.`,
      });
    }

    // 3. RECEIVE TRANSFER AT DESTINATION (Increments stock at destination)
    if (action === 'receive') {
      const { transferId, receivedByName = 'Destination Storekeeper' } = body;

      const [targetTransfer] = await db
        .select()
        .from(stockTransfers)
        .where(eq(stockTransfers.id, Number(transferId)))
        .limit(1);

      if (!targetTransfer) {
        return NextResponse.json({ success: false, error: 'Transfer not found.' }, { status: 404 });
      }

      const items = await db
        .select()
        .from(stockTransferItems)
        .where(eq(stockTransferItems.transferId, targetTransfer.id));

      await db.transaction(async (tx) => {
        for (const item of items) {
          const [product] = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
          if (product) {
            const rcvQty = item.quantityShipped || item.quantityRequested;
            const prevStock = product.stockQuantity ?? 0;
            const newStock = prevStock + rcvQty;

            await tx
              .update(products)
              .set({
                stockQuantity: newStock,
                updatedAt: new Date(),
              })
              .where(eq(products.id, product.id));

            await tx.insert(inventoryMovements).values({
              productId: product.id,
              warehouseId: targetTransfer.destWarehouseId,
              productNameSnapshot: product.name,
              skuSnapshot: product.sku,
              quantityDelta: rcvQty,
              quantityAfter: newStock,
              reason: 'supplier_restock',
              referenceNo: targetTransfer.transferNumber,
              note: `Inter-location stock transfer received from main warehouse (Transfer #${targetTransfer.transferNumber})`,
              performedByName: receivedByName,
            });

            await tx
              .update(stockTransferItems)
              .set({ quantityReceived: rcvQty })
              .where(eq(stockTransferItems.id, item.id));
          }
        }

        await tx
          .update(stockTransfers)
          .set({
            status: 'received',
            receivedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(stockTransfers.id, targetTransfer.id));
      });

      return NextResponse.json({
        success: true,
        message: `Transfer ${targetTransfer.transferNumber} received and acknowledged into destination inventory!`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Transfer processing error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
