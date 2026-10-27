import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, orders } from '@/db/schema';
import { eq, or, ilike, desc, sql, and } from 'drizzle-orm';

// GET: Search or list POS customers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

    const conditions = [eq(users.role, 'customer')];

    if (search) {
      conditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.phone, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )!
      );
    }

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
        orderCount: sql<number>`count(${orders.id})::int`,
        lifetimeSpend: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
        lastOrderAt: sql<Date | null>`max(${orders.createdAt})`,
      })
      .from(users)
      .leftJoin(orders, eq(orders.userId, users.id))
      .where(and(...conditions))
      .groupBy(users.id)
      .orderBy(desc(sql`coalesce(sum(${orders.totalAmount}), 0)`))
      .limit(limit);

    const formatted = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone || '',
      email: r.email,
      orderCount: r.orderCount,
      lifetimeSpend: Number(r.lifetimeSpend),
      lastOrderAt: r.lastOrderAt,
      // For POS Khata tracking: VIP status if spend > 25,000 NPR
      isVip: Number(r.lifetimeSpend) >= 25000,
    }));

    return NextResponse.json({
      success: true,
      customers: formatted,
      total: formatted.length,
    });
  } catch (error: any) {
    console.error('POS Customers GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add new customer directly from POS
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, pan } = body;

    const cleanName = String(name || '').trim();
    const cleanPhone = String(phone || '').trim();
    const cleanEmail = email ? String(email).trim().toLowerCase() : `pos-customer-${Date.now()}@icc.com.np`;

    if (!cleanName) {
      return NextResponse.json({ success: false, error: 'Customer name is required.' }, { status: 400 });
    }

    // Check if customer with same phone already exists
    if (cleanPhone) {
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.phone, cleanPhone))
        .limit(1);

      if (existing) {
        return NextResponse.json({
          success: true,
          message: 'Existing customer attached.',
          customer: {
            id: existing.id,
            name: existing.name,
            phone: existing.phone,
            email: existing.email,
            pan: pan || '',
          },
        });
      }
    }

    // Insert new customer
    const [newCustomer] = await db
      .insert(users)
      .values({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || null,
        role: 'customer',
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'New customer profile registered.',
      customer: {
        id: newCustomer.id,
        name: newCustomer.name,
        phone: newCustomer.phone || '',
        email: newCustomer.email,
        pan: pan || '',
      },
    });
  } catch (error: any) {
    console.error('POS Customers POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
