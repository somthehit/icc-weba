import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems } from '@/db/schema/orders';
import { posTransactions } from '@/db/schema/pos-enterprise';
import { desc, sql, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const status = searchParams.get('status') || 'all';
    const type = searchParams.get('type') || 'all'; // 'pos', 'online', 'all'
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const invoices: any[] = [];

    // 1. Fetch Orders from orders table
    try {
      const orderRows = await db
        .select()
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(limit);

      for (const ord of orderRows) {
        let itemsList: any[] = [];
        try {
          itemsList = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, ord.id));
        } catch (e) {
          // fallback
        }

        const total = Number(ord.totalAmount || 0);
        const vat = Number(ord.vatAmount || (total * 0.13) / 1.13);
        const taxable = Number(ord.subtotal || total - vat);
        const customerName = ord.shippingAddressSnapshot?.fullName || 'Walk-in Customer';
        const customerPhone = ord.shippingAddressSnapshot?.phone || 'N/A';

        invoices.push({
          id: `ORD-${ord.id}`,
          rawId: ord.id,
          sourceType: 'online',
          invoiceNumber: `INV-${new Date(ord.createdAt).getFullYear()}-${String(ord.id).padStart(5, '0')}`,
          orderNumber: ord.orderNumber || `#${ord.id}`,
          customerName,
          customerPhone,
          customerPan: null,
          totalAmount: total,
          taxableAmount: taxable,
          vatAmount: vat,
          paymentMethod: ord.paymentMethod || 'cash',
          paymentStatus: ord.paymentStatus || 'paid',
          orderStatus: ord.status || 'delivered',
          createdAt: ord.createdAt ? new Date(ord.createdAt).toISOString() : new Date().toISOString(),
          items: itemsList.map((it) => ({
            productId: it.productId,
            name: it.productNameSnapshot || 'Product',
            sku: it.skuSnapshot || 'SKU-GEN',
            quantity: it.quantity || 1,
            unitPrice: Number(it.unitPriceSnapshot || 0),
            total: Number(it.lineTotal || 0),
          })),
        });
      }
    } catch (e) {
      console.warn('Error reading orders for invoices:', e);
    }

    // 2. Fetch POS Transactions
    try {
      const posRows = await db
        .select()
        .from(posTransactions)
        .orderBy(desc(posTransactions.createdAt))
        .limit(limit);

      for (const p of posRows) {
        const total = Number(p.totalAmount || 0);
        const vat = (total * 0.13) / 1.13;
        const taxable = total - vat;

        let parsedItems: any[] = [];
        try {
          parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : (p.items as any[]) || [];
        } catch (e) {}

        invoices.push({
          id: `POS-${p.id}`,
          rawId: p.id,
          sourceType: 'pos',
          invoiceNumber: p.invoiceNumber || `POS-INV-${p.id}`,
          orderNumber: p.invoiceNumber || `POS-${p.id}`,
          customerName: p.customerName || 'Cash Customer (Counter)',
          customerPhone: p.customerPhone || 'N/A',
          customerPan: null,
          totalAmount: total,
          taxableAmount: taxable,
          vatAmount: vat,
          paymentMethod: p.paymentMethod || 'cash',
          paymentStatus: 'paid',
          orderStatus: 'completed',
          cashierName: p.cashierName || 'Staff Cashier',
          terminalCode: p.terminalCode || 'REG-01',
          createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
          items: parsedItems.map((it: any) => ({
            productId: it.productId || it.id,
            name: it.name || it.title || 'POS Item',
            sku: it.sku || 'SKU-POS',
            quantity: it.quantity || it.qty || 1,
            unitPrice: Number(it.price || it.unitPrice || 0),
            total: Number(it.lineTotal || (it.price || 0) * (it.quantity || 1)),
          })),
        });
      }
    } catch (e) {
      console.warn('Error reading pos transactions:', e);
    }

    // Filter by search and sort by date descending
    let filtered = invoices;
    if (search) {
      filtered = filtered.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(search) ||
          inv.customerName.toLowerCase().includes(search) ||
          (inv.customerPhone && inv.customerPhone.includes(search)) ||
          inv.paymentMethod.toLowerCase().includes(search)
      );
    }

    if (type !== 'all') {
      filtered = filtered.filter((inv) => inv.sourceType === type);
    }

    if (status !== 'all') {
      filtered = filtered.filter((inv) => inv.paymentStatus === status || inv.orderStatus === status);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      invoices: filtered.slice(0, limit),
      totalCount: filtered.length,
    });
  } catch (error: any) {
    console.error('Accounting Invoices API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch invoices',
    }, { status: 500 });
  }
}
