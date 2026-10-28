// app/api/admin/loyalty/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  customerMemberships,
  loyaltyLevels,
  loyaltyLedger,
  loyaltyOffers,
  loyaltyOfferRedemptions,
  users,
} from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Points breakdown by entry type
    const pointsByType = await db
      .select({
        entryType: loyaltyLedger.entryType,
        totalCredited: sql<number>`coalesce(sum(${loyaltyLedger.pointsCredited}), 0)::float`,
        totalDebited: sql<number>`coalesce(sum(${loyaltyLedger.pointsDebited}), 0)::float`,
        txCount: sql<number>`count(*)::int`,
      })
      .from(loyaltyLedger)
      .groupBy(loyaltyLedger.entryType);

    // 2. Outstanding liability (total available coins * redemption conversion rate)
    const [liability] = await db
      .select({
        totalAvailableCoins: sql<number>`coalesce(sum(${customerMemberships.availableCoins}), 0)::float`,
        totalQualifyingSpend: sql<number>`coalesce(sum(${customerMemberships.qualifyingSpend}), 0)::float`,
        totalLifetimeNetSpend: sql<number>`coalesce(sum(${customerMemberships.lifetimeNetSpend}), 0)::float`,
      })
      .from(customerMemberships);

    // 3. Member distribution across tiers
    const tierDistribution = await db
      .select({
        levelId: customerMemberships.currentLevelId,
        levelName: loyaltyLevels.name,
        badgeColor: loyaltyLevels.badgeColor,
        memberCount: sql<number>`count(*)::int`,
        averageSpend: sql<number>`coalesce(avg(${customerMemberships.lifetimeNetSpend}), 0)::float`,
      })
      .from(customerMemberships)
      .innerJoin(loyaltyLevels, eq(customerMemberships.currentLevelId, loyaltyLevels.id))
      .groupBy(customerMemberships.currentLevelId, loyaltyLevels.name, loyaltyLevels.badgeColor);

    // 4. Offer performance
    const offerPerformance = await db
      .select({
        offerId: loyaltyOffers.id,
        code: loyaltyOffers.code,
        title: loyaltyOffers.title,
        offerType: loyaltyOffers.offerType,
        usedCount: loyaltyOffers.usedCount,
        totalDiscountGiven: sql<number>`coalesce(sum(${loyaltyOfferRedemptions.discountApplied}), 0)::float`,
        totalBonusPointsAwarded: sql<number>`coalesce(sum(${loyaltyOfferRedemptions.bonusPointsAwarded}), 0)::float`,
      })
      .from(loyaltyOffers)
      .leftJoin(loyaltyOfferRedemptions, eq(loyaltyOffers.id, loyaltyOfferRedemptions.offerId))
      .groupBy(loyaltyOffers.id, loyaltyOffers.code, loyaltyOffers.title, loyaltyOffers.offerType, loyaltyOffers.usedCount)
      .orderBy(desc(loyaltyOffers.usedCount));

    return NextResponse.json({
      success: true,
      report: {
        pointsByType,
        liability: {
          availableCoins: liability?.totalAvailableCoins || 0,
          estimatedNprLiability: liability?.totalAvailableCoins || 0,
          totalQualifyingSpend: liability?.totalQualifyingSpend || 0,
          totalLifetimeNetSpend: liability?.totalLifetimeNetSpend || 0,
        },
        tierDistribution,
        offerPerformance,
      },
    });
  } catch (error: any) {
    console.error('Admin Loyalty Reports GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
