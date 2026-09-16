import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orders, users } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';

export const GET = withRole(['admin', 'sales'], async (request: NextRequest) => {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim();
  const vipOnly = url.searchParams.get('vip') === 'true';
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
  const conditions = [eq(users.role, 'customer')];
  if (search) conditions.push(ilike(users.name, `%${search}%`));

  const rows = await db.select({
    id: users.id, name: users.name, email: users.email, phone: users.phone,
    avatarUrl: users.avatarUrl, createdAt: users.createdAt,
    orderCount: sql<number>`count(${orders.id})::int`,
    lifetimeSpend: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
    lastOrderAt: sql<Date | null>`max(${orders.createdAt})`,
  }).from(users).leftJoin(orders, eq(orders.userId, users.id)).where(and(...conditions))
    .groupBy(users.id).orderBy(desc(sql`coalesce(sum(${orders.totalAmount}), 0)`)).limit(limit);

  const customers = rows.map((row) => ({ ...row, lifetimeSpend: Number(row.lifetimeSpend), averageOrderValue: row.orderCount ? Number(row.lifetimeSpend) / row.orderCount : 0, isVip: Number(row.lifetimeSpend) >= 25000 || row.orderCount >= 2 }));
  return NextResponse.json({ customers: vipOnly ? customers.filter((customer) => customer.isVip) : customers, total: customers.length });
});
