-- 0001_missing_inquiries_and_content.sql
--
-- Creates the five tables that exist in `db/schema/` but were never pushed:
--   inquiries.ts  -> contact_inquiries, inquiry_notes, sales_leads
--   content.ts    -> homepage_sections, site_content_settings
--
-- Their absence made `POST /api/v1/public/contact` and the admin console's
-- homepage-layout / navigation saves fail with Postgres 42P01, which surfaced as
-- an empty-bodied 500 in the browser.
--
-- Written by hand rather than generated because the migration journal has drifted
-- from the live database, so `drizzle-kit generate` would emit a diff against a
-- stale snapshot instead of against what is actually deployed.

CREATE TABLE IF NOT EXISTS "contact_inquiries" (
  "id" serial PRIMARY KEY NOT NULL,
  "inquiry_number" varchar(30) NOT NULL,
  "full_name" varchar(150) NOT NULL,
  "phone" varchar(15) NOT NULL,
  "email" varchar(200),
  "subject" varchar(120) NOT NULL,
  "message" text NOT NULL,
  "status" varchar(20) DEFAULT 'UNREAD' NOT NULL,
  "assigned_staff_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "converted_service_id" integer REFERENCES "service_tickets"("id") ON DELETE SET NULL,
  "converted_lead_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "contact_inquiries_number_idx"
  ON "contact_inquiries" ("inquiry_number");
CREATE INDEX IF NOT EXISTS "contact_inquiries_status_idx"
  ON "contact_inquiries" ("status");
CREATE INDEX IF NOT EXISTS "contact_inquiries_created_idx"
  ON "contact_inquiries" ("created_at");

CREATE TABLE IF NOT EXISTS "inquiry_notes" (
  "id" serial PRIMARY KEY NOT NULL,
  "inquiry_id" integer NOT NULL REFERENCES "contact_inquiries"("id") ON DELETE CASCADE,
  "note" text NOT NULL,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "inquiry_notes_inquiry_idx"
  ON "inquiry_notes" ("inquiry_id", "created_at");

CREATE TABLE IF NOT EXISTS "sales_leads" (
  "id" serial PRIMARY KEY NOT NULL,
  "lead_number" varchar(30) NOT NULL,
  "full_name" varchar(150) NOT NULL,
  "phone" varchar(15) NOT NULL,
  "email" varchar(200),
  "request" text NOT NULL,
  "status" varchar(20) DEFAULT 'OPEN' NOT NULL,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "homepage_sections" (
  "id" serial PRIMARY KEY NOT NULL,
  "section_type" varchar(40) NOT NULL,
  "title" varchar(150),
  "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "homepage_sections_order_idx"
  ON "homepage_sections" ("display_order");

CREATE TABLE IF NOT EXISTS "site_content_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "footer_columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "copyright_text" varchar(300),
  "meta_title" varchar(200),
  "meta_description" varchar(500),
  "open_graph_image_url" varchar(500),
  "google_analytics_id" varchar(100),
  "facebook_pixel_id" varchar(100),
  "updated_at" timestamp DEFAULT now() NOT NULL
);
