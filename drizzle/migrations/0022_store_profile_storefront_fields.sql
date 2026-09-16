-- 0022_store_profile_storefront_fields.sql
--
-- Four columns added to `db/schema/settings.ts` after 0019 closed the previous
-- store_profile gap. Same failure mode if left unapplied: the staff branch of
-- GET /api/settings?type=profile does `select()` over every declared column, so a
-- column that exists only in the schema file turns the whole request into a 500.
--
-- Defaults mirror the Drizzle declarations so the NOT NULL column applies cleanly
-- to the existing row.

ALTER TABLE "store_profile"
  ADD COLUMN IF NOT EXISTS "tagline"              varchar(300),
  ADD COLUMN IF NOT EXISTS "opening_hours"        varchar(200),
  ADD COLUMN IF NOT EXISTS "announcement_text"    varchar(300),
  ADD COLUMN IF NOT EXISTS "announcement_enabled" boolean DEFAULT true NOT NULL;
