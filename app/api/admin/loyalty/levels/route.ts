// app/api/admin/loyalty/levels/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loyaltyLevels, loyaltySettings } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { assertLoyaltyPermission } from '@/lib/loyalty/loyaltyPermissions';

export const dynamic = 'force-dynamic';

// GET: List all membership levels
export async function GET(request: NextRequest) {
  try {
    const authResult = await assertLoyaltyPermission(request, 'view');
    if (authResult instanceof NextResponse) return authResult;

    const levels = await db
      .select()
      .from(loyaltyLevels)
      .orderBy(asc(loyaltyLevels.displayOrder));

    const [settings] = await db
      .select()
      .from(loyaltySettings)
      .where(eq(loyaltySettings.id, 'default'))
      .limit(1);

    return NextResponse.json({
      success: true,
      levels,
      settings: settings || {
        defaultLevelId: 'silver',
        earningBasis: 'net_after_discount',
        pointsRounding: 'floor',
        coinExpiryDays: 365,
        allowCoinRedemptionWithOffers: true,
        downgradePolicy: 'disabled',
      },
    });
  } catch (error: any) {
    console.error('Admin Loyalty Levels GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create or Update a membership level
export async function POST(request: NextRequest) {
  try {
    const authResult = await assertLoyaltyPermission(request, 'level.manage');
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const {
      id,
      name,
      description,
      displayOrder = 1,
      badgeColor = 'slate',
      icon = '⭐',
      qualifyingSpendThreshold = '0.00',
      qualifyingPeriod = 'lifetime',
      pointsEarningRate = '1.0000',
      redemptionConversionRate = '1.0000',
      minRedemptionPoints = 50,
      maxRedemptionPercentage = '50.00',
      maxRedemptionPointsPerTx = 5000,
      minPayableAfterRedemption = '50.00',
      levelDiscountPercentage = '0.00',
      isAutomaticUpgrade = true,
      isVipSpecial = false,
      isActive = true,
    } = body;

    const cleanId = String(id || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const cleanName = String(name || '').trim();

    if (!cleanId || !cleanName) {
      return NextResponse.json({ success: false, error: 'Level ID and Name are required.' }, { status: 400 });
    }

    // Input validation on thresholds and rates
    if (Number(qualifyingSpendThreshold) < 0) {
      return NextResponse.json({ success: false, error: 'Qualifying spend threshold cannot be negative.' }, { status: 400 });
    }
    if (Number(pointsEarningRate) < 0 || Number(redemptionConversionRate) < 0) {
      return NextResponse.json({ success: false, error: 'Points earning and conversion rates cannot be negative.' }, { status: 400 });
    }
    if (Number(maxRedemptionPercentage) < 0 || Number(maxRedemptionPercentage) > 100) {
      return NextResponse.json({ success: false, error: 'Max redemption percentage must be between 0 and 100%.' }, { status: 400 });
    }
    if (Number(minRedemptionPoints) < 0 || Number(minPayableAfterRedemption) < 0) {
      return NextResponse.json({ success: false, error: 'Redemption points and payable floor must be zero or positive.' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(loyaltyLevels)
      .where(eq(loyaltyLevels.id, cleanId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(loyaltyLevels)
        .set({
          name: cleanName,
          description: description || null,
          displayOrder: Number(displayOrder) || 1,
          badgeColor,
          icon,
          qualifyingSpendThreshold: String(Number(qualifyingSpendThreshold || 0).toFixed(2)),
          qualifyingPeriod,
          pointsEarningRate: String(Number(pointsEarningRate || 1).toFixed(4)),
          redemptionConversionRate: String(Number(redemptionConversionRate || 1).toFixed(4)),
          minRedemptionPoints: Number(minRedemptionPoints) || 50,
          maxRedemptionPercentage: String(Number(maxRedemptionPercentage || 50).toFixed(2)),
          maxRedemptionPointsPerTx: Number(maxRedemptionPointsPerTx) || 5000,
          minPayableAfterRedemption: String(Number(minPayableAfterRedemption || 50).toFixed(2)),
          levelDiscountPercentage: String(Number(levelDiscountPercentage || 0).toFixed(2)),
          isAutomaticUpgrade: Boolean(isAutomaticUpgrade),
          isVipSpecial: Boolean(isVipSpecial),
          isActive: Boolean(isActive),
          updatedAt: new Date(),
        })
        .where(eq(loyaltyLevels.id, cleanId))
        .returning();

      return NextResponse.json({ success: true, level: updated, message: `Updated tier ${cleanName}` });
    }

    const [created] = await db
      .insert(loyaltyLevels)
      .values({
        id: cleanId,
        name: cleanName,
        description: description || null,
        displayOrder: Number(displayOrder) || 1,
        badgeColor,
        icon,
        qualifyingSpendThreshold: String(Number(qualifyingSpendThreshold || 0).toFixed(2)),
        qualifyingPeriod,
        pointsEarningRate: String(Number(pointsEarningRate || 1).toFixed(4)),
        redemptionConversionRate: String(Number(redemptionConversionRate || 1).toFixed(4)),
        minRedemptionPoints: Number(minRedemptionPoints) || 50,
        maxRedemptionPercentage: String(Number(maxRedemptionPercentage || 50).toFixed(2)),
        maxRedemptionPointsPerTx: Number(maxRedemptionPointsPerTx) || 5000,
        minPayableAfterRedemption: String(Number(minPayableAfterRedemption || 50).toFixed(2)),
        levelDiscountPercentage: String(Number(levelDiscountPercentage || 0).toFixed(2)),
        isAutomaticUpgrade: Boolean(isAutomaticUpgrade),
        isVipSpecial: Boolean(isVipSpecial),
        isActive: Boolean(isActive),
      })
      .returning();

    return NextResponse.json({ success: true, level: created, message: `Created new tier ${cleanName}` });
  } catch (error: any) {
    console.error('Admin Loyalty Levels POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
