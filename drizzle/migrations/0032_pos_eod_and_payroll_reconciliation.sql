-- drizzle/migrations/0032_pos_eod_and_payroll_reconciliation.sql
-- Simplified Cashier EOD and Accountant Reconciliation with Payroll Integration

CREATE TABLE IF NOT EXISTS "pos_eod_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eod_reference" varchar(50) NOT NULL UNIQUE,
  "shift_id" uuid REFERENCES "pos_shifts"("id") ON DELETE CASCADE,
  "shift_number" varchar(30) NOT NULL,
  "business_date" varchar(12) NOT NULL,
  "branch" varchar(100) NOT NULL DEFAULT 'Dhangadhi Main Branch',
  "register_code" varchar(30) NOT NULL DEFAULT 'REG-01',
  "cashier_id" uuid,
  "cashier_code" varchar(50) NOT NULL DEFAULT 'EMP-101',
  "cashier_name" varchar(150) NOT NULL,
  "opening_float" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "total_sales" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "total_cash_sales" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "total_card_sales" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "total_qr_sales" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "total_bank_sales" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "total_credit_sales" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "refunds_amount" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "voids_count" integer NOT NULL DEFAULT 0,
  "voids_amount" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "cash_additions" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "cash_payouts" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "safe_drops" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "expected_closing_cash" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "total_transactions" integer NOT NULL DEFAULT 0,
  "taxable_amount" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "vat_amount" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "discount_amount" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "envelope_seal_no" varchar(100),
  "physical_vouchers_count" integer NOT NULL DEFAULT 0,
  "cashier_notes" text,
  "cashier_declaration" text,
  "submitted_snapshot" jsonb NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'SUBMITTED_TO_ACCOUNTANT',
  "submitted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "paper_received_at" timestamp with time zone,
  "paper_received_by_id" uuid,
  "paper_received_by_name" varchar(150),
  "accountant_denominations" jsonb,
  "actual_closing_cash" numeric(12, 2),
  "verified_card_amount" numeric(12, 2),
  "card_batch_number" varchar(100),
  "verified_qr_amount" numeric(12, 2),
  "qr_settlement_ref" varchar(100),
  "verified_bank_amount" numeric(12, 2),
  "bank_advice_ref" varchar(100),
  "verified_credit_amount" numeric(12, 2),
  "cash_variance" numeric(12, 2),
  "card_variance" numeric(12, 2),
  "qr_variance" numeric(12, 2),
  "bank_variance" numeric(12, 2),
  "total_variance" numeric(12, 2),
  "discrepancy_type" varchar(50) DEFAULT 'NONE',
  "accountant_remarks" text,
  "reconciled_by_id" uuid,
  "reconciled_by_name" varchar(150),
  "reconciled_at" timestamp with time zone,
  "clarification_reason" text,
  "clarification_requested_at" timestamp with time zone,
  "finalized_by_id" uuid,
  "finalized_by_name" varchar(150),
  "finalized_at" timestamp with time zone,
  "amendment_history" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_eod_reference_idx" ON "pos_eod_submissions"("eod_reference");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_eod_shift_idx" ON "pos_eod_submissions"("shift_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_eod_business_date_idx" ON "pos_eod_submissions"("business_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_eod_status_idx" ON "pos_eod_submissions"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_eod_cashier_idx" ON "pos_eod_submissions"("cashier_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_eod_register_idx" ON "pos_eod_submissions"("register_code");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payroll_discrepancies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "discrepancy_number" varchar(50) NOT NULL UNIQUE,
  "eod_reference" varchar(50) NOT NULL,
  "eod_submission_id" uuid REFERENCES "pos_eod_submissions"("id") ON DELETE CASCADE,
  "shift_id" uuid,
  "cashier_employee_id" uuid,
  "cashier_code" varchar(50) NOT NULL,
  "cashier_name" varchar(150) NOT NULL,
  "branch" varchar(100) NOT NULL DEFAULT 'Dhangadhi Main Branch',
  "register_code" varchar(30) NOT NULL DEFAULT 'REG-01',
  "business_date" varchar(12) NOT NULL,
  "discrepancy_type" varchar(50) NOT NULL,
  "expected_amount" numeric(12, 2) NOT NULL,
  "actual_amount" numeric(12, 2) NOT NULL,
  "difference_amount" numeric(12, 2) NOT NULL,
  "payment_method" varchar(50) NOT NULL DEFAULT 'CASH',
  "accountant_remarks" text,
  "cashier_explanation" text,
  "reviewer_and_approval_status" varchar(50) NOT NULL DEFAULT 'PENDING_REVIEW',
  "resolution_status" varchar(50) NOT NULL DEFAULT 'PENDING',
  "payroll_period_reference" varchar(50),
  "reviewed_by_id" uuid,
  "reviewed_by_name" varchar(150),
  "reviewed_at" timestamp with time zone,
  "investigation_notes" text,
  "payroll_adjustment_approved" boolean NOT NULL DEFAULT false,
  "payroll_adjustment_amount" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_disc_number_idx" ON "payroll_discrepancies"("discrepancy_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_disc_eod_ref_idx" ON "payroll_discrepancies"("eod_reference");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_disc_cashier_idx" ON "payroll_discrepancies"("cashier_employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_disc_approval_status_idx" ON "payroll_discrepancies"("reviewer_and_approval_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_disc_resolution_status_idx" ON "payroll_discrepancies"("resolution_status");
