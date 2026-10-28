-- drizzle/migrations/0031_loyalty_production_hardening.sql
-- Production Hardening: Ledger immutability, Points Expiry tracking, Offer targeting, and Soft Delete

-- 1. Soft delete and status tracking
ALTER TABLE "customer_memberships" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_memberships_deleted_idx" ON "customer_memberships"("deleted_at");
--> statement-breakpoint

ALTER TABLE "loyalty_offers" ADD COLUMN IF NOT EXISTS "eligible_categories" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "loyalty_offers" ADD COLUMN IF NOT EXISTS "eligible_brands" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "loyalty_offers" ADD COLUMN IF NOT EXISTS "eligible_product_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "loyalty_offers" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint

-- 2. Points Expiry & FIFO tracking in loyalty_ledger
ALTER TABLE "loyalty_ledger" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD COLUMN IF NOT EXISTS "is_expired" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD COLUMN IF NOT EXISTS "remaining_points" numeric(12, 2) NOT NULL DEFAULT 0.00;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_ledger_expires_idx" ON "loyalty_ledger"("expires_at", "is_expired");
--> statement-breakpoint

-- Populate existing rows
UPDATE "loyalty_ledger" 
SET "remaining_points" = "points_credited", "expires_at" = "created_at" + INTERVAL '365 days' 
WHERE "entry_type" IN ('earned', 'bonus') AND "points_credited" > 0 AND "remaining_points" = 0.00;
--> statement-breakpoint

-- 3. Replace CASCADE with RESTRICT to guarantee financial ledger immutability
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop foreign keys from loyalty_ledger
  FOR r IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'loyalty_ledger' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name IN ('customer_id', 'membership_id')
  ) LOOP
    EXECUTE 'ALTER TABLE loyalty_ledger DROP CONSTRAINT ' || quote_ident(r.constraint_name);
  END LOOP;

  -- Drop foreign keys from loyalty_level_history
  FOR r IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'loyalty_level_history' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'customer_id'
  ) LOOP
    EXECUTE 'ALTER TABLE loyalty_level_history DROP CONSTRAINT ' || quote_ident(r.constraint_name);
  END LOOP;

  -- Drop foreign keys from loyalty_offer_redemptions
  FOR r IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'loyalty_offer_redemptions' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name IN ('customer_id', 'offer_id')
  ) LOOP
    EXECUTE 'ALTER TABLE loyalty_offer_redemptions DROP CONSTRAINT ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;
--> statement-breakpoint

ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_membership_id_customer_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "customer_memberships"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "loyalty_level_history" ADD CONSTRAINT "loyalty_level_history_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "loyalty_offer_redemptions" ADD CONSTRAINT "loyalty_offer_redemptions_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "loyalty_offer_redemptions" ADD CONSTRAINT "loyalty_offer_redemptions_offer_id_loyalty_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "loyalty_offers"("id") ON DELETE RESTRICT;
