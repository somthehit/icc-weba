import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loyaltyOffers } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { assertLoyaltyPermission } from '@/lib/loyalty/loyaltyPermissions';

export const dynamic = 'force-dynamic';

// GET: List all offers (excluding soft-deleted)
export async function GET(request: NextRequest) {
  try {
    const authResult = await assertLoyaltyPermission(request, 'view');
    if (authResult instanceof NextResponse) return authResult;

    const offers = await db
      .select()
      .from(loyaltyOffers)
      .where(sql`${loyaltyOffers.deletedAt} IS NULL`)
      .orderBy(desc(loyaltyOffers.createdAt));

    return NextResponse.json({ success: true, offers });
  } catch (error: any) {
    console.error('Admin Loyalty Offers GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create or update an offer
export async function POST(request: NextRequest) {
  try {
    const authResult = await assertLoyaltyPermission(request, 'offer.manage');
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const {
      id,
      code,
      title,
      description,
      offerType = 'percentage_discount',
      offerValue,
      eligibleLevels = ['silver', 'gold', 'platinum', 'happy_customer'],
      eligibleCategories = [],
      eligibleBrands = [],
      eligibleProductIds = [],
      minSpend = '0.00',
      maxDiscountCap,
      startsAt,
      expiresAt,
      usageLimitPerCustomer = 1,
      globalUsageLimit,
      stackableWithCoins = true,
      isActive = true,
      createdBy = 'Admin',
    } = body;

    const cleanCode = String(code || '').trim().toUpperCase();
    const cleanTitle = String(title || '').trim();

    if (!cleanCode || !cleanTitle || offerValue === undefined) {
      return NextResponse.json({ success: false, error: 'Offer code, title, and value are required.' }, { status: 400 });
    }

    if (id) {
      const [updated] = await db
        .update(loyaltyOffers)
        .set({
          code: cleanCode,
          title: cleanTitle,
          description: description || null,
          offerType,
          offerValue: String(Number(offerValue).toFixed(2)),
          eligibleLevels,
          eligibleCategories: Array.isArray(eligibleCategories) ? eligibleCategories : [],
          eligibleBrands: Array.isArray(eligibleBrands) ? eligibleBrands : [],
          eligibleProductIds: Array.isArray(eligibleProductIds) ? eligibleProductIds : [],
          minSpend: String(Number(minSpend || 0).toFixed(2)),
          maxDiscountCap: maxDiscountCap ? String(Number(maxDiscountCap).toFixed(2)) : null,
          startsAt: startsAt ? new Date(startsAt) : null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          usageLimitPerCustomer: Number(usageLimitPerCustomer) || 1,
          globalUsageLimit: globalUsageLimit ? Number(globalUsageLimit) : null,
          stackableWithCoins: Boolean(stackableWithCoins),
          isActive: Boolean(isActive),
          updatedAt: new Date(),
        })
        .where(eq(loyaltyOffers.id, id))
        .returning();

      return NextResponse.json({ success: true, offer: updated, message: `Updated offer ${cleanCode}` });
    }

    // Check duplicate code
    const [existing] = await db
      .select()
      .from(loyaltyOffers)
      .where(and(eq(loyaltyOffers.code, cleanCode), sql`${loyaltyOffers.deletedAt} IS NULL`))
      .limit(1);

    if (existing) {
      return NextResponse.json({ success: false, error: `Offer code "${cleanCode}" already exists.` }, { status: 400 });
    }

    const [created] = await db
      .insert(loyaltyOffers)
      .values({
        code: cleanCode,
        title: cleanTitle,
        description: description || null,
        offerType,
        offerValue: String(Number(offerValue).toFixed(2)),
        eligibleLevels,
        eligibleCategories: Array.isArray(eligibleCategories) ? eligibleCategories : [],
        eligibleBrands: Array.isArray(eligibleBrands) ? eligibleBrands : [],
        eligibleProductIds: Array.isArray(eligibleProductIds) ? eligibleProductIds : [],
        minSpend: String(Number(minSpend || 0).toFixed(2)),
        maxDiscountCap: maxDiscountCap ? String(Number(maxDiscountCap).toFixed(2)) : null,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        usageLimitPerCustomer: Number(usageLimitPerCustomer) || 1,
        globalUsageLimit: globalUsageLimit ? Number(globalUsageLimit) : null,
        stackableWithCoins: Boolean(stackableWithCoins),
        isActive: Boolean(isActive),
        createdBy,
      })
      .returning();

    return NextResponse.json({ success: true, offer: created, message: `Created offer ${cleanCode}` });
  } catch (error: any) {
    console.error('Admin Loyalty Offers POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Soft-delete an offer safely without breaking ledger references
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await assertLoyaltyPermission(request, 'offer.manage');
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Offer ID is required.' }, { status: 400 });
    }

    const [deleted] = await db
      .update(loyaltyOffers)
      .set({
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyOffers.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Offer not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Offer "${deleted.code}" soft-deleted safely.`,
      offer: deleted,
    });
  } catch (error: any) {
    console.error('Admin Loyalty Offers DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
