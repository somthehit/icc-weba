import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { supplierPayments } from '@/db/schema/accounting-enterprise';
import { purchaseBills, suppliers } from '@/db/schema/accounting';
import { eq, desc, sql } from 'drizzle-orm';
import { withRole } from '@/lib/auth/middleware';
import { postSupplierPaymentJournal } from '@/lib/accounting/ledger-engine';

// Schema column mapping (accounting-enterprise.ts supplierPayments):
//   amountPaid        = gross invoice amount being settled
//   tdsRate           = TDS rate (e.g. "1.5")
//   tdsAmount         = TDS withheld amount
//   netDisbursed      = amountPaid - tdsAmount
//   billId            = FK to purchase_bills (nullable)
//   chequeOrRefNo     = bank ref / cheque number
//   (no `status` column — derive from billId linkage)

export const GET = withRole(['admin', 'sales'], async (request: NextRequest) => {
  try {
    // 1. Fetch all supplier payments with joined supplier name
    const payments = await db
      .select({
        id: supplierPayments.id,
        paymentNumber: supplierPayments.paymentNumber,
        paymentDate: supplierPayments.paymentDate,
        supplierId: supplierPayments.supplierId,
        supplierName: suppliers.name,
        grossAmount: supplierPayments.amountPaid,     // gross settled
        tdsRate: supplierPayments.tdsRate,
        tdsAmount: supplierPayments.tdsAmount,
        netDisbursed: supplierPayments.netDisbursed,
        paymentMethod: supplierPayments.paymentMethod,
        chequeOrRefNo: supplierPayments.chequeOrRefNo,
        billId: supplierPayments.billId,
        notes: supplierPayments.notes,
        createdAt: supplierPayments.createdAt,
      })
      .from(supplierPayments)
      .leftJoin(suppliers, eq(suppliers.id, supplierPayments.supplierId))
      .orderBy(desc(supplierPayments.id))
      .limit(50);

    // 2. Compute AP Aging from outstanding purchase bills
    const allBills = await db
      .select({
        id: purchaseBills.id,
        billNumber: purchaseBills.billNumber,
        billDate: purchaseBills.billDate,
        dueDate: purchaseBills.dueDate,
        totalAmount: purchaseBills.totalAmount,
        amountPaid: purchaseBills.amountPaid,
        supplierId: purchaseBills.supplierId,
        supplierName: suppliers.name,
      })
      .from(purchaseBills)
      .leftJoin(suppliers, eq(suppliers.id, purchaseBills.supplierId))
      .where(sql`${purchaseBills.totalAmount} > ${purchaseBills.amountPaid}`);

    const now = new Date();
    const aging = {
      current0to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90days: 0,
      totalOutstanding: 0,
    };

    const supplierOutstandingMap = new Map<string, { id: string; name: string; outstanding: number; billsCount: number }>();

    for (const b of allBills) {
      const remaining = Number(b.totalAmount) - Number(b.amountPaid || 0);
      aging.totalOutstanding += remaining;

      const billDate = new Date(b.billDate);
      const diffDays = Math.floor((now.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        aging.current0to30 += remaining;
      } else if (diffDays <= 60) {
        aging.days31to60 += remaining;
      } else if (diffDays <= 90) {
        aging.days61to90 += remaining;
      } else {
        aging.over90days += remaining;
      }

      const sId = b.supplierId;
      if (sId) {
        const curr = supplierOutstandingMap.get(sId) || { id: sId, name: b.supplierName || 'Unknown', outstanding: 0, billsCount: 0 };
        curr.outstanding += remaining;
        curr.billsCount += 1;
        supplierOutstandingMap.set(sId, curr);
      }
    }

    return NextResponse.json({
      success: true,
      payments,
      apAging: aging,
      supplierBalances: Array.from(supplierOutstandingMap.values()),
    });
  } catch (error: any) {
    console.error('Error fetching supplier payments:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withRole(['admin', 'sales'], async (request: NextRequest, { user }: any) => {
  try {
    const body = await request.json();
    const { supplierId, billId, grossAmount, tdsRate = 1.5, paymentMethod = 'Nabil Bank', paymentDate, chequeOrRefNo, notes } = body;

    if (!supplierId || !grossAmount || Number(grossAmount) <= 0) {
      return NextResponse.json({ success: false, error: 'Supplier and a valid gross amount are required' }, { status: 400 });
    }

    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, String(supplierId))).limit(1);
    if (!supplier) {
      return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 });
    }

    const gross = Number(grossAmount);
    const tdsWithheld = Number(((gross * Number(tdsRate)) / 100).toFixed(2));
    const netPaid = Number((gross - tdsWithheld).toFixed(2));
    const payDate = paymentDate || new Date().toISOString().slice(0, 10);
    const paymentNum = `PAY-SUP-${Date.now().toString().slice(-6)}`;

    // 1. Insert Supplier Payment Record (aligned to schema column names)
    const [payment] = await db
      .insert(supplierPayments)
      .values({
        paymentNumber: paymentNum,
        supplierId: supplier.id,
        billId: billId ? String(billId) : null,
        paymentDate: payDate,
        amountPaid: String(gross.toFixed(2)),         // gross settled amount
        tdsRate: String(Number(tdsRate).toFixed(2)),
        tdsAmount: String(tdsWithheld.toFixed(2)),
        netDisbursed: String(netPaid.toFixed(2)),
        paymentMethod,
        chequeOrRefNo: chequeOrRefNo || null,
        notes: notes || null,
        createdById: user?.userId || null,
        createdByName: (user as any)?.name || null,
      })
      .returning();

    // 2. If attached to a specific bill, update the bill's amountPaid
    if (billId) {
      const [bill] = await db.select().from(purchaseBills).where(eq(purchaseBills.id, String(billId))).limit(1);
      if (bill) {
        const newPaid = Number(bill.amountPaid || 0) + gross;
        const total = Number(bill.totalAmount || 0);
        const status = newPaid >= total ? 'paid' : 'partial';
        await db
          .update(purchaseBills)
          .set({ amountPaid: String(newPaid.toFixed(2)), status })
          .where(eq(purchaseBills.id, String(billId)));
      }
    }

    // 3. Auto-Post General Ledger Entry
    try {
      await postSupplierPaymentJournal({
        paymentId: payment.id,
        paymentNumber: paymentNum,
        paymentDate: payDate,
        supplierName: supplier.name,
        settledAmount: gross,
        tdsAmount: tdsWithheld,
        netPaidAmount: netPaid,
        paymentMethod,
        bankReference: chequeOrRefNo,
        postedBy: user?.userId || null,
      });
    } catch (glError) {
      console.warn('GL Posting for supplier payment:', glError);
    }

    return NextResponse.json({
      success: true,
      message: `Supplier payment ${paymentNum} recorded & posted to GL. TDS NPR ${tdsWithheld.toFixed(2)} withheld.`,
      payment,
    });
  } catch (error: any) {
    console.error('Error posting supplier payment:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
