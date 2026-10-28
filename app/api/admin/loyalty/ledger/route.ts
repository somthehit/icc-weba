// app/api/admin/loyalty/ledger/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loyaltyLedger, users } from '@/db/schema';
import { eq, desc, and, or, ilike } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search');
    const entryType = searchParams.get('entryType');
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

    const conditions = [];

    if (customerId) {
      conditions.push(eq(loyaltyLedger.customerId, customerId));
    }

    if (entryType && entryType !== 'all') {
      conditions.push(eq(loyaltyLedger.entryType, entryType));
    }

    if (search) {
      conditions.push(
        or(
          ilike(loyaltyLedger.orderNumber, `%${search}%`),
          ilike(loyaltyLedger.reason, `%${search}%`),
          ilike(loyaltyLedger.operatorName, `%${search}%`),
          ilike(users.name, `%${search}%`),
          ilike(users.phone, `%${search}%`)
        )!
      );
    }

    const rows = await db
      .select({
        id: loyaltyLedger.id,
        customerId: loyaltyLedger.customerId,
        customerName: users.name,
        customerPhone: users.phone,
        orderId: loyaltyLedger.orderId,
        orderNumber: loyaltyLedger.orderNumber,
        entryType: loyaltyLedger.entryType,
        pointsCredited: loyaltyLedger.pointsCredited,
        pointsDebited: loyaltyLedger.pointsDebited,
        balanceAfter: loyaltyLedger.balanceAfter,
        qualifyingSpendDelta: loyaltyLedger.qualifyingSpendDelta,
        reason: loyaltyLedger.reason,
        operatorName: loyaltyLedger.operatorName,
        createdAt: loyaltyLedger.createdAt,
      })
      .from(loyaltyLedger)
      .innerJoin(users, eq(loyaltyLedger.customerId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(loyaltyLedger.createdAt))
      .limit(limit);

    return NextResponse.json({ success: true, ledger: rows, count: rows.length });
  } catch (error: any) {
    console.error('Admin Loyalty Ledger GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
