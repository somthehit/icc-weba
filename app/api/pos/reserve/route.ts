import { NextRequest, NextResponse } from 'next/server';
import { posCache } from '@/lib/redis/client';
import { db } from '@/db';
import { products } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, quantity = 1, terminalCode = 'REG-01', release = false } = body;

    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const pid = String(productId);
    const qty = Math.max(1, Number(quantity));

    // Release reservation
    if (release) {
      await posCache.releaseReservation(pid, terminalCode, true);
      return NextResponse.json({ success: true, message: 'Reservation released' });
    }

    // Ensure Redis has latest stock baseline from Postgres if not cached
    const stockKey = `stock:${pid}`;
    const cachedStock = await posCache.get<number>(stockKey);
    if (cachedStock === null) {
      const [prod] = await db
        .select({ stockQuantity: products.stockQuantity })
        .from(products)
        .where(eq(products.id, pid))
        .limit(1);

      if (!prod) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }
      await posCache.set(stockKey, prod.stockQuantity);
    }

    // Attempt atomic reservation in Redis
    const reservation = await posCache.reserveStock(pid, qty, terminalCode, 900); // 15 mins TTL

    if (!reservation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Item is currently out of stock or reserved by another counter. Remaining: ${reservation.availableStock}`,
          availableStock: reservation.availableStock,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Reserved ${qty} units for 15 minutes`,
      reservationId: reservation.reservationId,
      availableStock: reservation.availableStock,
    });
  } catch (err: any) {
    console.error('Reservation error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Reservation failed' }, { status: 500 });
  }
}
