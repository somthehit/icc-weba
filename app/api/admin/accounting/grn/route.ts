import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  goodsReceiptNotes,
  goodsReceiptNoteItems,
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  purchaseBills,
  purchaseBillItems,
} from '@/db/schema/accounting';
import { products } from '@/db/schema/catalog';
import { appendAuditHashEntry } from '@/lib/audit/hash-chain';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const grnRows = await db
      .select({
        id: goodsReceiptNotes.id,
        grnNumber: goodsReceiptNotes.grnNumber,
        purchaseOrderId: goodsReceiptNotes.purchaseOrderId,
        supplierId: goodsReceiptNotes.supplierId,
        supplierInvoiceNo: goodsReceiptNotes.supplierInvoiceNo,
        receivedDate: goodsReceiptNotes.receivedDate,
        storekeeperName: goodsReceiptNotes.storekeeperName,
        totalItems: goodsReceiptNotes.totalItems,
        totalQuantity: goodsReceiptNotes.totalQuantity,
        totalAmount: goodsReceiptNotes.totalAmount,
        financialStatus: goodsReceiptNotes.financialStatus,
        purchaseBillId: goodsReceiptNotes.purchaseBillId,
        notes: goodsReceiptNotes.notes,
        createdAt: goodsReceiptNotes.createdAt,
        supplierName: suppliers.name,
        supplierPan: suppliers.vatPanNo,
        supplierPhone: suppliers.phone,
        poNumber: purchaseOrders.poNumber,
      })
      .from(goodsReceiptNotes)
      .leftJoin(suppliers, eq(suppliers.id, goodsReceiptNotes.supplierId))
      .leftJoin(purchaseOrders, eq(purchaseOrders.id, goodsReceiptNotes.purchaseOrderId))
      .orderBy(desc(goodsReceiptNotes.createdAt));

    // Also include any POs that are received/partially received if GRN table is still fresh
    const grnListWithItems = await Promise.all(
      grnRows.map(async (grn) => {
        const items = await db
          .select()
          .from(goodsReceiptNoteItems)
          .where(eq(goodsReceiptNoteItems.grnId, grn.id));

        return {
          ...grn,
          items,
        };
      })
    );

    return NextResponse.json({
      success: true,
      grnList: grnListWithItems,
      totalCount: grnListWithItems.length,
      pendingVouchersCount: grnListWithItems.filter((g) => g.financialStatus === 'pending_invoice').length,
    });
  } catch (error: any) {
    console.error('GRN Match API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch GRN records',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, grnId, supplierInvoiceNo, invoiceDate, dueDate, notes, recordedByName } = body;

    if (action === 'create_purchase_voucher') {
      if (!grnId) {
        return NextResponse.json({ success: false, error: 'GRN ID is required' }, { status: 400 });
      }

      if (!supplierInvoiceNo || !supplierInvoiceNo.trim()) {
        return NextResponse.json({ success: false, error: 'Physical Supplier Invoice # is required' }, { status: 400 });
      }

      // 1. Fetch GRN and its items
      const [grn] = await db
        .select()
        .from(goodsReceiptNotes)
        .where(eq(goodsReceiptNotes.id, Number(grnId)))
        .limit(1);

      if (!grn) {
        return NextResponse.json({ success: false, error: 'GRN not found' }, { status: 404 });
      }

      const grnItems = await db
        .select()
        .from(goodsReceiptNoteItems)
        .where(eq(goodsReceiptNoteItems.grnId, grn.id));

      let subtotal = 0;
      for (const it of grnItems) {
        subtotal += Number(it.lineTotal || Number(it.unitCost) * it.quantityReceived);
      }
      const vat = subtotal * 0.13;
      const totalAmount = subtotal + vat;

      // 2. Atomic Transaction: Create Purchase Bill (Accounts Payable) & update GRN status
      const result = await db.transaction(async (tx) => {
        // Create Purchase Bill
        const [bill] = await tx
          .insert(purchaseBills)
          .values({
            supplierId: grn.supplierId,
            billNumber: supplierInvoiceNo.trim(),
            billDate: invoiceDate || new Date().toISOString().slice(0, 10),
            dueDate: dueDate || null,
            subtotal: subtotal.toFixed(2),
            vatAmount: vat.toFixed(2),
            totalAmount: totalAmount.toFixed(2),
            amountPaid: '0.00',
            status: 'unpaid',
            notes: notes || `Auto-generated from ${grn.grnNumber}`,
          })
          .returning();

        // Create Purchase Bill Items
        for (const it of grnItems) {
          await tx.insert(purchaseBillItems).values({
            billId: bill.id,
            productId: it.productId,
            description: it.description,
            quantity: it.quantityReceived,
            unitCost: String(it.unitCost),
            lineTotal: String(it.lineTotal),
          });
        }

        // Update GRN financial status to billed
        const [updatedGrn] = await tx
          .update(goodsReceiptNotes)
          .set({
            financialStatus: 'billed',
            purchaseBillId: bill.id,
            supplierInvoiceNo: supplierInvoiceNo.trim(),
            updatedAt: new Date(),
          })
          .where(eq(goodsReceiptNotes.id, grn.id))
          .returning();

        // Append Audit Trail
        await appendAuditHashEntry({
          action: 'PURCHASE_VOUCHER_CREATED_FROM_GRN',
          actorId: recordedByName || 'Accountant',
          entity: 'purchase_bills',
          entityId: String(bill.id),
          meta: {
            grnNumber: grn.grnNumber,
            supplierInvoiceNo,
            supplierId: grn.supplierId,
            totalAmount,
            vatAmount: vat,
          },
        });

        return { bill, grn: updatedGrn };
      });

      return NextResponse.json({
        success: true,
        message: `Purchase Voucher created for ${supplierInvoiceNo}. Accounts Payable booked.`,
        purchaseBill: result.bill,
        grn: result.grn,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('GRN Purchase Voucher Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create purchase voucher',
    }, { status: 500 });
  }
}
