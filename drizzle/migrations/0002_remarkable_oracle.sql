-- 0002: Storefront content columns that had no home in the schema.
--
-- The frontend `Product` type renders tags, feature bullets, box contents, a
-- human-readable warranty blurb, a release date, a subcategory and review
-- aggregates. None of those had columns, so seeding from initial-data.ts was
-- silently dropping them. Added here so the DB is a faithful source of truth.
--
-- Guarded with IF NOT EXISTS to match 0001: this DB was originally bootstrapped
-- via `drizzle-kit push`, so migrations are applied directly and must re-run safely.

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "warranty_text" varchar(250);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "subcategory" varchar(120);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "release_date" date;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tags" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "features" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "whats_in_the_box" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "rating_average" numeric(2, 1) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "review_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_deal_of_day" boolean DEFAULT false NOT NULL;
