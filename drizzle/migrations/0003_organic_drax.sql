-- 0003: Brand + category presentation columns.
--
-- BrandsView renders a description and only wants curated partners; the storefront
-- category tiles render a lucide icon name, a blurb and a subcategory list. All of
-- that lived only in lib/data/initial-data.ts, so the DB couldn't drive those views.
--
-- Guarded with IF NOT EXISTS to match 0001/0002: this DB was bootstrapped via
-- `drizzle-kit push`, so migrations are applied directly and must re-run safely.

ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "is_partner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "category_slugs" jsonb;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "icon_name" varchar(60);--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "subcategories" jsonb;
