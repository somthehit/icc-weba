-- drizzle/migrations/0030_customer_loyalty_and_membership.sql
-- Customer Loyalty, Membership Levels, Points Ledger, Offers, and Settings

CREATE TABLE IF NOT EXISTS "loyalty_levels" (
  "id" varchar(40) PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "description" text,
  "display_order" integer NOT NULL DEFAULT 1,
  "badge_color" varchar(50) NOT NULL DEFAULT 'slate',
  "icon" varchar(30) NOT NULL DEFAULT '⭐',
  "qualifying_spend_threshold" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "qualifying_period" varchar(30) NOT NULL DEFAULT 'lifetime',
  "points_earning_rate" numeric(8, 4) NOT NULL DEFAULT 1.0000,
  "redemption_conversion_rate" numeric(8, 4) NOT NULL DEFAULT 1.0000,
  "min_redemption_points" integer NOT NULL DEFAULT 50,
  "max_redemption_percentage" numeric(5, 2) NOT NULL DEFAULT 50.00,
  "max_redemption_points_per_tx" integer NOT NULL DEFAULT 5000,
  "min_payable_after_redemption" numeric(10, 2) NOT NULL DEFAULT 50.00,
  "level_discount_percentage" numeric(5, 2) NOT NULL DEFAULT 0.00,
  "is_automatic_upgrade" boolean NOT NULL DEFAULT true,
  "is_vip_special" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_levels_display_order_idx" ON "loyalty_levels"("display_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_levels_active_idx" ON "loyalty_levels"("is_active");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "membership_number" varchar(50) NOT NULL,
  "current_level_id" varchar(40) NOT NULL REFERENCES "loyalty_levels"("id") ON DELETE RESTRICT DEFAULT 'silver',
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "qualifying_spend" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "lifetime_net_spend" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "total_coins_earned" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "total_coins_redeemed" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "available_coins" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "level_upgraded_at" timestamp NOT NULL DEFAULT now(),
  "manual_vip_override" boolean NOT NULL DEFAULT false,
  "manual_override_reason" text,
  "manual_override_by" varchar(150),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_memberships_customer_idx" ON "customer_memberships"("customer_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_memberships_num_idx" ON "customer_memberships"("membership_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_memberships_level_idx" ON "customer_memberships"("current_level_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_memberships_status_idx" ON "customer_memberships"("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "loyalty_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "membership_id" uuid NOT NULL REFERENCES "customer_memberships"("id") ON DELETE CASCADE,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "order_number" varchar(50),
  "entry_type" varchar(30) NOT NULL,
  "points_credited" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "points_debited" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "balance_after" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "qualifying_spend_delta" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "reason" text NOT NULL,
  "operator_id" varchar(100),
  "operator_name" varchar(150),
  "reversal_of_ledger_id" uuid,
  "idempotency_key" varchar(150),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_ledger_customer_idx" ON "loyalty_ledger"("customer_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_ledger_membership_idx" ON "loyalty_ledger"("membership_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_ledger_order_idx" ON "loyalty_ledger"("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_ledger_type_idx" ON "loyalty_ledger"("entry_type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_ledger_idemp_idx" ON "loyalty_ledger"("idempotency_key");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "loyalty_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" varchar(50) NOT NULL,
  "title" varchar(150) NOT NULL,
  "description" text,
  "offer_type" varchar(30) NOT NULL DEFAULT 'percentage_discount',
  "offer_value" numeric(12, 2) NOT NULL,
  "eligible_levels" jsonb NOT NULL DEFAULT '["silver","gold","platinum","happy_customer"]',
  "min_spend" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "max_discount_cap" numeric(12, 2),
  "starts_at" timestamp,
  "expires_at" timestamp,
  "usage_limit_per_customer" integer NOT NULL DEFAULT 1,
  "global_usage_limit" integer,
  "used_count" integer NOT NULL DEFAULT 0,
  "stackable_with_coins" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" varchar(150),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_offers_code_idx" ON "loyalty_offers"("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_offers_active_idx" ON "loyalty_offers"("is_active", "starts_at", "expires_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "loyalty_offer_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "offer_id" uuid NOT NULL REFERENCES "loyalty_offers"("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "order_number" varchar(50),
  "discount_applied" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "bonus_points_awarded" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "redeemed_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_offer_redemptions_cust_offer_idx" ON "loyalty_offer_redemptions"("customer_id", "offer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_offer_redemptions_order_idx" ON "loyalty_offer_redemptions"("order_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "loyalty_settings" (
  "id" varchar(20) PRIMARY KEY DEFAULT 'default',
  "default_level_id" varchar(40) NOT NULL DEFAULT 'silver',
  "earning_basis" varchar(30) NOT NULL DEFAULT 'net_after_discount',
  "points_rounding" varchar(20) NOT NULL DEFAULT 'floor',
  "coin_expiry_days" integer NOT NULL DEFAULT 365,
  "allow_coin_redemption_with_offers" boolean NOT NULL DEFAULT true,
  "downgrade_policy" varchar(30) NOT NULL DEFAULT 'disabled',
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "loyalty_level_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "previous_level_id" varchar(40),
  "new_level_id" varchar(40) NOT NULL,
  "trigger_event" varchar(60) NOT NULL,
  "reason" text,
  "performed_by" varchar(150),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_level_history_cust_idx" ON "loyalty_level_history"("customer_id", "created_at");
