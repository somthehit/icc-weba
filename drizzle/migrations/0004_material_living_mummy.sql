-- 0004: Hardware-review fields.
--
-- components/HardwareReviewsSection.tsx submits a reviewer city, their rig, a
-- component aspect, per-aspect ratings and pros/cons lists. None of that had a
-- column, so a submitted review would come back stripped down to stars + text.
--
-- Guarded with IF NOT EXISTS to match 0001-0003: this DB was bootstrapped via
-- `drizzle-kit push`, so migrations are applied directly and must re-run safely.

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "user_city" varchar(120);--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "hardware_setup" varchar(300);--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "component_aspect" varchar(60);--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "component_ratings" jsonb;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "pros" jsonb;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "cons" jsonb;
