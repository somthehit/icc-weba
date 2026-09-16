ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "channel" varchar(20) DEFAULT 'OFFLINE_WALKIN' NOT NULL;
ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "workflow_status" varchar(30) DEFAULT 'PENDING_INSPECTION' NOT NULL;
ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "device_brand" varchar(100);
ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "device_model" varchar(150);
ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "serial_number" varchar(120);
ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "condition_checklist" jsonb;
ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "lock_code" varchar(120);
ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "preferred_date" timestamp;
ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "preferred_time" varchar(80);
ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "service_address" varchar(500);
ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "advance_amount" numeric(12, 2) DEFAULT '0' NOT NULL;
CREATE TABLE IF NOT EXISTS "service_activity_logs" (
  "id" serial PRIMARY KEY,
  "ticket_id" integer NOT NULL REFERENCES "service_tickets"("id") ON DELETE CASCADE,
  "activity_type" varchar(40) NOT NULL,
  "message" text NOT NULL,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "service_activity_ticket_idx" ON "service_activity_logs" ("ticket_id", "created_at");
