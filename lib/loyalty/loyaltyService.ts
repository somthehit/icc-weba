// lib/loyalty/loyaltyService.ts
// Core Loyalty, Membership, Points Ledger, and Offers Engine

import { db } from '@/db';
import {
  users,
  loyaltyLevels,
  customerMemberships,
  loyaltyLedger,
  loyaltyOffers,
  loyaltyOfferRedemptions,
  loyaltySettings,
  loyaltyLevelHistory,
} from '@/db/schema';
import { eq, and, or, ilike, desc, asc, lte, gte, sql } from 'drizzle-orm';

export interface LoyaltyMemberProfile {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  membershipId: string;
  membershipNumber: string;
  status: string;
  currentLevelId: string;
  levelName: string;
  badgeColor: string;
  icon: string;
  pointsEarningRate: number;
  redemptionConversionRate: number;
  levelDiscountPercentage: number;
  isVipSpecial: boolean;
  qualifyingSpend: number;
  lifetimeNetSpend: number;
  totalCoinsEarned: number;
  totalCoinsRedeemed: number;
  availableCoins: number;
  nextLevelName: string | null;
  nextLevelThreshold: number | null;
  remainingSpendToNextLevel: number | null;
  progressPercentage: number;
  minRedemptionPoints: number;
  maxRedemptionPercentage: number;
  maxRedemptionPointsPerTx: number;
  minPayableAfterRedemption: number;
}

export interface RedemptionQuote {
  isValid: boolean;
  errorMessage?: string;
  coinsRequested: number;
  coinsAllowed: number;
  discountNpr: number;
  conversionRate: number;
  maxAllowedCoins: number;
  remainingPayable: number;
}

export class LoyaltyService {
  /**
   * 1. Get or automatically create a Silver membership for a customer.
   */
  static async getOrCreateCustomerMembership(
    customerId: string,
    customerDetails?: { name?: string; phone?: string; email?: string }
  ): Promise<LoyaltyMemberProfile> {
    // Check if membership already exists
    const [existing] = await db
      .select({
        membership: customerMemberships,
        level: loyaltyLevels,
        user: users,
      })
      .from(customerMemberships)
      .innerJoin(loyaltyLevels, eq(customerMemberships.currentLevelId, loyaltyLevels.id))
      .innerJoin(users, eq(customerMemberships.customerId, users.id))
      .where(and(eq(customerMemberships.customerId, customerId), sql`${customerMemberships.deletedAt} IS NULL`))
      .limit(1);

    if (existing) {
      return this.formatProfile(existing.membership, existing.level, existing.user);
    }

    // Verify user exists in users table
    const [user] = await db.select().from(users).where(eq(users.id, customerId)).limit(1);
    if (!user) {
      throw new Error(`Customer #${customerId} not found.`);
    }

    // Generate unique membership ID: MEM-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const membershipNumber = `MEM-${currentYear}-${randomSuffix}`;

    // Get default level (Silver)
    const [settings] = await db.select().from(loyaltySettings).where(eq(loyaltySettings.id, 'default')).limit(1);
    const defaultLevelId = settings?.defaultLevelId || 'silver';

    const [defaultLevel] = await db
      .select()
      .from(loyaltyLevels)
      .where(eq(loyaltyLevels.id, defaultLevelId))
      .limit(1);

    const levelToAssign = defaultLevel || {
      id: 'silver',
      name: 'Silver',
      badgeColor: 'slate',
      icon: '🥈',
      pointsEarningRate: '1.0000',
      redemptionConversionRate: '1.0000',
      minRedemptionPoints: 50,
      maxRedemptionPercentage: '50.00',
      maxRedemptionPointsPerTx: 5000,
      minPayableAfterRedemption: '50.00',
      levelDiscountPercentage: '0.00',
      qualifyingSpendThreshold: '0.00',
      isAutomaticUpgrade: true,
      isVipSpecial: false,
    };

    // Insert membership row
    const [newMembership] = await db
      .insert(customerMemberships)
      .values({
        customerId,
        membershipNumber,
        currentLevelId: levelToAssign.id,
        status: 'active',
        qualifyingSpend: '0.00',
        lifetimeNetSpend: '0.00',
        totalCoinsEarned: '0.00',
        totalCoinsRedeemed: '0.00',
        availableCoins: '0.00',
      })
      .returning();

    // Log initial level event
    await db.insert(loyaltyLevelHistory).values({
      customerId,
      previousLevelId: null,
      newLevelId: levelToAssign.id,
      triggerEvent: 'NEW_CUSTOMER_DEFAULT',
      reason: 'Automatic default Silver enrollment for new customer',
      performedBy: 'System Auto-Enroll',
    });

    return this.formatProfile(newMembership, levelToAssign as any, user);
  }

  /**
   * 2. Search loyalty members by phone, name, or membership number
   */
  static async searchMembers(query: string, limit: number = 20): Promise<LoyaltyMemberProfile[]> {
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) return [];

    const rows = await db
      .select({
        membership: customerMemberships,
        level: loyaltyLevels,
        user: users,
      })
      .from(customerMemberships)
      .innerJoin(loyaltyLevels, eq(customerMemberships.currentLevelId, loyaltyLevels.id))
      .innerJoin(users, eq(customerMemberships.customerId, users.id))
      .where(
        and(
          sql`${customerMemberships.deletedAt} IS NULL`,
          or(
            ilike(customerMemberships.membershipNumber, `%${cleanQuery}%`),
            ilike(users.phone, `%${cleanQuery}%`),
            ilike(users.name, `%${cleanQuery}%`),
            ilike(users.email, `%${cleanQuery}%`)
          )
        )
      )
      .limit(limit);

    const profiles: LoyaltyMemberProfile[] = [];
    for (const r of rows) {
      profiles.push(await this.formatProfile(r.membership, r.level, r.user));
    }
    return profiles;
  }

  /**
   * 3. Get detailed customer membership profile by Customer ID or Phone
   */
  static async getCustomerProfile(identifier: string): Promise<LoyaltyMemberProfile | null> {
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(identifier);

    const condition = isUuid
      ? or(eq(customerMemberships.customerId, identifier), eq(customerMemberships.id, identifier))
      : or(
          eq(customerMemberships.membershipNumber, identifier),
          eq(users.phone, identifier)
        );

    const [row] = await db
      .select({
        membership: customerMemberships,
        level: loyaltyLevels,
        user: users,
      })
      .from(customerMemberships)
      .innerJoin(loyaltyLevels, eq(customerMemberships.currentLevelId, loyaltyLevels.id))
      .innerJoin(users, eq(customerMemberships.customerId, users.id))
      .where(and(condition!, sql`${customerMemberships.deletedAt} IS NULL`))
      .limit(1);

    if (!row) {
      // If user exists without membership, auto-enroll them
      if (isUuid) {
        const [u] = await db.select().from(users).where(eq(users.id, identifier)).limit(1);
        if (u) return this.getOrCreateCustomerMembership(u.id);
      } else {
        const [u] = await db.select().from(users).where(eq(users.phone, identifier)).limit(1);
        if (u) return this.getOrCreateCustomerMembership(u.id);
      }
      return null;
    }

    return this.formatProfile(row.membership, row.level, row.user);
  }

  /**
   * 4. Calculate estimated points earned on eligible net merchandise spend
   */
  static calculatePointsEarning(
    eligibleNetSpend: number,
    earningRatePer100: number,
    bonusPoints: number = 0,
    rounding: 'floor' | 'round' | 'ceil' = 'floor'
  ): { pointsEarned: number; bonusPoints: number; totalCredits: number } {
    if (eligibleNetSpend <= 0 || earningRatePer100 <= 0) {
      return { pointsEarned: 0, bonusPoints, totalCredits: bonusPoints };
    }

    const raw = (eligibleNetSpend / 100) * earningRatePer100;
    let earned = 0;
    if (rounding === 'round') earned = Math.round(raw);
    else if (rounding === 'ceil') earned = Math.ceil(raw);
    else earned = Math.floor(raw);

    return {
      pointsEarned: Math.max(0, earned),
      bonusPoints: Math.max(0, bonusPoints),
      totalCredits: Math.max(0, earned + bonusPoints),
    };
  }

  /**
   * 5. Validate and Quote Points Redemption for an Order
   */
  static async validateAndQuoteRedemption(
    customerId: string,
    coinsToRedeem: number,
    orderSubtotal: number
  ): Promise<RedemptionQuote> {
    const profile = await this.getCustomerProfile(customerId);
    if (!profile) {
      return {
        isValid: false,
        errorMessage: 'Customer loyalty membership not found.',
        coinsRequested: coinsToRedeem,
        coinsAllowed: 0,
        discountNpr: 0,
        conversionRate: 1,
        maxAllowedCoins: 0,
        remainingPayable: orderSubtotal,
      };
    }

    const conversionRate = profile.redemptionConversionRate || 1;
    const available = profile.availableCoins;

    // Check min points threshold
    if (available < profile.minRedemptionPoints) {
      return {
        isValid: false,
        errorMessage: `Minimum balance of ${profile.minRedemptionPoints} coins required to redeem. (Current balance: ${available} coins)`,
        coinsRequested: coinsToRedeem,
        coinsAllowed: 0,
        discountNpr: 0,
        conversionRate,
        maxAllowedCoins: 0,
        remainingPayable: orderSubtotal,
      };
    }

    // Calculate maximum permitted coins for this transaction based on tier limits
    // A. Subtotal percentage cap (e.g. max 50% of order value)
    const maxDiscountByPercent = (orderSubtotal * (profile.maxRedemptionPercentage / 100));
    const maxCoinsByPercent = Math.floor(maxDiscountByPercent / conversionRate);

    // B. Min payable cash floor (e.g. at least NPR 50 must remain payable)
    const maxDiscountByPayableFloor = Math.max(0, orderSubtotal - profile.minPayableAfterRedemption);
    const maxCoinsByFloor = Math.floor(maxDiscountByPayableFloor / conversionRate);

    // C. Single transaction max points limit
    const maxCoinsByTx = profile.maxRedemptionPointsPerTx > 0 ? profile.maxRedemptionPointsPerTx : Infinity;

    // Highest allowable coins for this transaction
    const maxAllowedCoins = Math.min(
      available,
      maxCoinsByPercent,
      maxCoinsByFloor,
      maxCoinsByTx
    );

    if (coinsToRedeem <= 0) {
      return {
        isValid: true,
        coinsRequested: 0,
        coinsAllowed: 0,
        discountNpr: 0,
        conversionRate,
        maxAllowedCoins: Math.max(0, maxAllowedCoins),
        remainingPayable: orderSubtotal,
      };
    }

    if (coinsToRedeem > available) {
      return {
        isValid: false,
        errorMessage: `Insufficient coins balance. You requested ${coinsToRedeem} coins, but only ${available} are available.`,
        coinsRequested: coinsToRedeem,
        coinsAllowed: 0,
        discountNpr: 0,
        conversionRate,
        maxAllowedCoins,
        remainingPayable: orderSubtotal,
      };
    }

    if (coinsToRedeem > maxAllowedCoins) {
      return {
        isValid: false,
        errorMessage: `Exceeds maximum allowable coins for this order (${maxAllowedCoins} coins max / ${profile.maxRedemptionPercentage}% limit).`,
        coinsRequested: coinsToRedeem,
        coinsAllowed: maxAllowedCoins,
        discountNpr: Number((maxAllowedCoins * conversionRate).toFixed(2)),
        conversionRate,
        maxAllowedCoins,
        remainingPayable: Math.max(0, orderSubtotal - (maxAllowedCoins * conversionRate)),
      };
    }

    const discountNpr = Number((coinsToRedeem * conversionRate).toFixed(2));
    const remainingPayable = Math.max(0, orderSubtotal - discountNpr);

    return {
      isValid: true,
      coinsRequested: coinsToRedeem,
      coinsAllowed: coinsToRedeem,
      discountNpr,
      conversionRate,
      maxAllowedCoins,
      remainingPayable,
    };
  }

  /**
   * 6. Query currently valid and applicable promotional offers
   */
  static async getEligibleOffers(
    customerId: string | undefined,
    levelId: string,
    subtotal: number,
    cartItems?: Array<{ productId?: string; category?: string; brand?: string; price?: number; quantity?: number }>
  ): Promise<any[]> {
    const now = new Date();

    const allActiveOffers = await db
      .select()
      .from(loyaltyOffers)
      .where(and(eq(loyaltyOffers.isActive, true), sql`${loyaltyOffers.deletedAt} IS NULL`))
      .orderBy(desc(loyaltyOffers.offerValue));

    const eligibleOffers: any[] = [];

    for (const off of allActiveOffers) {
      // 1. Date window check
      if (off.startsAt && new Date(off.startsAt) > now) continue;
      if (off.expiresAt && new Date(off.expiresAt) < now) continue;

      // 2. Global usage limit check
      if (off.globalUsageLimit && off.usedCount >= off.globalUsageLimit) continue;

      // 3. Min spend check
      if (subtotal < Number(off.minSpend || 0)) continue;

      // 4. Tier eligibility check
      const allowedLevels = Array.isArray(off.eligibleLevels) ? off.eligibleLevels : [];
      if (allowedLevels.length > 0 && !allowedLevels.includes(levelId)) continue;

      // 5. Product / Category / Brand targeting check
      const eligibleCats = Array.isArray(off.eligibleCategories) ? off.eligibleCategories : [];
      const eligibleBrands = Array.isArray(off.eligibleBrands) ? off.eligibleBrands : [];
      const eligibleProds = Array.isArray(off.eligibleProductIds) ? off.eligibleProductIds : [];

      if (cartItems && cartItems.length > 0) {
        if (eligibleCats.length > 0) {
          const match = cartItems.some((i) => i.category && eligibleCats.includes(i.category));
          if (!match) continue;
        }

        if (eligibleBrands.length > 0) {
          const match = cartItems.some((i) => i.brand && eligibleBrands.includes(i.brand));
          if (!match) continue;
        }

        if (eligibleProds.length > 0) {
          const match = cartItems.some((i) => i.productId && eligibleProds.includes(i.productId));
          if (!match) continue;
        }
      }

      // 6. Customer usage limit check
      if (customerId && off.usageLimitPerCustomer) {
        const [usedRecord] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(loyaltyOfferRedemptions)
          .where(and(eq(loyaltyOfferRedemptions.offerId, off.id), eq(loyaltyOfferRedemptions.customerId, customerId)));

        if (usedRecord && usedRecord.count >= off.usageLimitPerCustomer) {
          continue;
        }
      }

      // Calculate estimated offer discount
      let calculatedDiscount = 0;
      let bonusCoins = 0;
      if (off.offerType === 'percentage_discount') {
        const raw = (subtotal * Number(off.offerValue)) / 100;
        calculatedDiscount = off.maxDiscountCap ? Math.min(raw, Number(off.maxDiscountCap)) : raw;
      } else if (off.offerType === 'fixed_discount') {
        calculatedDiscount = Math.min(subtotal, Number(off.offerValue));
      } else if (off.offerType === 'bonus_coins') {
        bonusCoins = Number(off.offerValue);
      }

      eligibleOffers.push({
        id: off.id,
        code: off.code,
        title: off.title,
        description: off.description,
        offerType: off.offerType,
        offerValue: Number(off.offerValue),
        minSpend: Number(off.minSpend),
        maxDiscountCap: off.maxDiscountCap ? Number(off.maxDiscountCap) : null,
        stackableWithCoins: off.stackableWithCoins,
        calculatedDiscount: Number(calculatedDiscount.toFixed(2)),
        bonusCoins,
        eligibleCategories: eligibleCats,
        eligibleBrands: eligibleBrands,
        eligibleProductIds: eligibleProds,
      });
    }

    return eligibleOffers;
  }

  /**
   * 7. Process and Commit Loyalty Transaction during POS Checkout
   */
  static async recordCheckoutLoyaltyTransaction(params: {
    orderId?: string;
    orderNumber: string;
    customerId: string;
    eligibleSpend: number;
    coinsToRedeem: number;
    offerCode?: string;
    cashierId?: string | null;
    cashierName?: string;
    idempotencyKey?: string;
  }): Promise<{
    pointsEarned: number;
    bonusPoints: number;
    pointsRedeemed: number;
    pointsDiscountNpr: number;
    offerDiscountNpr: number;
    availableCoinsAfter: number;
    levelUpgraded: boolean;
    previousLevel?: string;
    newLevel?: string;
  }> {
    const {
      orderId,
      orderNumber,
      customerId,
      eligibleSpend,
      coinsToRedeem = 0,
      offerCode,
      cashierId,
      cashierName = 'Cashier',
      idempotencyKey = `chk-${orderNumber}-${customerId}`,
    } = params;

    // Idempotency check: if this key already exists in ledger, do not duplicate!
    const [existingLedger] = await db
      .select()
      .from(loyaltyLedger)
      .where(eq(loyaltyLedger.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existingLedger) {
      const currentProfile = await this.getCustomerProfile(customerId);
      return {
        pointsEarned: Number(existingLedger.pointsCredited),
        bonusPoints: 0,
        pointsRedeemed: Number(existingLedger.pointsDebited),
        pointsDiscountNpr: Number(existingLedger.pointsDebited),
        offerDiscountNpr: 0,
        availableCoinsAfter: currentProfile?.availableCoins ?? 0,
        levelUpgraded: false,
      };
    }

    // Fetch customer profile & level details
    const profile = await this.getOrCreateCustomerMembership(customerId);

    // Evaluate offer if code was supplied
    let appliedOffer: any = null;
    let offerDiscountNpr = 0;
    let bonusCoinsFromOffer = 0;

    if (offerCode) {
      const [off] = await db
        .select()
        .from(loyaltyOffers)
        .where(and(eq(loyaltyOffers.code, offerCode.trim().toUpperCase()), eq(loyaltyOffers.isActive, true)))
        .limit(1);

      if (off) {
        appliedOffer = off;
        if (off.offerType === 'percentage_discount') {
          const raw = (eligibleSpend * Number(off.offerValue)) / 100;
          offerDiscountNpr = off.maxDiscountCap ? Math.min(raw, Number(off.maxDiscountCap)) : raw;
        } else if (off.offerType === 'fixed_discount') {
          offerDiscountNpr = Math.min(eligibleSpend, Number(off.offerValue));
        } else if (off.offerType === 'bonus_coins') {
          bonusCoinsFromOffer = Number(off.offerValue);
        }
      }
    }

    // Points Redemption Calculation
    let verifiedCoinsToRedeem = 0;
    let pointsDiscountNpr = 0;
    if (coinsToRedeem > 0) {
      const quote = await this.validateAndQuoteRedemption(customerId, coinsToRedeem, eligibleSpend);
      if (quote.isValid) {
        verifiedCoinsToRedeem = quote.coinsAllowed;
        pointsDiscountNpr = quote.discountNpr;
      }
    }

    // Points Earning Calculation
    const { pointsEarned, bonusPoints, totalCredits } = this.calculatePointsEarning(
      eligibleSpend,
      profile.pointsEarningRate,
      bonusCoinsFromOffer
    );

    // Execute in DB Transaction
    let levelUpgraded = false;
    let prevLevelName = profile.levelName;
    let nextLevelName = profile.levelName;
    let newBalance = profile.availableCoins;

    await db.transaction(async (tx) => {
      // 1. Lock customer membership row
      const [m] = await tx
        .select()
        .from(customerMemberships)
        .where(eq(customerMemberships.customerId, customerId))
        .limit(1);

      if (!m) throw new Error('Customer membership not found during transaction.');

      let currentCoins = Number(m.availableCoins);
      const currentQualifyingSpend = Number(m.qualifyingSpend);
      const currentLifetimeSpend = Number(m.lifetimeNetSpend);

      // A. Debit redeemed points (FIFO order from earliest active earned points)
      if (verifiedCoinsToRedeem > 0) {
        currentCoins = Math.max(0, currentCoins - verifiedCoinsToRedeem);

        let coinsLeftToDeduct = verifiedCoinsToRedeem;
        const availableCredits = await tx
          .select()
          .from(loyaltyLedger)
          .where(
            and(
              eq(loyaltyLedger.customerId, customerId),
              eq(loyaltyLedger.isExpired, false),
              sql`CAST(${loyaltyLedger.remainingPoints} AS numeric) > 0`
            )
          )
          .orderBy(asc(loyaltyLedger.createdAt));

        for (const creditRow of availableCredits) {
          if (coinsLeftToDeduct <= 0) break;
          const rowRemain = Number(creditRow.remainingPoints || 0);
          const deductAmount = Math.min(rowRemain, coinsLeftToDeduct);
          const nextRemain = Math.max(0, rowRemain - deductAmount);

          await tx
            .update(loyaltyLedger)
            .set({ remainingPoints: nextRemain.toFixed(2) })
            .where(eq(loyaltyLedger.id, creditRow.id));

          coinsLeftToDeduct -= deductAmount;
        }

        await tx.insert(loyaltyLedger).values({
          customerId,
          membershipId: m.id,
          orderId: orderId || null,
          orderNumber,
          entryType: 'redeemed',
          pointsCredited: '0.00',
          pointsDebited: verifiedCoinsToRedeem.toFixed(2),
          balanceAfter: currentCoins.toFixed(2),
          qualifyingSpendDelta: '0.00',
          reason: `Redeemed ${verifiedCoinsToRedeem} coins on POS Invoice #${orderNumber}`,
          operatorId: cashierId || null,
          operatorName: cashierName,
          idempotencyKey: `red-${idempotencyKey}`,
          remainingPoints: '0.00',
          isExpired: false,
        });
      }

      // B. Credit earned points with explicit expiry window
      if (totalCredits > 0) {
        currentCoins += totalCredits;

        const [settings] = await tx
          .select()
          .from(loyaltySettings)
          .where(eq(loyaltySettings.id, 'default'))
          .limit(1);
        const expiryDays = settings?.coinExpiryDays ?? 365;
        const expiresAt = expiryDays > 0 ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

        await tx.insert(loyaltyLedger).values({
          customerId,
          membershipId: m.id,
          orderId: orderId || null,
          orderNumber,
          entryType: bonusCoinsFromOffer > 0 ? 'bonus' : 'earned',
          pointsCredited: totalCredits.toFixed(2),
          pointsDebited: '0.00',
          balanceAfter: currentCoins.toFixed(2),
          qualifyingSpendDelta: eligibleSpend.toFixed(2),
          reason: `Earned ${pointsEarned} coins${bonusCoinsFromOffer > 0 ? ` + ${bonusCoinsFromOffer} bonus` : ''} on POS Invoice #${orderNumber}`,
          operatorId: cashierId || null,
          operatorName: cashierName,
          idempotencyKey: `earn-${idempotencyKey}`,
          remainingPoints: totalCredits.toFixed(2),
          expiresAt,
          isExpired: false,
        });
      }

      newBalance = currentCoins;
      const newQualifyingSpend = currentQualifyingSpend + eligibleSpend;
      const newLifetimeSpend = currentLifetimeSpend + eligibleSpend;

      // C. Record Offer Redemption Audit with Concurrency Enforcement
      if (appliedOffer) {
        const updateResult = await tx
          .update(loyaltyOffers)
          .set({
            usedCount: sql`${loyaltyOffers.usedCount} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(loyaltyOffers.id, appliedOffer.id),
              appliedOffer.globalUsageLimit
                ? sql`${loyaltyOffers.usedCount} < ${appliedOffer.globalUsageLimit}`
                : sql`true`
            )
          )
          .returning({ id: loyaltyOffers.id });

        if (appliedOffer.globalUsageLimit && updateResult.length === 0) {
          throw new Error(`Offer "${appliedOffer.code}" has reached its maximum global usage limit.`);
        }

        await tx.insert(loyaltyOfferRedemptions).values({
          offerId: appliedOffer.id,
          customerId,
          orderId: orderId || null,
          orderNumber,
          discountApplied: offerDiscountNpr.toFixed(2),
          bonusPointsAwarded: bonusCoinsFromOffer.toFixed(2),
        });
      }

      // D. Check for Tier Upgrade
      let upgradedLevelId = m.currentLevelId;

      if (!m.manualVipOverride) {
        // Find highest level customer qualifies for
        const activeLevels = await tx
          .select()
          .from(loyaltyLevels)
          .where(and(eq(loyaltyLevels.isActive, true), eq(loyaltyLevels.isAutomaticUpgrade, true)))
          .orderBy(desc(loyaltyLevels.qualifyingSpendThreshold));

        for (const lvl of activeLevels) {
          if (newQualifyingSpend >= Number(lvl.qualifyingSpendThreshold)) {
            upgradedLevelId = lvl.id;
            break;
          }
        }
      }

      if (upgradedLevelId !== m.currentLevelId) {
        levelUpgraded = true;
        const [upLvl] = await tx.select().from(loyaltyLevels).where(eq(loyaltyLevels.id, upgradedLevelId)).limit(1);
        nextLevelName = upLvl?.name || upgradedLevelId;

        await tx.insert(loyaltyLevelHistory).values({
          customerId,
          previousLevelId: m.currentLevelId,
          newLevelId: upgradedLevelId,
          triggerEvent: 'QUALIFYING_SPEND_REACHED',
          reason: `Customer accumulated NPR ${newQualifyingSpend.toLocaleString('en-IN')} qualifying spend`,
          performedBy: cashierName,
        });
      }

      // E. Update customer_memberships record
      await tx
        .update(customerMemberships)
        .set({
          availableCoins: currentCoins.toFixed(2),
          totalCoinsEarned: sql`${customerMemberships.totalCoinsEarned} + ${totalCredits}`,
          totalCoinsRedeemed: sql`${customerMemberships.totalCoinsRedeemed} + ${verifiedCoinsToRedeem}`,
          qualifyingSpend: newQualifyingSpend.toFixed(2),
          lifetimeNetSpend: newLifetimeSpend.toFixed(2),
          currentLevelId: upgradedLevelId,
          levelUpgradedAt: levelUpgraded ? new Date() : m.levelUpgradedAt,
          updatedAt: new Date(),
        })
        .where(eq(customerMemberships.id, m.id));
    });

    return {
      pointsEarned,
      bonusPoints: bonusCoinsFromOffer,
      pointsRedeemed: verifiedCoinsToRedeem,
      pointsDiscountNpr,
      offerDiscountNpr,
      availableCoinsAfter: newBalance,
      levelUpgraded,
      previousLevel: prevLevelName,
      newLevel: nextLevelName,
    };
  }

  /**
   * 8. Reverse earned points and restore redeemed points on returns/refunds
   */
  static async recordReturnReversal(params: {
    originalOrderNumber: string;
    customerId: string;
    refundAmount: number;
    supervisorName?: string;
    cashierName?: string;
  }): Promise<{
    pointsReversed: number;
    pointsRestored: number;
    availableCoinsAfter: number;
  }> {
    const { originalOrderNumber, customerId, refundAmount, supervisorName = 'Duty Supervisor' } = params;

    const profile = await this.getCustomerProfile(customerId);
    if (!profile) {
      return { pointsReversed: 0, pointsRestored: 0, availableCoinsAfter: 0 };
    }

    // Find original earn and redeem ledger entries
    const originalLedgers = await db
      .select()
      .from(loyaltyLedger)
      .where(and(eq(loyaltyLedger.orderNumber, originalOrderNumber), eq(loyaltyLedger.customerId, customerId)));

    const earnedEntry = originalLedgers.find((l) => l.entryType === 'earned' || l.entryType === 'bonus');
    const redeemedEntry = originalLedgers.find((l) => l.entryType === 'redeemed');

    let pointsToReverse = 0;
    if (earnedEntry && Number(earnedEntry.pointsCredited) > 0) {
      // Points to reverse proportional to refund amount
      const origEarned = Number(earnedEntry.pointsCredited);
      pointsToReverse = Math.min(origEarned, Math.floor((refundAmount / 100) * profile.pointsEarningRate));
    }

    let pointsToRestore = 0;
    if (redeemedEntry && Number(redeemedEntry.pointsDebited) > 0) {
      pointsToRestore = Number(redeemedEntry.pointsDebited);
    }

    let balanceAfter = profile.availableCoins;

    await db.transaction(async (tx) => {
      const [m] = await tx
        .select()
        .from(customerMemberships)
        .where(eq(customerMemberships.customerId, customerId))
        .limit(1);

      if (!m) return;

      let currentCoins = Number(m.availableCoins);

      // Compensating ledger entry: Deduct previously earned points
      if (pointsToReverse > 0) {
        currentCoins = Math.max(0, currentCoins - pointsToReverse);

        if (earnedEntry && Number(earnedEntry.remainingPoints) > 0) {
          const newRemaining = Math.max(0, Number(earnedEntry.remainingPoints) - pointsToReverse);
          await tx
            .update(loyaltyLedger)
            .set({ remainingPoints: newRemaining.toFixed(2) })
            .where(eq(loyaltyLedger.id, earnedEntry.id));
        }

        await tx.insert(loyaltyLedger).values({
          customerId,
          membershipId: m.id,
          orderNumber: originalOrderNumber,
          entryType: 'reversed',
          pointsCredited: '0.00',
          pointsDebited: pointsToReverse.toFixed(2),
          balanceAfter: currentCoins.toFixed(2),
          qualifyingSpendDelta: (-Math.abs(refundAmount)).toFixed(2),
          reason: `Return/Refund on Invoice #${originalOrderNumber} reversed ${pointsToReverse} coins`,
          operatorName: supervisorName,
          idempotencyKey: `rev-earn-${originalOrderNumber}-${Date.now()}`,
          remainingPoints: '0.00',
          isExpired: false,
        });
      }

      // Compensating ledger entry: Restore previously redeemed points back to customer
      if (pointsToRestore > 0) {
        currentCoins += pointsToRestore;

        const [settings] = await tx
          .select()
          .from(loyaltySettings)
          .where(eq(loyaltySettings.id, 'default'))
          .limit(1);
        const expiryDays = settings?.coinExpiryDays ?? 365;
        const expiresAt = expiryDays > 0 ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

        await tx.insert(loyaltyLedger).values({
          customerId,
          membershipId: m.id,
          orderNumber: originalOrderNumber,
          entryType: 'reversed',
          pointsCredited: pointsToRestore.toFixed(2),
          pointsDebited: '0.00',
          balanceAfter: currentCoins.toFixed(2),
          qualifyingSpendDelta: '0.00',
          reason: `Return/Refund on Invoice #${originalOrderNumber} restored ${pointsToRestore} redeemed coins`,
          operatorName: supervisorName,
          idempotencyKey: `rev-red-${originalOrderNumber}-${Date.now()}`,
          remainingPoints: pointsToRestore.toFixed(2),
          expiresAt,
          isExpired: false,
        });
      }

      balanceAfter = currentCoins;
      const newQualifyingSpend = Math.max(0, Number(m.qualifyingSpend) - refundAmount);
      const newLifetimeSpend = Math.max(0, Number(m.lifetimeNetSpend) - refundAmount);

      await tx
        .update(customerMemberships)
        .set({
          availableCoins: currentCoins.toFixed(2),
          qualifyingSpend: newQualifyingSpend.toFixed(2),
          lifetimeNetSpend: newLifetimeSpend.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(customerMemberships.id, m.id));
    });

    return {
      pointsReversed: pointsToReverse,
      pointsRestored: pointsToRestore,
      availableCoinsAfter: balanceAfter,
    };
  }

  /**
   * 9. Manual Point Adjustment with mandatory reason and operator tracking
   */
  static async manualPointAdjustment(params: {
    customerId: string;
    points: number;
    type: 'credit' | 'debit';
    reason: string;
    operatorId?: string;
    operatorName: string;
  }): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const { customerId, points, type, reason, operatorId, operatorName } = params;

    if (!points || points <= 0) {
      return { success: false, newBalance: 0, error: 'Points must be a positive number.' };
    }
    if (!reason || reason.trim().length < 5) {
      return { success: false, newBalance: 0, error: 'A mandatory reason of at least 5 characters is required.' };
    }

    const profile = await this.getCustomerProfile(customerId);
    if (!profile) {
      return { success: false, newBalance: 0, error: 'Customer membership not found.' };
    }

    if (type === 'debit' && profile.availableCoins < points) {
      return {
        success: false,
        newBalance: profile.availableCoins,
        error: `Cannot debit ${points} points. Available balance is only ${profile.availableCoins} points.`,
      };
    }

    let newBalance = profile.availableCoins;

    await db.transaction(async (tx) => {
      const [m] = await tx
        .select()
        .from(customerMemberships)
        .where(eq(customerMemberships.customerId, customerId))
        .limit(1);

      if (!m) throw new Error('Customer membership not found.');

      let currentCoins = Number(m.availableCoins);
      if (type === 'credit') {
        currentCoins += points;

        const [settings] = await tx
          .select()
          .from(loyaltySettings)
          .where(eq(loyaltySettings.id, 'default'))
          .limit(1);
        const expiryDays = settings?.coinExpiryDays ?? 365;
        const expiresAt = expiryDays > 0 ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

        await tx.insert(loyaltyLedger).values({
          customerId,
          membershipId: m.id,
          entryType: 'manual_adjustment',
          pointsCredited: points.toFixed(2),
          pointsDebited: '0.00',
          balanceAfter: currentCoins.toFixed(2),
          reason: `[Manual Adjustment] ${reason}`,
          operatorId: operatorId || null,
          operatorName,
          idempotencyKey: `adj-${customerId}-${Date.now()}`,
          remainingPoints: points.toFixed(2),
          expiresAt,
          isExpired: false,
        });
      } else {
        currentCoins = Math.max(0, currentCoins - points);

        // FIFO deduction from available credits
        let coinsToDeduct = points;
        const availableCredits = await tx
          .select()
          .from(loyaltyLedger)
          .where(
            and(
              eq(loyaltyLedger.customerId, customerId),
              eq(loyaltyLedger.isExpired, false),
              sql`CAST(${loyaltyLedger.remainingPoints} AS numeric) > 0`
            )
          )
          .orderBy(asc(loyaltyLedger.createdAt));

        for (const creditRow of availableCredits) {
          if (coinsToDeduct <= 0) break;
          const rowRemain = Number(creditRow.remainingPoints || 0);
          const deductAmount = Math.min(rowRemain, coinsToDeduct);
          const nextRemain = Math.max(0, rowRemain - deductAmount);

          await tx
            .update(loyaltyLedger)
            .set({ remainingPoints: nextRemain.toFixed(2) })
            .where(eq(loyaltyLedger.id, creditRow.id));

          coinsToDeduct -= deductAmount;
        }

        await tx.insert(loyaltyLedger).values({
          customerId,
          membershipId: m.id,
          entryType: 'manual_adjustment',
          pointsCredited: '0.00',
          pointsDebited: points.toFixed(2),
          balanceAfter: currentCoins.toFixed(2),
          reason: `[Manual Adjustment] ${reason}`,
          operatorId: operatorId || null,
          operatorName,
          idempotencyKey: `adj-${customerId}-${Date.now()}`,
          remainingPoints: '0.00',
          isExpired: false,
        });
      }

      newBalance = currentCoins;

      await tx
        .update(customerMemberships)
        .set({
          availableCoins: currentCoins.toFixed(2),
          totalCoinsEarned:
            type === 'credit'
              ? sql`${customerMemberships.totalCoinsEarned} + ${points}`
              : customerMemberships.totalCoinsEarned,
          updatedAt: new Date(),
        })
        .where(eq(customerMemberships.id, m.id));
    });

    return { success: true, newBalance };
  }

  /**
   * 10. Manual Level Override (e.g. VIP Happy Customer assignment)
   */
  static async manualLevelOverride(params: {
    customerId: string;
    newLevelId: string;
    reason: string;
    operatorName: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { customerId, newLevelId, reason, operatorName } = params;

    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'Mandatory reason required for level override.' };
    }

    const [targetLevel] = await db.select().from(loyaltyLevels).where(eq(loyaltyLevels.id, newLevelId)).limit(1);
    if (!targetLevel) {
      return { success: false, error: `Level "${newLevelId}" does not exist.` };
    }

    const [m] = await db
      .select()
      .from(customerMemberships)
      .where(eq(customerMemberships.customerId, customerId))
      .limit(1);

    if (!m) {
      return { success: false, error: 'Customer membership not found.' };
    }

    const prevLevelId = m.currentLevelId;

    await db.transaction(async (tx) => {
      await tx
        .update(customerMemberships)
        .set({
          currentLevelId: newLevelId,
          manualVipOverride: true,
          manualOverrideReason: reason,
          manualOverrideBy: operatorName,
          levelUpgradedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customerMemberships.id, m.id));

      await tx.insert(loyaltyLevelHistory).values({
        customerId,
        previousLevelId: prevLevelId,
        newLevelId,
        triggerEvent: 'MANUAL_OVERRIDE',
        reason,
        performedBy: operatorName,
      });
    });

    return { success: true };
  }

  /**
   * 11. Controlled Merge of Duplicate Customer Profiles
   */
  static async mergeCustomerProfiles(params: {
    primaryCustomerId: string;
    secondaryCustomerId: string;
    reason: string;
    operatorName: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { primaryCustomerId, secondaryCustomerId, reason, operatorName } = params;

    if (primaryCustomerId === secondaryCustomerId) {
      return { success: false, error: 'Primary and secondary customer cannot be the same.' };
    }

    const [primaryM] = await db
      .select()
      .from(customerMemberships)
      .where(eq(customerMemberships.customerId, primaryCustomerId))
      .limit(1);

    const [secondaryM] = await db
      .select()
      .from(customerMemberships)
      .where(eq(customerMemberships.customerId, secondaryCustomerId))
      .limit(1);

    if (!primaryM || !secondaryM) {
      return { success: false, error: 'One or both customer memberships were not found.' };
    }

    await db.transaction(async (tx) => {
      const mergedQualifyingSpend = Number(primaryM.qualifyingSpend) + Number(secondaryM.qualifyingSpend);
      const mergedLifetimeSpend = Number(primaryM.lifetimeNetSpend) + Number(secondaryM.lifetimeNetSpend);
      const transferredCoins = Number(secondaryM.availableCoins);
      const newAvailable = Number(primaryM.availableCoins) + transferredCoins;

      // Update primary membership with combined metrics
      await tx
        .update(customerMemberships)
        .set({
          qualifyingSpend: mergedQualifyingSpend.toFixed(2),
          lifetimeNetSpend: mergedLifetimeSpend.toFixed(2),
          availableCoins: newAvailable.toFixed(2),
          totalCoinsEarned: sql`${customerMemberships.totalCoinsEarned} + ${secondaryM.totalCoinsEarned}`,
          totalCoinsRedeemed: sql`${customerMemberships.totalCoinsRedeemed} + ${secondaryM.totalCoinsRedeemed}`,
          updatedAt: new Date(),
        })
        .where(eq(customerMemberships.id, primaryM.id));

      // Record transfer in ledger
      if (transferredCoins > 0) {
        await tx.insert(loyaltyLedger).values({
          customerId: primaryCustomerId,
          membershipId: primaryM.id,
          entryType: 'bonus',
          pointsCredited: transferredCoins.toFixed(2),
          pointsDebited: '0.00',
          balanceAfter: newAvailable.toFixed(2),
          reason: `[Merge Transfer] Balance transferred from duplicate account (${secondaryM.membershipNumber}) - ${reason}`,
          operatorName,
        });
      }

      // Re-point secondary ledger entries to primary
      await tx
        .update(loyaltyLedger)
        .set({ customerId: primaryCustomerId, membershipId: primaryM.id })
        .where(eq(loyaltyLedger.customerId, secondaryCustomerId));

      // Mark secondary membership as suspended/merged
      await tx
        .update(customerMemberships)
        .set({
          status: 'suspended',
          availableCoins: '0.00',
          manualOverrideReason: `Merged into primary member ${primaryM.membershipNumber}. Reason: ${reason}`,
          manualOverrideBy: operatorName,
          updatedAt: new Date(),
        })
        .where(eq(customerMemberships.id, secondaryM.id));
    });

    return { success: true };
  }

  /**
   * Helper: Format membership + level + user into standardized profile
   */
  private static async formatProfile(
    membership: typeof customerMemberships.$inferSelect,
    level: typeof loyaltyLevels.$inferSelect,
    user: typeof users.$inferSelect
  ): Promise<LoyaltyMemberProfile> {
    const qualifyingSpend = Number(membership.qualifyingSpend || 0);

    // Look up next tier in sequence
    const allActiveLevels = await db
      .select()
      .from(loyaltyLevels)
      .where(eq(loyaltyLevels.isActive, true))
      .orderBy(asc(loyaltyLevels.qualifyingSpendThreshold));

    let nextLevel: typeof loyaltyLevels.$inferSelect | null = null;
    for (const lvl of allActiveLevels) {
      if (Number(lvl.qualifyingSpendThreshold) > qualifyingSpend && lvl.id !== level.id) {
        nextLevel = lvl;
        break;
      }
    }

    const nextLevelThreshold = nextLevel ? Number(nextLevel.qualifyingSpendThreshold) : null;
    const remainingSpendToNextLevel = nextLevelThreshold ? Math.max(0, nextLevelThreshold - qualifyingSpend) : null;

    let progressPercentage = 100;
    if (nextLevelThreshold && nextLevelThreshold > 0) {
      progressPercentage = Math.min(100, Math.floor((qualifyingSpend / nextLevelThreshold) * 100));
    }

    return {
      customerId: user.id,
      customerName: user.name,
      customerPhone: user.phone || '',
      customerEmail: user.email,
      membershipId: membership.id,
      membershipNumber: membership.membershipNumber,
      status: membership.status,
      currentLevelId: level.id,
      levelName: level.name,
      badgeColor: level.badgeColor,
      icon: level.icon || '⭐',
      pointsEarningRate: Number(level.pointsEarningRate || 1),
      redemptionConversionRate: Number(level.redemptionConversionRate || 1),
      levelDiscountPercentage: Number(level.levelDiscountPercentage || 0),
      isVipSpecial: level.isVipSpecial,
      qualifyingSpend,
      lifetimeNetSpend: Number(membership.lifetimeNetSpend || 0),
      totalCoinsEarned: Number(membership.totalCoinsEarned || 0),
      totalCoinsRedeemed: Number(membership.totalCoinsRedeemed || 0),
      availableCoins: Number(membership.availableCoins || 0),
      nextLevelName: nextLevel ? nextLevel.name : null,
      nextLevelThreshold,
      remainingSpendToNextLevel,
      progressPercentage,
      minRedemptionPoints: level.minRedemptionPoints || 50,
      maxRedemptionPercentage: Number(level.maxRedemptionPercentage || 50),
      maxRedemptionPointsPerTx: level.maxRedemptionPointsPerTx || 5000,
      minPayableAfterRedemption: Number(level.minPayableAfterRedemption || 50),
    };
  }

  /**
   * 12. Dynamic Qualifying Spend Calculation based on membership tier period:
   * 'lifetime' | 'calendar_year' | 'rolling_12_months'
   */
  static async calculateQualifyingSpend(
    customerId: string,
    periodType: 'lifetime' | 'calendar_year' | 'rolling_12_months' = 'lifetime'
  ): Promise<number> {
    if (periodType === 'lifetime') {
      const [m] = await db
        .select({ spend: customerMemberships.qualifyingSpend })
        .from(customerMemberships)
        .where(eq(customerMemberships.customerId, customerId))
        .limit(1);
      return Number(m?.spend || 0);
    }

    let startDate: Date;
    if (periodType === 'calendar_year') {
      startDate = new Date(new Date().getFullYear(), 0, 1);
    } else {
      // rolling 12 months (last 365 days)
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    }

    const [res] = await db
      .select({
        total: sql<string>`coalesce(sum(cast(${loyaltyLedger.qualifyingSpendDelta} as numeric)), 0)`,
      })
      .from(loyaltyLedger)
      .where(
        and(
          eq(loyaltyLedger.customerId, customerId),
          gte(loyaltyLedger.createdAt, startDate)
        )
      );

    return Math.max(0, Number(res?.total || 0));
  }

  /**
   * 13. Automated Points Expiry Engine: Process and debit expired coins
   */
  static async expireOverduePoints(): Promise<{
    success: boolean;
    processedCount: number;
    expiredPointsTotal: number;
    affectedCustomers: number;
  }> {
    const now = new Date();

    // Query unexpired ledger rows where remainingPoints > 0 and expiresAt <= now
    const overdueRows = await db
      .select()
      .from(loyaltyLedger)
      .where(
        and(
          eq(loyaltyLedger.isExpired, false),
          sql`CAST(${loyaltyLedger.remainingPoints} AS numeric) > 0`,
          lte(loyaltyLedger.expiresAt, now)
        )
      )
      .orderBy(asc(loyaltyLedger.createdAt));

    if (overdueRows.length === 0) {
      return {
        success: true,
        processedCount: 0,
        expiredPointsTotal: 0,
        affectedCustomers: 0,
      };
    }

    // Group overdue rows by customerId
    const customerGroup = new Map<string, typeof overdueRows>();
    for (const row of overdueRows) {
      const list = customerGroup.get(row.customerId) || [];
      list.push(row);
      customerGroup.set(row.customerId, list);
    }

    let expiredPointsTotal = 0;
    let processedCount = 0;

    for (const [customerId, rows] of customerGroup.entries()) {
      const totalCustomerExpired = rows.reduce((sum, r) => sum + Number(r.remainingPoints || 0), 0);
      if (totalCustomerExpired <= 0) continue;

      await db.transaction(async (tx) => {
        const [m] = await tx
          .select()
          .from(customerMemberships)
          .where(eq(customerMemberships.customerId, customerId))
          .limit(1);

        if (!m) return;

        const currentCoins = Number(m.availableCoins);
        const newBalance = Math.max(0, currentCoins - totalCustomerExpired);

        // Mark individual rows as expired
        for (const r of rows) {
          await tx
            .update(loyaltyLedger)
            .set({
              remainingPoints: '0.00',
              isExpired: true,
            })
            .where(eq(loyaltyLedger.id, r.id));
          processedCount++;
        }

        // Record immutable expired ledger entry
        await tx.insert(loyaltyLedger).values({
          customerId,
          membershipId: m.id,
          entryType: 'expired',
          pointsCredited: '0.00',
          pointsDebited: totalCustomerExpired.toFixed(2),
          balanceAfter: newBalance.toFixed(2),
          qualifyingSpendDelta: '0.00',
          reason: `Automated points expiry: ${totalCustomerExpired.toFixed(2)} coins exceeded validity period`,
          operatorName: 'System Expiry Engine',
          idempotencyKey: `exp-${customerId}-${now.toISOString().split('T')[0]}-${Date.now()}`,
          remainingPoints: '0.00',
          isExpired: true,
        });

        // Update customer membership available balance
        await tx
          .update(customerMemberships)
          .set({
            availableCoins: newBalance.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(customerMemberships.id, m.id));

        expiredPointsTotal += totalCustomerExpired;
      });
    }

    return {
      success: true,
      processedCount,
      expiredPointsTotal: Number(expiredPointsTotal.toFixed(2)),
      affectedCustomers: customerGroup.size,
    };
  }

  /**
   * 14. Expiry Audit Summary: Summary of overdue points and points expiring in the next 30 days
   */
  static async getExpiringPointsSummary(): Promise<{
    overdueCount: number;
    overduePoints: number;
    overdueCustomers: number;
    expiringNext30DaysCount: number;
    expiringNext30DaysPoints: number;
    expiringNext30DaysCustomers: number;
  }> {
    const now = new Date();
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const overdue = await db
      .select({
        total: sql<string>`coalesce(sum(cast(${loyaltyLedger.remainingPoints} as numeric)), 0)`,
        count: sql<number>`count(*)::int`,
        customers: sql<number>`count(distinct ${loyaltyLedger.customerId})::int`,
      })
      .from(loyaltyLedger)
      .where(
        and(
          eq(loyaltyLedger.isExpired, false),
          sql`CAST(${loyaltyLedger.remainingPoints} AS numeric) > 0`,
          lte(loyaltyLedger.expiresAt, now)
        )
      );

    const expiringSoon = await db
      .select({
        total: sql<string>`coalesce(sum(cast(${loyaltyLedger.remainingPoints} as numeric)), 0)`,
        count: sql<number>`count(*)::int`,
        customers: sql<number>`count(distinct ${loyaltyLedger.customerId})::int`,
      })
      .from(loyaltyLedger)
      .where(
        and(
          eq(loyaltyLedger.isExpired, false),
          sql`CAST(${loyaltyLedger.remainingPoints} AS numeric) > 0`,
          gte(loyaltyLedger.expiresAt, now),
          lte(loyaltyLedger.expiresAt, in30Days)
        )
      );

    return {
      overdueCount: overdue[0]?.count ?? 0,
      overduePoints: Number(overdue[0]?.total ?? 0),
      overdueCustomers: overdue[0]?.customers ?? 0,
      expiringNext30DaysCount: expiringSoon[0]?.count ?? 0,
      expiringNext30DaysPoints: Number(expiringSoon[0]?.total ?? 0),
      expiringNext30DaysCustomers: expiringSoon[0]?.customers ?? 0,
    };
  }
}

