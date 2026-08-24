-- 0006: Practical shop books — suppliers, expenses, purchase bills — plus the two
-- columns without which profit and service revenue are not computable at all.
--
-- Deliberately NOT double-entry. There are no accounts, journal entries or a trial
-- balance here: this is what a hardware shop actually keeps, which is money in
-- (orders), cost of what was sold (COGS), money out (expenses), and what is owed to
-- suppliers (payables). Revenue - COGS = gross profit; gross profit - expenses = net
-- profit. A ledger that nobody in the shop can reconcile by hand is worse than
-- arithmetic they can check.
--
-- Two schema corrections come with it:
--
--   order_items.unit_cost_snapshot — cost was never snapshotted, so a P&L computed
--   from the live products.cost_price *changes retroactively*: correct a purchase
--   price today and last quarter's profit moves. This follows the precedent the
--   schema already sets three times (product_name_snapshot, sku_snapshot,
--   shipping_address_snapshot). Nullable, because orders placed before this column
--   existed have no cost to record — the reports count and report those rather than
--   treating a missing cost as zero, which would overstate gross profit.
--
--   service_tickets.charged_amount — the table had no monetary column whatsoever,
--   which is why the console's "Completed Service Revenue" figure had no possible
--   data source. Nullable: a warranty claim or a survey may legitimately be free.
--
-- Guarded with IF NOT EXISTS to match 0001-0005: this DB was bootstrapped via
-- `drizzle-kit push`, so migrations are applied directly and must re-run safely.

CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(160) NOT NULL,
  "contact_person" varchar(120),
  "phone" varchar(15),
  "email" varchar(160),
  "address" varchar(300),
  -- Nepal PAN/VAT registration number. Required on a purchase bill for the VAT
  -- paid on it to be claimable, so it lives on the supplier rather than per-bill.
  "vat_pan_no" varchar(30),
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_name_idx" ON "suppliers" ("name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "expense_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(120) NOT NULL,
  "description" varchar(300),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_name_idx" ON "expense_categories" ("name");
--> statement-breakpoint

-- Money out that is not stock: rent, salaries, electricity, internet, marketing.
-- vat_amount is split out of `amount` rather than added to it, so `amount` is
-- always the total paid and the P&L never double-counts VAT.
CREATE TABLE IF NOT EXISTS "expenses" (
  "id" serial PRIMARY KEY NOT NULL,
  "category_id" integer NOT NULL,
  "supplier_id" integer,
  "description" varchar(300) NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
  "expense_date" date NOT NULL,
  "payment_method" varchar(40) DEFAULT 'cash' NOT NULL,
  "reference_no" varchar(60),
  "recorded_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "expenses_date_idx" ON "expenses" ("expense_date");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "expenses_category_idx" ON "expenses" ("category_id");
--> statement-breakpoint

-- Stock bought on credit. `amount_paid` against `total_amount` is what makes
-- accounts payable ageable; `status` is a denormalization of the two for filtering.
CREATE TABLE IF NOT EXISTS "purchase_bills" (
  "id" serial PRIMARY KEY NOT NULL,
  "supplier_id" integer NOT NULL,
  "bill_number" varchar(60) NOT NULL,
  "bill_date" date NOT NULL,
  "due_date" date,
  "subtotal" numeric(12, 2) NOT NULL,
  "vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
  "total_amount" numeric(12, 2) NOT NULL,
  "amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
  "status" varchar(20) DEFAULT 'unpaid' NOT NULL,
  "notes" text,
  "recorded_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- One supplier can reuse a bill number no more than once; two suppliers may both
-- issue "INV-001", so the constraint is on the pair, not the number alone.
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_bills_supplier_number_idx"
  ON "purchase_bills" ("supplier_id", "bill_number");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "purchase_bills_status_idx" ON "purchase_bills" ("status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "purchase_bills_due_date_idx" ON "purchase_bills" ("due_date");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "purchase_bill_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "bill_id" integer NOT NULL,
  "product_id" integer,
  -- Free text as well as the FK: a bill line may be for something not in the
  -- catalogue (packaging, a one-off part), and the description is what was on the
  -- paper bill even when the product row is later renamed.
  "description" varchar(300) NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_cost" numeric(12, 2) NOT NULL,
  "line_total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "purchase_bill_items_bill_idx" ON "purchase_bill_items" ("bill_id");
--> statement-breakpoint

-- Foreign keys. Added separately and idempotently: ADD CONSTRAINT has no
-- IF NOT EXISTS in PostgreSQL, so each is wrapped in a DO block that swallows
-- only the duplicate-object error.
DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_fk"
    FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- restrict, not cascade: deleting a supplier must not silently erase the bills
-- that prove what was owed to them. Deactivate the supplier instead.
DO $$ BEGIN
  ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_supplier_id_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_recorded_by_fk"
    FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- cascade here, unlike the bill->supplier edge: a bill's lines are part of the
-- bill, not records in their own right.
DO $$ BEGIN
  ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_bill_id_fk"
    FOREIGN KEY ("bill_id") REFERENCES "purchase_bills"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_product_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- The two corrections described in the header.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unit_cost_snapshot" numeric(12, 2);
--> statement-breakpoint

ALTER TABLE "service_tickets" ADD COLUMN IF NOT EXISTS "charged_amount" numeric(12, 2);
