ALTER TABLE "store_profile" ADD COLUMN IF NOT EXISTS "tagline" varchar(300);
ALTER TABLE "store_profile" ADD COLUMN IF NOT EXISTS "opening_hours" varchar(200);
ALTER TABLE "store_profile" ADD COLUMN IF NOT EXISTS "announcement_text" varchar(300);
ALTER TABLE "store_profile" ADD COLUMN IF NOT EXISTS "announcement_enabled" boolean DEFAULT true NOT NULL;
