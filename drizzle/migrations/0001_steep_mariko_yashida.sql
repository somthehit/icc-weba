-- 0001: Stock / merchandising / offer columns + review fields + inventory reorder point.
-- Written idempotently and applied against the live Supabase DB, which was originally
-- bootstrapped via `drizzle-kit push` (no drizzle migrations ledger, stale 0000 snapshot).
-- Every statement is guarded so it is safe to re-run.

-- New enums --------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'inactive', 'discontinued');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."stock_status" AS ENUM('in_stock', 'low_stock', 'out_of_stock', 'pre_order', 'discontinued');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- Align discount_type with the frontend ('fixed'). Non-destructive: legacy 'flat'
-- is left in place (unused) to avoid a risky DROP TYPE dance on a live enum.
ALTER TYPE "public"."discount_type" ADD VALUE IF NOT EXISTS 'fixed';--> statement-breakpoint

-- products: merchandising + status ---------------------------------------
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "status" "product_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_new_arrival" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_best_seller" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_trending" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- products: denormalized stock (single-warehouse assumption) --------------
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reserved_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "low_stock_threshold" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock_status" "stock_status" DEFAULT 'in_stock' NOT NULL;--> statement-breakpoint

-- products: timed offers -------------------------------------------------
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "offer_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "offer_discount_type" "discount_type";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "offer_discount_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "offer_max_discount_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "offer_starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "offer_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "offer_is_flash_sale" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "offer_stackable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint

-- inventory --------------------------------------------------------------
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "reorder_point" integer DEFAULT 10 NOT NULL;--> statement-breakpoint

-- reviews ----------------------------------------------------------------
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "is_verified_purchase" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "helpful_count" integer DEFAULT 0 NOT NULL;
