ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "desktop_image_url" varchar(500);
ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "mobile_image_url" varchar(500);
ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "starts_at" timestamp;
ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "ends_at" timestamp;
CREATE TABLE IF NOT EXISTS "homepage_sections" (
  "id" serial PRIMARY KEY,
  "section_type" varchar(40) NOT NULL,
  "title" varchar(150),
  "configuration" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "display_order" integer NOT NULL DEFAULT 0,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "homepage_sections_order_idx" ON "homepage_sections" ("display_order");
CREATE TABLE IF NOT EXISTS "site_content_settings" (
  "id" serial PRIMARY KEY,
  "social_links" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "footer_columns" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "copyright_text" varchar(300),
  "meta_title" varchar(200),
  "meta_description" varchar(500),
  "open_graph_image_url" varchar(500),
  "google_analytics_id" varchar(100),
  "facebook_pixel_id" varchar(100),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
