-- 0004_store_profile_and_staff_profiles.sql
--
-- Closes column-level drift between `db/schema/` and the live database.
--
-- `store_profile` was created with an early version of the table and never
-- altered, so 13 columns declared in `db/schema/settings.ts` did not exist. The
-- staff branch of `GET /api/settings?type=profile` does `select()` — every
-- declared column — so Postgres raised 42703 and the route returned 500. The
-- anonymous branch selects an explicit subset that happened to be the old
-- columns, which is why only signed-in staff saw the failure.
--
-- `staff_profiles` (db/schema/users.ts) was missing outright, along with the two
-- enum types it depends on.
--
-- Defaults mirror the Drizzle declarations exactly, so a NOT NULL column can be
-- added to the existing row without a separate backfill.

-- ---------------------------------------------------------------- enum types
DO $$ BEGIN
  CREATE TYPE "staff_role" AS ENUM ('SUPER_ADMIN', 'STORE_MANAGER', 'SALES_AGENT', 'SERVICE_TECHNICIAN', 'DELIVERY_DRIVER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "shift_status" AS ENUM ('ON_DUTY', 'ON_TRANSIT', 'OFF_DUTY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------- store_profile
ALTER TABLE "store_profile"
  ADD COLUMN IF NOT EXISTS "legal_name"                  varchar(200),
  ADD COLUMN IF NOT EXISTS "pan_vat_number"              varchar(20),
  ADD COLUMN IF NOT EXISTS "dark_logo_url"               varchar(500),
  ADD COLUMN IF NOT EXISTS "favicon_url"                 varchar(500),
  ADD COLUMN IF NOT EXISTS "invoice_logo_url"            varchar(500),
  ADD COLUMN IF NOT EXISTS "address"                     varchar(500),
  ADD COLUMN IF NOT EXISTS "multi_currency_enabled"      boolean        DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "calendar"                    varchar(3)     DEFAULT 'AD'  NOT NULL,
  ADD COLUMN IF NOT EXISTS "guest_checkout_enabled"      boolean        DEFAULT true  NOT NULL,
  ADD COLUMN IF NOT EXISTS "minimum_order_amount"        numeric(12, 2) DEFAULT '0'   NOT NULL,
  ADD COLUMN IF NOT EXISTS "stock_lock_minutes"          numeric(6, 0)  DEFAULT '15'  NOT NULL,
  ADD COLUMN IF NOT EXISTS "unpaid_order_cancel_minutes" numeric(6, 0)  DEFAULT '30'  NOT NULL,
  ADD COLUMN IF NOT EXISTS "configuration"               jsonb          DEFAULT '{}'::jsonb NOT NULL;

-- ------------------------------------------------------------ staff_profiles
CREATE TABLE IF NOT EXISTS "staff_profiles" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "staff_role" "staff_role" NOT NULL,
  "department" varchar(120),
  -- `text('skills').array().notNull().default([])`
  "skills" text[] DEFAULT '{}'::text[] NOT NULL,
  "specialization" varchar(180),
  "vehicle_number" varchar(40),
  "driving_license_no" varchar(60),
  "shift_status" "shift_status" DEFAULT 'OFF_DUTY' NOT NULL,
  "assigned_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "staff_profiles_role_idx" ON "staff_profiles" ("staff_role");
