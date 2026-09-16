ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "images" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "admin_response" text;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "admin_response_at" timestamp;
CREATE INDEX IF NOT EXISTS "reviews_is_approved_idx" ON "reviews" ("is_approved");
