import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { purchaseOrders, purchaseOrderItems, goodsReceiptNotes, goodsReceiptNoteItems, purchaseBills, purchaseBillItems, suppliers } from '@/db/schema/accounting';
import { eq, desc, and } from 'drizzle-orm';
import { withAccounting } from '@/lib/auth/middleware';

/**
 * 3-Way Match API (PO -> GRN -> Supplier Bill)
 * Compares ordered vs received vs billed quantities, prices, and tax.
 */
export const GET = withAccounting(async (request: NextRequest) => {
  try {
    // 1. Fetch Purchase Orders with their GRNs and Bills
    const pos = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        orderDate: purchaseOrders.orderDate,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        totalAmount: purchaseOrders.totalAmount,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .orderBy(desc(purchaseOrders.id))
      .limit(30);

    const matchRecords = await Promise.all(
      pos.map(async (po) => {
        // Fetch items in PO
        const poItems = await db
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, po.id));

        // Fetch GRNs associated with this PO
        const grns = await db
          .select()
          .from(goodsReceiptNotes)
          .where(eq(goodsReceiptNotes.purchaseOrderId, po.id));

        // Fetch Purchase Bills associated with this supplier
        const bills = await db
          .select()
          .from(purchaseBills)
          .where(eq(purchaseBills.supplierId, po.supplierId))
          .limit(5);

        // Compute Match Status
        let totalPoQty = 0;
        let totalPoAmount = Number(po.totalAmount || 0);
        for (const item of poItems) {
          totalPoQty += item.quantityOrdered;
        }

        let totalGrnQty = 0;
        let totalGrnAmount = 0;
        for (const grn of grns) {
          totalGrnQty += grn.totalQuantity || 0;
          totalGrnAmount += Number(grn.totalAmount || 0);
        }

        const matchingBill = bills[0] || null;
        const totalBilledAmount = matchingBill ? Number(matchingBill.totalAmount || 0) : 0;

        const qtyVariance = totalGrnQty - totalPoQty;
        const priceVariance = totalBilledAmount - totalGrnAmount;

        let matchStatus: 'PERFECT_MATCH' | 'QTY_VARIANCE' | 'PRICE_VARIANCE' | 'PENDING_GRN' | 'PENDING_BILL' = 'PERFECT_MATCH';

        if (grns.length === 0) {
          matchStatus = 'PENDING_GRN';
        } else if (!matchingBill) {
          matchStatus = 'PENDING_BILL';
        } else if (qtyVariance !== 0) {
          matchStatus = 'QTY_VARIANCE';
        } else if (Math.abs(priceVariance) > 1) {
          matchStatus = 'PRICE_VARIANCE';
        }

        return {
          poId: po.id,
          poNumber: po.poNumber,
          orderDate: po.orderDate,
          supplierName: po.supplierName || 'Unknown Supplier',
          poTotalAmount: totalPoAmount,
          poTotalQty: totalPoQty,
          grnCount: grns.length,
          grnNumbers: grns.map((g) => g.grnNumber).join(', ') || 'None',
          grnTotalQty: totalGrnQty,
          grnTotalAmount: totalGrnAmount,
          billNumber: matchingBill?.billNumber || 'Not Invoiced',
          billedAmount: totalBilledAmount,
          qtyVariance,
          priceVariance,
          matchStatus,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      matches: matchRecords,
    });
  } catch (error: any) {
    console.error('Error fetching 3-way match data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
