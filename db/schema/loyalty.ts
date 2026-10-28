import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { orders } from './orders';

// ============================================================================
// 1. MEMBERSHIP LEVELS TABLE (Fully configurable by admin)
// ============================================================================
export const loyaltyLevels = pgTable(
  'loyalty_levels',
  {
    id: varchar('id', { length: 40 }).primaryKey(), // 'silver', 'gold', 'platinum', 'happy_customer' or custom slug
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    displayOrder: integer('display_order').notNull().default(1),
    badgeColor: varchar('badge_color', { length: 50 }).notNull().default('slate'), // 'slate' | 'amber' | 'slate-silver' | 'emerald'
    icon: varchar('icon', { length: 30 }).notNull().default('⭐'),
    // Qualifying spending threshold in NPR
    qualifyingSpendThreshold: numeric('qualifying_spend_threshold', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    // 'lifetime' | 'calendar_year' | 'rolling_12_months'
    qualifyingPeriod: varchar('qualifying_period', { length: 30 }).notNull().default('lifetime'),
    // Points earned per NPR 100 eligible spend (e.g. 1.0 = 1 pt/100 NPR, 1.5 = 1.5 pt/100 NPR)
    pointsEarningRate: numeric('points_earning_rate', { precision: 8, scale: 4 })
      .notNull()
      .default('1.0000'),
    // Redemption conversion rate: NPR value per 1 point (default: 1 pt = 1 NPR)
    redemptionConversionRate: numeric('redemption_conversion_rate', { precision: 8, scale: 4 })
      .notNull()
      .default('1.0000'),
    // Minimum points balance required before redemption is allowed
    minRedemptionPoints: integer('min_redemption_points').notNull().default(50),
    // Maximum percentage of eligible order subtotal payable via coins (e.g. 50%)
    maxRedemptionPercentage: numeric('max_redemption_percentage', { precision: 5, scale: 2 })
      .notNull()
      .default('50.00'),
    // Maximum points redeemable per single transaction (0 = no cap)
    maxRedemptionPointsPerTx: integer('max_redemption_points_per_tx').notNull().default(5000),
    // Minimum cash/card/qr amount customer must pay in NPR after coins
    minPayableAfterRedemption: numeric('min_payable_after_redemption', { precision: 10, scale: 2 })
      .notNull()
      .default('50.00'),
    // Exclusive level discount percentage applied on merchandise
    levelDiscountPercentage: numeric('level_discount_percentage', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    // Automatic upgrade when spend threshold reached
    isAutomaticUpgrade: boolean('is_automatic_upgrade').notNull().default(true),
    // Is special VIP tier (e.g. Happy Customer)
    isVipSpecial: boolean('is_vip_special').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    displayOrderIdx: index('loyalty_levels_display_order_idx').on(t.displayOrder),
    activeIdx: index('loyalty_levels_active_idx').on(t.isActive),
  })
);

// ============================================================================
// 2. CUSTOMER MEMBERSHIPS TABLE
// ============================================================================
export const customerMemberships = pgTable(
  'customer_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    membershipNumber: varchar('membership_number', { length: 50 }).notNull().unique(), // e.g. "MEM-2026-0001"
    currentLevelId: varchar('current_level_id', { length: 40 })
      .notNull()
      .references(() => loyaltyLevels.id, { onDelete: 'restrict' })
      .default('silver'),
    status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'suspended' | 'expired' | 'merged'
    // Qualifying spend accumulated towards tier upgrade
    qualifyingSpend: numeric('qualifying_spend', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    // Total lifetime net purchases
    lifetimeNetSpend: numeric('lifetime_net_spend', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    // Coins metrics
    totalCoinsEarned: numeric('total_coins_earned', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    totalCoinsRedeemed: numeric('total_coins_redeemed', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    availableCoins: numeric('available_coins', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    levelUpgradedAt: timestamp('level_upgraded_at').notNull().defaultNow(),
    // VIP override flags
    manualVipOverride: boolean('manual_vip_override').notNull().default(false),
    manualOverrideReason: text('manual_override_reason'),
    manualOverrideBy: varchar('manual_override_by', { length: 150 }),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    customerIdx: uniqueIndex('customer_memberships_customer_idx').on(t.customerId),
    levelIdx: index('customer_memberships_level_idx').on(t.currentLevelId),
    statusIdx: index('customer_memberships_status_idx').on(t.status),
    deletedIdx: index('customer_memberships_deleted_idx').on(t.deletedAt),
  })
);

// ============================================================================
// 3. IMMUTABLE LOYALTY POINTS LEDGER
// ============================================================================
export const loyaltyLedger = pgTable(
  'loyalty_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => customerMemberships.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    orderNumber: varchar('order_number', { length: 50 }),
    // Entry types: 'earned' | 'redeemed' | 'expired' | 'reversed' | 'bonus' | 'manual_adjustment'
    entryType: varchar('entry_type', { length: 30 }).notNull(),
    pointsCredited: numeric('points_credited', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    pointsDebited: numeric('points_debited', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    balanceAfter: numeric('balance_after', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    qualifyingSpendDelta: numeric('qualifying_spend_delta', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    reason: text('reason').notNull(),
    operatorId: varchar('operator_id', { length: 100 }),
    operatorName: varchar('operator_name', { length: 150 }),
    // If this entry reverses a previous transaction
    reversalOfLedgerId: uuid('reversal_of_ledger_id'),
    // Expiry and FIFO points consumption tracking
    expiresAt: timestamp('expires_at'),
    isExpired: boolean('is_expired').notNull().default(false),
    remainingPoints: numeric('remaining_points', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    // Idempotency key to prevent duplicate point grants
    idempotencyKey: varchar('idempotency_key', { length: 150 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    customerIdx: index('loyalty_ledger_customer_idx').on(t.customerId, t.createdAt),
    membershipIdx: index('loyalty_ledger_membership_idx').on(t.membershipId),
    orderIdx: index('loyalty_ledger_order_idx').on(t.orderId),
    entryTypeIdx: index('loyalty_ledger_type_idx').on(t.entryType),
    idempIdx: uniqueIndex('loyalty_ledger_idemp_idx').on(t.idempotencyKey),
    expiresIdx: index('loyalty_ledger_expires_idx').on(t.expiresAt, t.isExpired),
  })
);

// ============================================================================
// 4. LOYALTY OFFERS & PROMOTIONS TABLE
// ============================================================================
export const loyaltyOffers = pgTable(
  'loyalty_offers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(), // e.g. "GOLDVIP10", "HAPPYBONUS"
    title: varchar('title', { length: 150 }).notNull(),
    description: text('description'),
    // 'percentage_discount' | 'fixed_discount' | 'bonus_coins'
    offerType: varchar('offer_type', { length: 30 }).notNull().default('percentage_discount'),
    offerValue: numeric('offer_value', { precision: 12, scale: 2 }).notNull(), // % or flat NPR or bonus coins
    // Eligible membership levels: array of level ids e.g. ["silver", "gold", "platinum", "happy_customer"]
    eligibleLevels: jsonb('eligible_levels').$type<string[]>().notNull().default(['silver', 'gold', 'platinum', 'happy_customer']),
    // Product / Category / Brand targeting
    eligibleCategories: jsonb('eligible_categories').$type<string[]>().notNull().default([]),
    eligibleBrands: jsonb('eligible_brands').$type<string[]>().notNull().default([]),
    eligibleProductIds: jsonb('eligible_product_ids').$type<string[]>().notNull().default([]),
    minSpend: numeric('min_spend', { precision: 12, scale: 2 }).notNull().default('0.00'),
    maxDiscountCap: numeric('max_discount_cap', { precision: 12, scale: 2 }), // optional cap on % discounts
    startsAt: timestamp('starts_at'),
    expiresAt: timestamp('expires_at'),
    usageLimitPerCustomer: integer('usage_limit_per_customer').notNull().default(1),
    globalUsageLimit: integer('global_usage_limit'),
    usedCount: integer('used_count').notNull().default(0),
    stackableWithCoins: boolean('stackable_with_coins').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    deletedAt: timestamp('deleted_at'),
    createdBy: varchar('created_by', { length: 150 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex('loyalty_offers_code_idx').on(t.code),
    activeIdx: index('loyalty_offers_active_idx').on(t.isActive, t.startsAt, t.expiresAt),
  })
);

// ============================================================================
// 5. LOYALTY OFFER REDEMPTIONS TABLE (Audit tracking)
// ============================================================================
export const loyaltyOfferRedemptions = pgTable(
  'loyalty_offer_redemptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    offerId: uuid('offer_id')
      .notNull()
      .references(() => loyaltyOffers.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    orderNumber: varchar('order_number', { length: 50 }),
    discountApplied: numeric('discount_applied', { precision: 12, scale: 2 }).notNull().default('0.00'),
    bonusPointsAwarded: numeric('bonus_points_awarded', { precision: 12, scale: 2 }).notNull().default('0.00'),
    redeemedAt: timestamp('redeemed_at').notNull().defaultNow(),
  },
  (t) => ({
    customerOfferIdx: index('loyalty_offer_redemptions_cust_offer_idx').on(t.customerId, t.offerId),
    orderIdx: index('loyalty_offer_redemptions_order_idx').on(t.orderId),
  })
);

// ============================================================================
// 6. LOYALTY SETTINGS TABLE (Singleton config)
// ============================================================================
export const loyaltySettings = pgTable('loyalty_settings', {
  id: varchar('id', { length: 20 }).primaryKey().default('default'),
  defaultLevelId: varchar('default_level_id', { length: 40 }).notNull().default('silver'),
  // 'net_after_discount' | 'gross' | 'pre_vat'
  earningBasis: varchar('earning_basis', { length: 30 }).notNull().default('net_after_discount'),
  // 'floor' | 'round' | 'ceil'
  pointsRounding: varchar('points_rounding', { length: 20 }).notNull().default('floor'),
  coinExpiryDays: integer('coin_expiry_days').notNull().default(365), // 0 = never
  allowCoinRedemptionWithOffers: boolean('allow_coin_redemption_with_offers').notNull().default(true),
  downgradePolicy: varchar('downgrade_policy', { length: 30 }).notNull().default('disabled'), // 'disabled' | 'annual_reset'
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// 7. LOYALTY LEVEL TRANSITION HISTORY
// ============================================================================
export const loyaltyLevelHistory = pgTable(
  'loyalty_level_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    previousLevelId: varchar('previous_level_id', { length: 40 }),
    newLevelId: varchar('new_level_id', { length: 40 }).notNull(),
    triggerEvent: varchar('trigger_event', { length: 60 }).notNull(), // 'NEW_CUSTOMER_DEFAULT', 'QUALIFYING_SPEND_REACHED', 'MANUAL_OVERRIDE', 'RETURN_REVERSED'
    reason: text('reason'),
    performedBy: varchar('performed_by', { length: 150 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    customerIdx: index('loyalty_level_history_cust_idx').on(t.customerId, t.createdAt),
  })
);
