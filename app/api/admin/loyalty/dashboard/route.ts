// app/api/admin/loyalty/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  customerMemberships,
  loyaltyLevels,
  loyaltyLedger,
  loyaltyOffers,
  users,
} from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Total members
    const [membersCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerMemberships);

    // 2. Breakdown by tier
    const tierCounts = await db
      .select({
        levelId: customerMemberships.currentLevelId,
        levelName: loyaltyLevels.name,
        badgeColor: loyaltyLevels.badgeColor,
        icon: loyaltyLevels.icon,
        count: sql<number>`count(*)::int`,
        totalSpend: sql<number>`coalesce(sum(${customerMemberships.lifetimeNetSpend}), 0)::float`,
      })
      .from(customerMemberships)
      .innerJoin(loyaltyLevels, eq(customerMemberships.currentLevelId, loyaltyLevels.id))
      .groupBy(
        customerMemberships.currentLevelId,
        loyaltyLevels.name,
        loyaltyLevels.badgeColor,
        loyaltyLevels.icon
      );

    // 3. Points Outstanding (Liability in NPR)
    const [coinsMetrics] = await db
      .select({
        totalAvailableCoins: sql<number>`coalesce(sum(${customerMemberships.availableCoins}), 0)::float`,
        totalEarnedCoins: sql<number>`coalesce(sum(${customerMemberships.totalCoinsEarned}), 0)::float`,
        totalRedeemedCoins: sql<number>`coalesce(sum(${customerMemberships.totalCoinsRedeemed}), 0)::float`,
      })
      .from(customerMemberships);

    // 4. Active Offers count
    const [offersCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loyaltyOffers)
      .where(eq(loyaltyOffers.isActive, true));

    // 5. Top customers by qualifying spend
    const topMembers = await db
      .select({
        customerId: customerMemberships.customerId,
        customerName: users.name,
        phone: users.phone,
        membershipNumber: customerMemberships.membershipNumber,
        levelName: loyaltyLevels.name,
        badgeColor: loyaltyLevels.badgeColor,
        qualifyingSpend: customerMemberships.qualifyingSpend,
        lifetimeNetSpend: customerMemberships.lifetimeNetSpend,
        availableCoins: customerMemberships.availableCoins,
      })
      .from(customerMemberships)
      .innerJoin(users, eq(customerMemberships.customerId, users.id))
      .innerJoin(loyaltyLevels, eq(customerMemberships.currentLevelId, loyaltyLevels.id))
      .orderBy(desc(customerMemberships.qualifyingSpend))
      .limit(10);

    // 6. Recent ledger transactions
    const recentActivity = await db
      .select({
        id: loyaltyLedger.id,
        customerId: loyaltyLedger.customerId,
        customerName: users.name,
        orderNumber: loyaltyLedger.orderNumber,
        entryType: loyaltyLedger.entryType,
        pointsCredited: loyaltyLedger.pointsCredited,
        pointsDebited: loyaltyLedger.pointsDebited,
        balanceAfter: loyaltyLedger.balanceAfter,
        reason: loyaltyLedger.reason,
        operatorName: loyaltyLedger.operatorName,
        createdAt: loyaltyLedger.createdAt,
      })
      .from(loyaltyLedger)
      .innerJoin(users, eq(loyaltyLedger.customerId, users.id))
      .orderBy(desc(loyaltyLedger.createdAt))
      .limit(15);

    return NextResponse.json({
      success: true,
      stats: {
        totalMembers: membersCount?.count || 0,
        availableCoinsLiability: coinsMetrics?.totalAvailableCoins || 0,
        totalEarnedCoins: coinsMetrics?.totalEarnedCoins || 0,
        totalRedeemedCoins: coinsMetrics?.totalRedeemedCoins || 0,
        activeOffers: offersCount?.count || 0,
        tierCounts,
        topMembers,
        recentActivity,
      },
    });
  } catch (error: any) {
    console.error('Admin Loyalty Dashboard GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
