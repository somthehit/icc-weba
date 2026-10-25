// app/api/admin/inventory/alerts/route.ts
// Real-time Inventory Alerts: Low Stock, Out of Stock, PO Overdue, Negative Stock Attempt, Expiring Warranties

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { inventoryAlerts, productSerials } from '@/db/schema/warehouse-enterprise';
import { products } from '@/db/schema/catalog';
import { purchaseOrders } from '@/db/schema/accounting';
import { eq, desc, and, sql, lte, gte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(today.getDate() + 30);
    const thirtyDaysAheadStr = thirtyDaysAhead.toISOString().slice(0, 10);

    const generatedAlerts: Array<{
      id: string;
      type: string;
      severity: 'info' | 'warning' | 'critical';
      title: string;
      message: string;
      referenceId?: string;
      createdAt: string;
    }> = [];

    // 1. Critical Out of Stock alerts
    const outOfStockItems = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        stockQuantity: products.stockQuantity,
      })
      .from(products)
      .where(sql`${products.stockQuantity} <= 0`)
      .limit(10);

    outOfStockItems.forEach((item) => {
      generatedAlerts.push({
        id: `oos_${item.id}`,
        type: 'out_of_stock',
        severity: 'critical',
        title: `Out of Stock: ${item.name}`,
        message: `SKU ${item.sku} has 0 physical units available in warehouse. Counter POS sales blocked.`,
        referenceId: item.sku,
        createdAt: new Date().toISOString(),
      });
    });

    // 2. Low Stock Alerts
    const lowStockItems = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        stockQuantity: products.stockQuantity,
        lowStockThreshold: products.lowStockThreshold,
      })
      .from(products)
      .where(
        sql`${products.stockQuantity} > 0 AND ${products.stockQuantity} <= ${products.lowStockThreshold}`
      )
      .limit(10);

    lowStockItems.forEach((item) => {
      generatedAlerts.push({
        id: `low_${item.id}`,
        type: 'low_stock',
        severity: 'warning',
        title: `Low Stock Alert: ${item.name}`,
        message: `Stock level (${item.stockQuantity}) is at or below safe buffer threshold (${item.lowStockThreshold}). Trigger re-order PO.`,
        referenceId: item.sku,
        createdAt: new Date().toISOString(),
      });
    });

    // 3. Overdue Purchase Orders
    const overduePos = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .where(
        and(
          sql`${purchaseOrders.status} IN ('issued', 'partially_received')`,
          lte(purchaseOrders.expectedDeliveryDate, todayStr)
        )
      )
      .limit(5);

    overduePos.forEach((po) => {
      generatedAlerts.push({
        id: `po_overdue_${po.id}`,
        type: 'po_overdue',
        severity: 'warning',
        title: `Overdue Purchase Order: ${po.poNumber}`,
        message: `Supplier delivery was expected on ${po.expectedDeliveryDate}. Contact supplier for shipment tracking.`,
        referenceId: po.poNumber,
        createdAt: new Date().toISOString(),
      });
    });

    // 4. Expiring Warranties
    const expiringSerials = await db
      .select({
        id: productSerials.id,
        serialNumber: productSerials.serialNumber,
        warrantyEndDate: productSerials.warrantyEndDate,
        productId: productSerials.productId,
      })
      .from(productSerials)
      .where(
        and(
          eq(productSerials.status, 'sold'),
          lte(productSerials.warrantyEndDate, thirtyDaysAheadStr),
          gte(productSerials.warrantyEndDate, todayStr)
        )
      )
      .limit(5);

    expiringSerials.forEach((sn) => {
      generatedAlerts.push({
        id: `warranty_exp_${sn.id}`,
        type: 'warranty_expiring',
        severity: 'info',
        title: `Customer Warranty Expiring: S/N ${sn.serialNumber}`,
        message: `Factory warranty expires on ${sn.warrantyEndDate}. Eligible for extended warranty care pack.`,
        referenceId: sn.serialNumber,
        createdAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({
      success: true,
      alerts: generatedAlerts,
      totalAlerts: generatedAlerts.length,
    });
  } catch (error: any) {
    console.error('Failed to fetch inventory alerts:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
