CREATE TABLE IF NOT EXISTS "customer_activity_logs" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_type" varchar(40) NOT NULL,
  "description" text NOT NULL,
  "metadata" jsonb,
  "occurred_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "customer_activity_user_date_idx" ON "customer_activity_logs" ("user_id", "occurred_at");
CREATE TABLE IF NOT EXISTS "customer_product_preferences" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "preference" varchar(12) NOT NULL,
  "affinity_score" numeric(6, 2) NOT NULL DEFAULT '0',
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "customer_product_preferences_user_product_idx" UNIQUE ("user_id", "product_id")
);
CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
  "id" serial PRIMARY KEY,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "name" varchar(150) NOT NULL,
  "channel" varchar(12) NOT NULL,
  "subject" varchar(200),
  "body" text NOT NULL,
  "audience" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "recipient_count" integer NOT NULL DEFAULT 0,
  "sent_count" integer NOT NULL DEFAULT 0,
  "converted_count" integer NOT NULL DEFAULT 0,
  "status" varchar(20) NOT NULL DEFAULT 'queued',
  "created_at" timestamp NOT NULL DEFAULT now()
);
