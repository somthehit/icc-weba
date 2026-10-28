import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  posShifts,
  posCashTransactions,
  posShiftCashMovements,
  orders,
  posEodSubmissions,
  users,
} from '@/db/schema';
import { eq, and, or, gte, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const terminalCode = searchParams.get('terminalCode') || searchParams.get('register') || 'REG-01';
    const shiftIdParam = searchParams.get('shiftId');

    // 1. Locate current or requested shift
    let shift = null;
    if (shiftIdParam) {
      [shift] = await db
        .select()
        .from(posShifts)
        .where(eq(posShifts.id, String(shiftIdParam)))
        .limit(1);
    } else {
      [shift] = await db
        .select()
        .from(posShifts)
        .where(
          and(
            eq(posShifts.registerCode, terminalCode),
            or(
              eq(posShifts.status, 'OPEN'),
              eq(posShifts.status, 'PAUSED'),
              eq(posShifts.status, 'SUBMITTED_FOR_AUDIT')
            )
          )
        )
        .orderBy(desc(posShifts.openedAt))
        .limit(1);
    }

    if (!shift) {
      return NextResponse.json(
        { success: false, error: `No active or submitted shift found for terminal ${terminalCode}.` },
        { status: 404 }
      );
    }

    // 2. Check if an EOD submission already exists for this shift
    const [existingSubmission] = await db
      .select()
      .from(posEodSubmissions)
      .where(eq(posEodSubmissions.shiftId, shift.id))
      .limit(1);

    // 3. Fetch all cash transactions / movements for this shift
    const cashOps = await db
      .select()
      .from(posCashTransactions)
      .where(eq(posCashTransactions.shiftId, shift.id));

    let totalCashIn = 0;
    let totalCashOut = 0;
    let totalSafeDrops = 0;
    let totalPettyCash = 0;

    for (const op of cashOps) {
      const amt = Number(op.amount) || 0;
      if (op.type === 'CASH_IN') totalCashIn += amt;
      else if (op.type === 'CASH_OUT') totalCashOut += amt;
      else if (op.type === 'SAFE_DROP') totalSafeDrops += amt;
      else if (op.type === 'PETTY_CASH') totalPettyCash += amt;
    }

    // Also check posShiftCashMovements if recorded there
    try {
      const movements = await db
        .select()
        .from(posShiftCashMovements)
        .where(eq(posShiftCashMovements.shiftId, shift.id));

      for (const m of movements) {
        const amt = Number(m.amount) || 0;
        if (m.type === 'PAID_IN') totalCashIn += amt;
        else if (m.type === 'PAID_OUT' || m.type === 'PETTY_CASH') totalCashOut += amt;
        else if (m.type === 'SAFE_DROP') totalSafeDrops += amt;
      }
    } catch (e) {
      // safe fallback if table is empty
    }

    // 4. Query POS orders placed during this shift
    const shiftOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        totalAmount: orders.totalAmount,
        subtotal: orders.subtotal,
        paymentMethod: orders.paymentMethod,
        discountAmount: orders.discountAmount,
        vatAmount: orders.vatAmount,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(gte(orders.createdAt, shift.openedAt))
      .orderBy(desc(orders.createdAt));

    let totalSales = 0;
    let cashSales = 0;
    let cardSales = 0;
    let qrSales = 0;
    let bankTransferSales = 0;
    let creditSales = 0;
    let refundsAmount = 0;
    let voidsCount = 0;
    let voidsAmount = 0;
    let totalVat = 0;
    let totalDiscounts = 0;
    let totalTransactions = 0;

    for (const ord of shiftOrders) {
      const amt = Number(ord.totalAmount) || 0;
      const vat = Number(ord.vatAmount) || 0;
      const disc = Number(ord.discountAmount) || 0;

      if (ord.status === 'cancelled') {
        voidsCount++;
        voidsAmount += amt;
        continue;
      }

      if (ord.status === 'refunded' || ord.status === 'returned') {
        refundsAmount += amt;
        continue;
      }

      totalTransactions++;
      totalSales += amt;
      totalVat += vat;
      totalDiscounts += disc;

      const pm = String(ord.paymentMethod || '').toLowerCase();
      if (pm === 'cod' || pm === 'cash') {
        cashSales += amt;
      } else if (pm === 'card' || pm === 'pos_card') {
        cardSales += amt;
      } else if (pm === 'esewa' || pm === 'khalti' || pm === 'qr' || pm === 'fonepay') {
        qrSales += amt;
      } else if (pm === 'bank_transfer' || pm === 'connectips') {
        bankTransferSales += amt;
      } else if (pm === 'credit') {
        creditSales += amt;
      } else {
        // Default to cash if unspecified
        cashSales += amt;
      }
    }

    // If shift record already accumulated sales figures, use the max to ensure accurate data
    const shiftTotalSalesStored = Number(shift.totalSales) || 0;
    const shiftCashSalesStored = Number(shift.totalCashSales) || 0;
    const shiftCardSalesStored = Number(shift.totalCardSales) || 0;
    const shiftQrSalesStored = Number(shift.totalQrSales) || 0;

    if (shiftTotalSalesStored > totalSales) {
      totalSales = shiftTotalSalesStored;
      cashSales = shiftCashSalesStored > 0 ? shiftCashSalesStored : cashSales;
      cardSales = shiftCardSalesStored > 0 ? shiftCardSalesStored : cardSales;
      qrSales = shiftQrSalesStored > 0 ? shiftQrSalesStored : qrSales;
    }

    const openingFloat = Number(shift.openingFloat) || 0;
    const taxableAmount = totalSales > 0 ? Number((totalSales / 1.13).toFixed(2)) : 0;
    if (totalVat === 0 && totalSales > 0) {
      totalVat = Number((totalSales - taxableAmount).toFixed(2));
    }

    // Accounting Expected Cash calculation:
    // Expected Cash = Opening Float + Cash Received from Sales + Cash Paid In - Petty Cash Paid Out - Safe Drops - Cash Refunds
    const expectedClosingCash = Number(
      (openingFloat + cashSales + totalCashIn - totalCashOut - totalSafeDrops - refundsAmount).toFixed(2)
    );

    const businessDate =
      (shift.openedAt ? new Date(shift.openedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

    const eodReference =
      existingSubmission?.eodReference ||
      `EOD-${businessDate.replace(/-/g, '')}-${shift.registerCode}-${shift.shiftNumber.replace(/^SHIFT-/, '')}`;

    return NextResponse.json({
      success: true,
      hasActiveShift: true,
      isAlreadySubmitted: Boolean(existingSubmission),
      submission: existingSubmission || null,
      summary: {
        eodReference,
        shiftId: shift.id,
        shiftNumber: shift.shiftNumber,
        businessDate,
        branch: 'Dhangadhi Main Branch, Nepal',
        registerCode: shift.registerCode,
        cashierId: shift.cashierId,
        cashierCode: shift.cashierCode || 'EMP-101',
        cashierName: shift.cashierName,
        openedAt: shift.openedAt,
        openedBySupervisorName: shift.openedBySupervisorName,
        
        // Sales totals by tender
        openingFloat,
        totalSales: Number(totalSales.toFixed(2)),
        cashSales: Number(cashSales.toFixed(2)),
        cardSales: Number(cardSales.toFixed(2)),
        qrSales: Number(qrSales.toFixed(2)),
        bankTransferSales: Number(bankTransferSales.toFixed(2)),
        creditSales: Number(creditSales.toFixed(2)),
        
        // Taxes and adjustments
        taxableAmount,
        vatAmount: Number(totalVat.toFixed(2)),
        discountAmount: Number(totalDiscounts.toFixed(2)),
        refundsAmount: Number(refundsAmount.toFixed(2)),
        voidsCount,
        voidsAmount: Number(voidsAmount.toFixed(2)),
        totalTransactions,

        // Drawer Cash Operations
        cashAdditions: Number(totalCashIn.toFixed(2)),
        cashPayouts: Number(totalCashOut.toFixed(2)),
        safeDrops: Number(totalSafeDrops.toFixed(2)),
        pettyCash: Number(totalPettyCash.toFixed(2)),

        // Expected Cash (Accounting Rule)
        expectedClosingCash,
      },
    });
  } catch (error: any) {
    console.error('Failed to get cashier EOD summary:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
