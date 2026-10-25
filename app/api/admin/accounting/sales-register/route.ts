import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems } from '@/db/schema/orders';
import { posTransactions } from '@/db/schema/pos-enterprise';
import { posShifts } from '@/db/schema/pos';
import { desc, sql, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date'); // YYYY-MM-DD (optional)

    // 1. Fetch Orders and POS Transactions
    const orderRows = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(200);

    const posRows = await db
      .select()
      .from(posTransactions)
      .orderBy(desc(posTransactions.createdAt))
      .limit(200);

    let totalGrossSales = 0;
    let totalTaxableSales = 0;
    let totalVat13 = 0;
    let totalTaxExempt = 0;

    const channelBreakdown = {
      cashInDrawer: 0,
      fonepayQr: 0,
      cardSwipe: 0,
      memberCredit: 0,
    };

    const journalEntries: any[] = [];

    // Process Orders
    for (const ord of orderRows) {
      const amt = Number(ord.totalAmount || 0);
      const vat = Number(ord.vatAmount || (amt * 0.13) / 1.13);
      const taxable = Number(ord.subtotal || amt - vat);

      totalGrossSales += amt;
      totalTaxableSales += taxable;
      totalVat13 += vat;

      const method = (ord.paymentMethod || '').toLowerCase();
      if (method.includes('cash') || method.includes('cod')) {
        channelBreakdown.cashInDrawer += amt;
      } else if (method.includes('fonepay') || method.includes('qr') || method.includes('esewa') || method.includes('khalti')) {
        channelBreakdown.fonepayQr += amt;
      } else if (method.includes('card') || method.includes('pos')) {
        channelBreakdown.cardSwipe += amt;
      } else {
        channelBreakdown.memberCredit += amt;
      }

      journalEntries.push({
        id: `ORD-${ord.id}`,
        transactionNumber: ord.orderNumber || `#${ord.id}`,
        type: 'Online / Store Order',
        customerName: ord.shippingAddressSnapshot?.fullName || 'Walk-in Customer',
        customerPhone: ord.shippingAddressSnapshot?.phone || 'N/A',
        taxableAmount: taxable,
        vatAmount: vat,
        totalAmount: amt,
        paymentMethod: ord.paymentMethod || 'cash',
        channel: method.includes('fonepay') ? 'Fonepay QR' : method.includes('card') ? 'POS Card' : 'Cash / COD',
        status: ord.status || 'delivered',
        createdAt: ord.createdAt ? new Date(ord.createdAt).toISOString() : new Date().toISOString(),
      });
    }

    // Process POS Transactions
    for (const pos of posRows) {
      const amt = Number(pos.totalAmount || 0);
      const vat = (amt * 0.13) / 1.13;
      const taxable = amt - vat;

      totalGrossSales += amt;
      totalTaxableSales += taxable;
      totalVat13 += vat;

      const method = (pos.paymentMethod || '').toLowerCase();
      if (method.includes('cash')) {
        channelBreakdown.cashInDrawer += amt;
      } else if (method.includes('fonepay') || method.includes('qr')) {
        channelBreakdown.fonepayQr += amt;
      } else if (method.includes('card')) {
        channelBreakdown.cardSwipe += amt;
      } else {
        channelBreakdown.memberCredit += amt;
      }

      journalEntries.push({
        id: `POS-${pos.id}`,
        transactionNumber: pos.invoiceNumber || `POS-INV-${pos.id}`,
        type: 'Counter POS Register',
        customerName: pos.customerName || 'Counter Customer',
        customerPhone: pos.customerPhone || 'N/A',
        taxableAmount: taxable,
        vatAmount: vat,
        totalAmount: amt,
        paymentMethod: pos.paymentMethod || 'cash',
        channel: method.includes('fonepay') ? 'Fonepay QR' : method.includes('card') ? 'POS Card' : 'Cash at Till',
        status: 'completed',
        cashierName: pos.cashierName || 'Cashier',
        terminalCode: pos.terminalCode || 'REG-01',
        createdAt: pos.createdAt ? new Date(pos.createdAt).toISOString() : new Date().toISOString(),
      });
    }

    journalEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      summary: {
        totalGrossSales,
        totalTaxableSales,
        totalVat13,
        totalTaxExempt,
        channelBreakdown,
        totalTransactionsCount: journalEntries.length,
      },
      journalEntries: journalEntries.slice(0, 100),
    });
  } catch (error: any) {
    console.error('Sales Register API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch sales register',
    }, { status: 500 });
  }
}
