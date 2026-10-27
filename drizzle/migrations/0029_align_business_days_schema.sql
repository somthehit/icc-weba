-- drizzle/migrations/0029_align_business_days_schema.sql
-- Aligns "business_days" table with posBusinessDays schema in db/schema/pos.ts

ALTER TABLE "business_days" 
  ADD COLUMN IF NOT EXISTS "opened_at" timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "closed_by_supervisor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "closed_by_supervisor_name" varchar(150),
  ADD COLUMN IF NOT EXISTS "total_gross_sales" numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_net_sales" numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_cash_variance" numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_shifts_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

DO $$
BEGIN
  -- Alter status column from enum to varchar if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_days' 
      AND column_name = 'status' 
      AND udt_name = 'pos_day_status'
  ) THEN
    ALTER TABLE "business_days" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "business_days" ALTER COLUMN "status" TYPE varchar(20) USING status::text;
    ALTER TABLE "business_days" ALTER COLUMN "status" SET DEFAULT 'OPEN';
  END IF;
END $$;
