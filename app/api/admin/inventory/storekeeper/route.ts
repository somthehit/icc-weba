import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema/catalog';
import { inventoryMovements } from '@/db/schema/inventory';
import { auditLogs } from '@/db/schema/audit';
import { eq, lte, or, sql, desc, and, gte } from 'drizzle-orm';

// GET: Storekeeper KPIs, Low-Stock Watchlist, and Recent Movements
export async function GET(request: NextRequest) {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Fetch products inventory health
    const allProducts = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        barcode: products.barcode,
        price: products.basePrice,
        costPrice: products.costPrice,
        stockQuantity: products.stockQuantity,
        lowStockThreshold: products.lowStockThreshold,
        stockStatus: products.stockStatus,
      })
      .from(products)
      .orderBy(products.stockQuantity);

    let totalActiveSkus = allProducts.length;
    let lowStockAlerts = 0;
    let outOfStockCount = 0;
    let totalInventoryValue = 0;

    const watchlist: typeof allProducts = [];

    for (const p of allProducts) {
      const stock = p.stockQuantity ?? 0;
      const threshold = p.lowStockThreshold ?? 5;
      const cost = Number(p.costPrice) || Number(p.price) * 0.75;
      totalInventoryValue += Math.max(0, stock) * cost;

      if (stock <= 0) {
        outOfStockCount++;
        watchlist.push(p);
      } else if (stock <= threshold) {
        lowStockAlerts++;
        watchlist.push(p);
      }
    }

    // 2. Count GRN (Goods Received) today from inventory movements
    const [grnToday] = await db
      .select({
        count: sql<number>`count(*)::int`,
        units: sql<number>`COALESCE(sum(${inventoryMovements.quantityDelta}), 0)::int`,
      })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.reason, 'supplier_restock'),
          gte(inventoryMovements.createdAt, todayStart)
        )
      );

    // 3. Fetch latest 20 inventory movements
    const recentMovements = await db
      .select({
        id: inventoryMovements.id,
        productName: inventoryMovements.productNameSnapshot,
        sku: inventoryMovements.skuSnapshot,
        quantityDelta: inventoryMovements.quantityDelta,
        quantityAfter: inventoryMovements.quantityAfter,
        reason: inventoryMovements.reason,
        referenceNo: inventoryMovements.referenceNo,
        note: inventoryMovements.note,
        performedByName: inventoryMovements.performedByName,
        createdAt: inventoryMovements.createdAt,
      })
      .from(inventoryMovements)
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(20);

    return NextResponse.json({
      success: true,
      kpis: {
        totalActiveSkus,
        lowStockAlerts,
        outOfStockCount,
        goodsReceivedTodayCount: grnToday?.count || 0,
        unitsReceivedToday: grnToday?.units || 0,
        totalInventoryValue: Math.round(totalInventoryValue),
      },
      watchlist: watchlist.slice(0, 50),
      recentMovements,
    });
  } catch (error: any) {
    console.error('Failed to load storekeeper inventory dashboard:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Storekeeper Stock Mutations (GRN, Damage/Loss, Physical Count Spot-Check)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // -------------------------------------------------------------------------
    // 1. RECEIVE STOCK (GOODS RECEIVED NOTE - GRN)
    // -------------------------------------------------------------------------
    if (action === 'grn') {
      const {
        productId,
        barcodeOrSku,
        quantityReceived,
        supplierInvoiceNo,
        unitCost,
        note = '',
        staffName = 'Storekeeper',
      } = body;

      const qty = parseInt(String(quantityReceived), 10);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json(
          { success: false, error: 'Received quantity must be a positive integer greater than 0.' },
          { status: 400 }
        );
      }

      // Find product
      let targetProduct = null;
      if (productId) {
        [targetProduct] = await db.select().from(products).where(eq(products.id, String(productId))).limit(1);
      } else if (barcodeOrSku) {
        const cleanIdentifier = String(barcodeOrSku).trim();
        [targetProduct] = await db
          .select()
          .from(products)
          .where(
            or(
              eq(products.barcode, cleanIdentifier),
              eq(products.sku, cleanIdentifier.toUpperCase())
            )
          )
          .limit(1);
      }

      if (!targetProduct) {
        return NextResponse.json(
          { success: false, error: `Product not found with identifier "${barcodeOrSku || productId}".` },
          { status: 404 }
        );
      }

      // Execute atomic transaction for inventory mutation
      const result = await db.transaction(async (tx) => {
        const prevStock = targetProduct.stockQuantity ?? 0;
        const newStock = prevStock + qty;
        const newStatus = newStock > (targetProduct.lowStockThreshold || 5) ? 'in_stock' : 'low_stock';

        // 1. Update product table
        await tx
          .update(products)
          .set({
            stockQuantity: newStock,
            stockStatus: newStatus,
            costPrice: unitCost ? String(unitCost) : targetProduct.costPrice,
            updatedAt: new Date(),
          })
          .where(eq(products.id, targetProduct.id));

        // 2. Append inventory movement record
        const [movement] = await tx
          .insert(inventoryMovements)
          .values({
            productId: targetProduct.id,
            productNameSnapshot: targetProduct.name,
            skuSnapshot: targetProduct.sku,
            quantityDelta: qty,
            quantityAfter: newStock,
            reason: 'supplier_restock',
            unitCostSnapshot: unitCost ? String(unitCost) : targetProduct.costPrice,
            referenceNo: supplierInvoiceNo || `GRN-${Date.now().toString().slice(-6)}`,
            note: note || `Inward GRN receipt of ${qty} units. Invoice: ${supplierInvoiceNo || 'N/A'}`,
            performedByName: staffName,
          })
          .returning();

        // 3. Audit log
        await tx.insert(auditLogs).values({
          action: 'inventory.stock_received',
          entityType: 'product',
          entityId: targetProduct.id,
          metadata: {
            actorName: staffName,
            sku: targetProduct.sku,
            productName: targetProduct.name,
            quantityReceived: qty,
            prevStock,
            newStock,
            invoice: supplierInvoiceNo,
          },
        });

        return { prevStock, newStock, movement };
      });

      return NextResponse.json({
        success: true,
        message: `Successfully received ${qty} units for "${targetProduct.name}". Stock updated: ${result.prevStock} → ${result.newStock}.`,
        product: {
          id: targetProduct.id,
          name: targetProduct.name,
          sku: targetProduct.sku,
          newStock: result.newStock,
        },
      });
    }

    // -------------------------------------------------------------------------
    // 2. LOG DAMAGE / LOSS / SHRINKAGE WRITE-OFF
    // -------------------------------------------------------------------------
    if (action === 'damage-loss') {
      const {
        productId,
        quantityDamaged,
        reason = 'damaged', // damaged, stolen, audit_correction
        referenceNo,
        note = '',
        staffName = 'Storekeeper',
      } = body;

      const qty = parseInt(String(quantityDamaged), 10);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json(
          { success: false, error: 'Write-off quantity must be a positive integer.' },
          { status: 400 }
        );
      }

      const [targetProduct] = await db.select().from(products).where(eq(products.id, String(productId))).limit(1);
      if (!targetProduct) {
        return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
      }

      const prevStock = targetProduct.stockQuantity ?? 0;
      if (prevStock < qty) {
        return NextResponse.json(
          { success: false, error: `Cannot write off ${qty} units: current on-hand stock is only ${prevStock}.` },
          { status: 400 }
        );
      }

      const result = await db.transaction(async (tx) => {
        const newStock = prevStock - qty;
        const newStatus = newStock <= 0 ? 'out_of_stock' : newStock <= (targetProduct.lowStockThreshold || 5) ? 'low_stock' : 'in_stock';

        await tx
          .update(products)
          .set({
            stockQuantity: newStock,
            stockStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(products.id, targetProduct.id));

        const mappedReason = reason === 'stolen' ? 'stolen' : 'damaged';

        const [movement] = await tx
          .insert(inventoryMovements)
          .values({
            productId: targetProduct.id,
            productNameSnapshot: targetProduct.name,
            skuSnapshot: targetProduct.sku,
            quantityDelta: -qty,
            quantityAfter: newStock,
            reason: mappedReason as any,
            unitCostSnapshot: targetProduct.costPrice,
            referenceNo: referenceNo || `DMG-${Date.now().toString().slice(-6)}`,
            note: note || `Damage/loss write-off: ${qty} units (${reason}).`,
            performedByName: staffName,
          })
          .returning();

        await tx.insert(auditLogs).values({
          action: 'inventory.damage_logged',
          entityType: 'product',
          entityId: targetProduct.id,
          metadata: {
            actorName: staffName,
            sku: targetProduct.sku,
            productName: targetProduct.name,
            quantityWrittenOff: qty,
            prevStock,
            newStock,
            reason,
            referenceNo,
          },
        });

        return { prevStock, newStock };
      });

      return NextResponse.json({
        success: true,
        message: `Logged ${qty} units of write-off for "${targetProduct.name}". Stock updated: ${result.prevStock} → ${result.newStock}.`,
      });
    }

    // -------------------------------------------------------------------------
    // 3. PHYSICAL INVENTORY SPOT-CHECK / AUDIT ADJUSTMENT
    // -------------------------------------------------------------------------
    if (action === 'spot-check-audit') {
      const {
        productId,
        physicalCount,
        note = '',
        staffName = 'Storekeeper',
      } = body;

      const physical = parseInt(String(physicalCount), 10);
      if (isNaN(physical) || physical < 0) {
        return NextResponse.json(
          { success: false, error: 'Physical count must be a non-negative integer (0 or greater).' },
          { status: 400 }
        );
      }

      const [targetProduct] = await db.select().from(products).where(eq(products.id, String(productId))).limit(1);
      if (!targetProduct) {
        return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
      }

      const prevStock = targetProduct.stockQuantity ?? 0;
      const variance = physical - prevStock;

      if (variance === 0) {
        return NextResponse.json({
          success: true,
          message: `Physical count matches system stock perfectly (${physical} units). No adjustment needed.`,
        });
      }

      const result = await db.transaction(async (tx) => {
        const newStatus = physical <= 0 ? 'out_of_stock' : physical <= (targetProduct.lowStockThreshold || 5) ? 'low_stock' : 'in_stock';

        await tx
          .update(products)
          .set({
            stockQuantity: physical,
            stockStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(products.id, targetProduct.id));

        await tx.insert(inventoryMovements).values({
          productId: targetProduct.id,
          productNameSnapshot: targetProduct.name,
          skuSnapshot: targetProduct.sku,
          quantityDelta: variance,
          quantityAfter: physical,
          reason: 'audit_correction',
          unitCostSnapshot: targetProduct.costPrice,
          referenceNo: `AUDIT-${Date.now().toString().slice(-6)}`,
          note: note || `Physical count adjustment (${variance > 0 ? '+' : ''}${variance} units). Prev: ${prevStock}, Physical: ${physical}.`,
          performedByName: staffName,
        });

        await tx.insert(auditLogs).values({
          action: 'inventory.spot_check_adjustment',
          entityType: 'product',
          entityId: targetProduct.id,
          metadata: {
            actorName: staffName,
            sku: targetProduct.sku,
            productName: targetProduct.name,
            prevStock,
            physicalCount: physical,
            variance,
          },
        });

        return { prevStock, newStock: physical, variance };
      });

      return NextResponse.json({
        success: true,
        message: `Inventory spot-check posted! "${targetProduct.name}" adjusted from ${result.prevStock} to ${result.newStock} (${result.variance > 0 ? '+' : ''}${result.variance} variance).`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Storekeeper Action Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
