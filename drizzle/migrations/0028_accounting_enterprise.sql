-- drizzle/migrations/0028_accounting_enterprise.sql
-- Enterprise Nepal Double-Entry Accounting, Fiscal Periods, Bank Reconciliations, Z-Reports, and Supplier Payments

CREATE TABLE IF NOT EXISTS "fiscal_periods" (
  "id" serial PRIMARY KEY,
  "fiscal_year" varchar(20) NOT NULL,
  "period_number" integer NOT NULL,
  "month_name_bs" varchar(30) NOT NULL,
  "start_date_ad" date NOT NULL,
  "end_date_ad" date NOT NULL,
  "is_locked" boolean NOT NULL DEFAULT false,
  "locked_at" timestamp,
  "locked_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "locked_by_name" varchar(150),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_periods_fy_period_idx" ON "fiscal_periods"("fiscal_year", "period_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fiscal_periods_is_locked_idx" ON "fiscal_periods"("is_locked");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bank_accounts" (
  "id" serial PRIMARY KEY,
  "account_name" varchar(150) NOT NULL,
  "account_number" varchar(60) NOT NULL,
  "bank_name" varchar(100) NOT NULL,
  "branch" varchar(100),
  "account_type" varchar(30) NOT NULL DEFAULT 'bank',
  "chart_account_id" integer REFERENCES "accounts"("id") ON DELETE SET NULL,
  "current_balance" numeric(14, 2) NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bank_accounts_number_idx" ON "bank_accounts"("account_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_accounts_type_idx" ON "bank_accounts"("account_type");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bank_statements" (
  "id" serial PRIMARY KEY,
  "bank_account_id" integer NOT NULL REFERENCES "bank_accounts"("id") ON DELETE CASCADE,
  "statement_date" date NOT NULL,
  "description" varchar(300) NOT NULL,
  "reference_no" varchar(80),
  "debit_amount" numeric(14, 2) NOT NULL DEFAULT 0,
  "credit_amount" numeric(14, 2) NOT NULL DEFAULT 0,
  "balance_after" numeric(14, 2),
  "is_reconciled" boolean NOT NULL DEFAULT false,
  "reconciled_at" timestamp,
  "matched_journal_id" integer REFERENCES "journal_entries"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_statements_bank_date_idx" ON "bank_statements"("bank_account_id", "statement_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_statements_reconciled_idx" ON "bank_statements"("is_reconciled");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "supplier_payments" (
  "id" serial PRIMARY KEY,
  "payment_number" varchar(60) NOT NULL,
  "supplier_id" integer NOT NULL REFERENCES "suppliers"("id") ON DELETE RESTRICT,
  "bill_id" integer REFERENCES "purchase_bills"("id") ON DELETE SET NULL,
  "amount_paid" numeric(14, 2) NOT NULL,
  "tds_rate" numeric(5, 2) NOT NULL DEFAULT 1.5,
  "tds_amount" numeric(14, 2) NOT NULL DEFAULT 0,
  "net_disbursed" numeric(14, 2) NOT NULL,
  "payment_date" date NOT NULL,
  "payment_method" varchar(40) NOT NULL DEFAULT 'bank_transfer',
  "bank_account_id" integer REFERENCES "bank_accounts"("id") ON DELETE SET NULL,
  "cheque_or_ref_no" varchar(80),
  "journal_entry_id" integer REFERENCES "journal_entries"("id") ON DELETE SET NULL,
  "notes" text,
  "created_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_by_name" varchar(150),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_payments_num_idx" ON "supplier_payments"("payment_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_payments_supplier_idx" ON "supplier_payments"("supplier_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_payments_date_idx" ON "supplier_payments"("payment_date");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "z_reports" (
  "id" serial PRIMARY KEY,
  "report_number" varchar(60) NOT NULL,
  "business_date" date NOT NULL,
  "fiscal_year" varchar(20) NOT NULL DEFAULT '2082/83',
  "gross_sales" numeric(14, 2) NOT NULL,
  "discounts_total" numeric(14, 2) NOT NULL DEFAULT 0,
  "returns_total" numeric(14, 2) NOT NULL DEFAULT 0,
  "taxable_amount" numeric(14, 2) NOT NULL,
  "vat_amount" numeric(14, 2) NOT NULL,
  "net_sales" numeric(14, 2) NOT NULL,
  "cash_expected" numeric(14, 2) NOT NULL,
  "cash_counted" numeric(14, 2) NOT NULL,
  "cash_variance" numeric(14, 2) NOT NULL DEFAULT 0,
  "payment_summary_json" jsonb NOT NULL,
  "shifts_summary_json" jsonb NOT NULL,
  "sha256_hash" varchar(100) NOT NULL,
  "is_locked" boolean NOT NULL DEFAULT true,
  "closed_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "closed_by_name" varchar(150),
  "closed_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "z_reports_num_idx" ON "z_reports"("report_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "z_reports_business_date_idx" ON "z_reports"("business_date");
