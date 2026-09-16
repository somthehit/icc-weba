import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { addresses, customerActivityLogs, customerProductPreferences, orderItems, orders, products, users } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';

export const GET = withRole(['admin', 'sales'], async (_request: NextRequest, { user }, context: { params: Promise<{ id: string }> }) => {
  const id = Number((await context.params).id);
  const [customer] = await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, avatarUrl: users.avatarUrl, createdAt: users.createdAt }).from(users).where(eq(users.id, id)).limit(1);
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  const [stats] = await db.select({ orderCount: sql<number>`count(${orders.id})::int`, lifetimeSpend: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`, lastActive: sql<Date | null>`max(${orders.createdAt})` }).from(orders).where(eq(orders.userId, id));
  const [userAddress] = await db.select().from(addresses).where(eq(addresses.userId, id)).limit(1);
  const [activity, preferences, orderHistory] = await Promise.all([
    db.select().from(customerActivityLogs).where(eq(customerActivityLogs.userId, id)).orderBy(desc(customerActivityLogs.occurredAt)).limit(50),
    db.select({ id: customerProductPreferences.id, preference: customerProductPreferences.preference, affinityScore: customerProductPreferences.affinityScore, productName: products.name, productId: products.id }).from(customerProductPreferences).innerJoin(products, eq(products.id, customerProductPreferences.productId)).where(eq(customerProductPreferences.userId, id)).orderBy(desc(customerProductPreferences.affinityScore)),
    db.select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, totalAmount: orders.totalAmount, createdAt: orders.createdAt, items: sql<string>`coalesce(json_agg(json_build_object('name', ${orderItems.productNameSnapshot}, 'quantity', ${orderItems.quantity})) filter (where ${orderItems.id} is not null), '[]')` }).from(orders).leftJoin(orderItems, eq(orderItems.orderId, orders.id)).where(eq(orders.userId, id)).groupBy(orders.id).orderBy(desc(orders.createdAt)),
  ]);
  return NextResponse.json({ customer, address: userAddress || null, metrics: { ...stats, lifetimeSpend: Number(stats?.lifetimeSpend || 0), averageOrderValue: stats?.orderCount ? Number(stats.lifetimeSpend) / stats.orderCount : 0 }, activity, preferences, orders: orderHistory, viewerUserId: user.userId });
});
