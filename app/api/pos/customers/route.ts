// app/api/pos/customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, orders, customerMemberships, loyaltyLevels } from '@/db/schema';
import { eq, or, ilike, desc, sql, and } from 'drizzle-orm';
import { LoyaltyService } from '@/lib/loyalty/loyaltyService';

// GET: Search or list POS customers with loyalty tier & points
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
          ilike(users.email, `%${search}%`),
          ilike(customerMemberships.membershipNumber, `%${search}%`)
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
        orderCount: sql<number>`count(distinct ${orders.id})::int`,
        lifetimeSpend: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
        lastOrderAt: sql<Date | null>`max(${orders.createdAt})`,
        membershipNumber: customerMemberships.membershipNumber,
        levelId: customerMemberships.currentLevelId,
        levelName: loyaltyLevels.name,
        badgeColor: loyaltyLevels.badgeColor,
        icon: loyaltyLevels.icon,
        availableCoins: customerMemberships.availableCoins,
        qualifyingSpend: customerMemberships.qualifyingSpend,
      })
      .from(users)
      .leftJoin(orders, eq(orders.userId, users.id))
      .leftJoin(customerMemberships, eq(customerMemberships.customerId, users.id))
      .leftJoin(loyaltyLevels, eq(customerMemberships.currentLevelId, loyaltyLevels.id))
      .where(and(...conditions))
      .groupBy(
        users.id,
        customerMemberships.membershipNumber,
        customerMemberships.currentLevelId,
        loyaltyLevels.name,
        loyaltyLevels.badgeColor,
        loyaltyLevels.icon,
        customerMemberships.availableCoins,
        customerMemberships.qualifyingSpend
      )
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
      isVip: r.levelId === 'happy_customer' || Number(r.lifetimeSpend) >= 25000,
      membershipNumber: r.membershipNumber || `MEM-${r.id.slice(0, 8)}`,
      membershipLevel: r.levelName || 'Silver',
      badgeColor: r.badgeColor || 'slate',
      icon: r.icon || '🥈',
      availableCoins: Number(r.availableCoins || 0),
      qualifyingSpend: Number(r.qualifyingSpend || 0),
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

// POST: Add new customer directly from POS and auto-enroll into Silver membership
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
        const loyaltyProfile = await LoyaltyService.getOrCreateCustomerMembership(existing.id, {
          name: existing.name,
          phone: existing.phone || '',
        });

        return NextResponse.json({
          success: true,
          message: 'Existing customer attached with loyalty profile.',
          customer: {
            id: existing.id,
            name: existing.name,
            phone: existing.phone,
            email: existing.email,
            pan: pan || '',
            membershipNumber: loyaltyProfile.membershipNumber,
            membershipLevel: loyaltyProfile.levelName,
            badgeColor: loyaltyProfile.badgeColor,
            availableCoins: loyaltyProfile.availableCoins,
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

    // Auto-enroll in Silver loyalty tier
    const loyaltyProfile = await LoyaltyService.getOrCreateCustomerMembership(newCustomer.id, {
      name: newCustomer.name,
      phone: newCustomer.phone || '',
      email: newCustomer.email,
    });

    return NextResponse.json({
      success: true,
      message: 'New customer profile registered with Silver loyalty membership.',
      customer: {
        id: newCustomer.id,
        name: newCustomer.name,
        phone: newCustomer.phone || '',
        email: newCustomer.email,
        pan: pan || '',
        membershipNumber: loyaltyProfile.membershipNumber,
        membershipLevel: loyaltyProfile.levelName,
        badgeColor: loyaltyProfile.badgeColor,
        availableCoins: loyaltyProfile.availableCoins,
      },
    });
  } catch (error: any) {
    console.error('POS Customers POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
