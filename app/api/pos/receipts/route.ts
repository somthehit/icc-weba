import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems } from '@/db/schema';
import { desc, eq, ilike, or, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(Number(searchParams.get('limit')) || 30, 100);

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(orders.orderNumber, `%${search}%`),
          ilike(orders.customerNote, `%${search}%`),
        ),
      );
    }

    const orderRows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        subtotal: orders.subtotal,
        discountAmount: orders.discountAmount,
        totalAmount: orders.totalAmount,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        status: orders.status,
        customerNote: orders.customerNote,
        shippingAddressSnapshot: orders.shippingAddressSnapshot,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    // Fetch items for each order
    const receipts = await Promise.all(
      orderRows.map(async (ord) => {
        const items = await db
          .select({
            id: orderItems.id,
            productId: orderItems.productId,
            name: orderItems.productNameSnapshot,
            sku: orderItems.skuSnapshot,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            lineTotal: orderItems.lineTotal,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, ord.id));

        return {
          ...ord,
          items,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      receipts,
    });
  } catch (error: any) {
    console.error('POS Receipts fetch failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
