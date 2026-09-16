CREATE TABLE IF NOT EXISTS "contact_inquiries" (
  "id" serial PRIMARY KEY,
  "inquiry_number" varchar(30) NOT NULL UNIQUE,
  "full_name" varchar(150) NOT NULL,
  "phone" varchar(15) NOT NULL,
  "email" varchar(200),
  "subject" varchar(120) NOT NULL,
  "message" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'UNREAD',
  "assigned_staff_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "converted_service_id" integer REFERENCES "service_tickets"("id") ON DELETE SET NULL,
  "converted_lead_id" integer,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "contact_inquiries_status_idx" ON "contact_inquiries" ("status");
CREATE INDEX IF NOT EXISTS "contact_inquiries_created_idx" ON "contact_inquiries" ("created_at");
CREATE TABLE IF NOT EXISTS "inquiry_notes" (
  "id" serial PRIMARY KEY,
  "inquiry_id" integer NOT NULL REFERENCES "contact_inquiries"("id") ON DELETE CASCADE,
  "note" text NOT NULL,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "inquiry_notes_inquiry_idx" ON "inquiry_notes" ("inquiry_id", "created_at");
CREATE TABLE IF NOT EXISTS "sales_leads" (
  "id" serial PRIMARY KEY,
  "lead_number" varchar(30) NOT NULL,
  "full_name" varchar(150) NOT NULL,
  "phone" varchar(15) NOT NULL,
  "email" varchar(200),
  "request" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'OPEN',
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
