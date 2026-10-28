// app/api/pos/loyalty/customer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { LoyaltyService } from '@/lib/loyalty/loyaltyService';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

// GET: Lookup customer profile, points balance, tier, and eligible offers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search');
    const subtotal = Number(searchParams.get('subtotal') || 0);

    if (id) {
      const profile = await LoyaltyService.getCustomerProfile(id);
      if (!profile) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
      }
      const eligibleOffers = await LoyaltyService.getEligibleOffers(
        profile.customerId,
        profile.currentLevelId,
        subtotal
      );
      return NextResponse.json({ success: true, profile, eligibleOffers });
    }

    if (search) {
      const results = await LoyaltyService.searchMembers(search, 10);
      return NextResponse.json({ success: true, members: results });
    }

    return NextResponse.json({ success: false, error: 'Provide either id or search query' }, { status: 400 });
  } catch (error: any) {
    console.error('POS Loyalty Customer GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Register or auto-enroll customer into Silver Loyalty Membership
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, customerId } = body;

    let targetCustomerId = customerId;

    if (!targetCustomerId) {
      const cleanName = String(name || '').trim();
      const cleanPhone = String(phone || '').trim();
      const cleanEmail = email ? String(email).trim().toLowerCase() : `cust-${Date.now()}@icc.com.np`;

      if (!cleanName && !cleanPhone) {
        return NextResponse.json({ success: false, error: 'Customer name or phone is required' }, { status: 400 });
      }

      // Check existing user by phone
      if (cleanPhone) {
        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.phone, cleanPhone))
          .limit(1);

        if (existing) {
          targetCustomerId = existing.id;
        }
      }

      if (!targetCustomerId) {
        const [newUser] = await db
          .insert(users)
          .values({
            name: cleanName || `Customer ${cleanPhone.slice(-4)}`,
            phone: cleanPhone || null,
            email: cleanEmail,
            role: 'customer',
            isActive: true,
          })
          .returning();
        targetCustomerId = newUser.id;
      }
    }

    const profile = await LoyaltyService.getOrCreateCustomerMembership(targetCustomerId, { name, phone, email });
    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error('POS Loyalty Customer POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
