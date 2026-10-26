CREATE TYPE "public"."pos_day_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."pos_shift_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."pos_staff_role" AS ENUM('cashier', 'senior_cashier', 'supervisor', 'store_manager', 'manager', 'inventory_manager', 'sales_manager', 'accountant', 'auditor', 'admin');--> statement-breakpoint
CREATE TABLE "goods_receipt_note_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grn_id" uuid NOT NULL,
	"product_id" uuid,
	"po_item_id" uuid,
	"sku" varchar(60),
	"description" varchar(300) NOT NULL,
	"quantity_received" integer DEFAULT 1 NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"batch_no" varchar(60),
	"expiry_date" date
);
--> statement-breakpoint
CREATE TABLE "goods_receipt_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grn_number" varchar(60) NOT NULL,
	"purchase_order_id" uuid,
	"supplier_id" uuid NOT NULL,
	"supplier_invoice_no" varchar(80),
	"received_date" date NOT NULL,
	"storekeeper_id" uuid,
	"storekeeper_name" varchar(150),
	"total_items" integer DEFAULT 0 NOT NULL,
	"total_quantity" integer DEFAULT 0 NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"financial_status" varchar(30) DEFAULT 'pending_invoice' NOT NULL,
	"purchase_bill_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "po_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"approver_id" uuid,
	"approver_name" varchar(150) NOT NULL,
	"role" varchar(50) NOT NULL,
	"action" varchar(30) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"pin_hash" varchar(128),
	"device_ip" varchar(45),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "po_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"uploaded_by_name" varchar(150),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "po_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"channel" varchar(30) NOT NULL,
	"recipient" varchar(150) NOT NULL,
	"message_body" text,
	"tracking_token" varchar(64),
	"status" varchar(30) DEFAULT 'sent',
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"confirmed_at" timestamp,
	CONSTRAINT "po_communications_tracking_token_unique" UNIQUE("tracking_token")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" varchar(60),
	"supplier_part_no" varchar(80),
	"description" varchar(300) NOT NULL,
	"quantity_ordered" integer DEFAULT 1 NOT NULL,
	"quantity_received" integer DEFAULT 0 NOT NULL,
	"unit_of_measure" varchar(20) DEFAULT 'Pcs',
	"unit_cost" numeric(14, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"discount_amount" numeric(14, 2) DEFAULT '0',
	"tax_category" varchar(20) DEFAULT 'vat_13',
	"vat_rate" numeric(5, 2) DEFAULT '13.00',
	"vat_amount" numeric(14, 2) DEFAULT '0',
	"line_total" numeric(14, 2) NOT NULL,
	"requires_serial" boolean DEFAULT false,
	"last_purchase_cost" numeric(14, 2),
	"average_cost" numeric(14, 2),
	"current_stock" integer,
	"estimated_landed_cost" numeric(14, 2),
	"expected_selling_price" numeric(14, 2),
	"expected_margin_percent" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "purchase_order_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"change_reason" text,
	"changed_by_id" uuid,
	"changed_by_name" varchar(150),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"po_number" varchar(60) NOT NULL,
	"fiscal_year" varchar(20) DEFAULT '2082/83',
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"deliver_to_location" varchar(150) DEFAULT 'Main Store - Dhangadhi',
	"billing_reference" varchar(100),
	"currency" varchar(10) DEFAULT 'NPR',
	"exchange_rate" numeric(10, 4) DEFAULT '1.0000',
	"supplier_quote_no" varchar(80),
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0',
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_charges" numeric(14, 2) DEFAULT '0',
	"total_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"payment_terms" varchar(100) DEFAULT 'Credit 30 Days',
	"notes" text,
	"internal_notes" text,
	"created_by_id" uuid,
	"created_by_name" varchar(150),
	"approved_by_id" uuid,
	"approved_by_name" varchar(150),
	"approved_at" timestamp,
	"sent_at" timestamp,
	"sent_method" varchar(30),
	"confirmation_status" varchar(30) DEFAULT 'pending',
	"revision_number" integer DEFAULT 1,
	"idempotency_key" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"lead_time_days" integer DEFAULT 7,
	"default_payment_terms" varchar(80) DEFAULT 'Credit 30 Days',
	"minimum_order_value" numeric(14, 2) DEFAULT '0',
	"is_blacklisted" boolean DEFAULT false,
	"blacklist_reason" text,
	"credit_limit" numeric(14, 2) DEFAULT '500000',
	"rating" numeric(3, 2) DEFAULT '4.50',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_terms_supplier_id_unique" UNIQUE("supplier_id")
);
--> statement-breakpoint
CREATE TABLE "business_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_date" date NOT NULL,
	"status" "pos_day_status" DEFAULT 'open' NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp with time zone,
	"z_report" jsonb,
	CONSTRAINT "business_days_business_date_unique" UNIQUE("business_date")
);
--> statement-breakpoint
CREATE TABLE "pos_cash_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid,
	"type" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" varchar(255) NOT NULL,
	"performed_by_name" varchar(150) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_shift_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid,
	"approval_type" varchar(50) NOT NULL,
	"approver_id" uuid,
	"approver_name" varchar(150) NOT NULL,
	"approver_role" varchar(50) NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_shift_cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid,
	"type" varchar(50) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" varchar(255) NOT NULL,
	"authorized_by_name" varchar(150) NOT NULL,
	"authorized_by_pin" varchar(255),
	"receipt_no" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_shift_denominations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid,
	"count_type" varchar(50) NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"d1000" integer DEFAULT 0 NOT NULL,
	"d500" integer DEFAULT 0 NOT NULL,
	"d100" integer DEFAULT 0 NOT NULL,
	"d50" integer DEFAULT 0 NOT NULL,
	"d20" integer DEFAULT 0 NOT NULL,
	"d10" integer DEFAULT 0 NOT NULL,
	"d5" integer DEFAULT 0 NOT NULL,
	"d2" integer DEFAULT 0 NOT NULL,
	"d1" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"total_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"counted_by_id" uuid,
	"counted_by_name" varchar(150) NOT NULL,
	"verified_by_id" uuid,
	"verified_by_name" varchar(150),
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_shift_tender_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid,
	"tender_type" varchar(50) NOT NULL,
	"system_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"entered_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"variance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"reference_no" varchar(100),
	"batch_number" varchar(100),
	"slip_image_url" text,
	"status" varchar(50) DEFAULT 'BALANCED' NOT NULL,
	"verified_by_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_number" varchar(30) NOT NULL,
	"register_code" varchar(30) DEFAULT 'REG-01' NOT NULL,
	"cashier_id" uuid,
	"cashier_name" varchar(150) NOT NULL,
	"cashier_code" varchar(50) DEFAULT 'EMP-101' NOT NULL,
	"opening_float" numeric(12, 2) DEFAULT '0' NOT NULL,
	"opening_denominations" jsonb,
	"standard_float" numeric(12, 2) DEFAULT '5000.00' NOT NULL,
	"handover_variance" numeric(12, 2) DEFAULT '0.00',
	"previous_shift_id" uuid,
	"closing_cash" numeric(12, 2),
	"closing_denominations" jsonb,
	"expected_cash" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cash_discrepancy" numeric(12, 2),
	"total_sales" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_cash_sales" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_card_sales" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_qr_sales" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"opened_by_supervisor_id" uuid,
	"opened_by_supervisor_name" varchar(150),
	"closed_by_supervisor_id" uuid,
	"closed_by_supervisor_name" varchar(150),
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"note" text,
	"eod_report" jsonb,
	"variance_approved" boolean DEFAULT false NOT NULL,
	"variance_approved_by" varchar(150),
	"variance_approved_at" timestamp,
	"variance_reason" text,
	"min_duration_override" boolean DEFAULT false NOT NULL,
	"min_duration_override_by" varchar(150),
	"min_duration_override_reason" text,
	"is_zero_sales" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anomaly_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_code" text NOT NULL,
	"staff_id" uuid,
	"shift_id" integer,
	"severity" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"details" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"assigned_to_id" uuid,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "anomaly_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"threshold_value" numeric(14, 2) NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anomaly_rules_rule_code_unique" UNIQUE("rule_code")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"approver_id" uuid,
	"terminal_id" uuid,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"meta" jsonb,
	"prev_hash" text,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limit_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"granted_by_id" uuid NOT NULL,
	"permission_key" text NOT NULL,
	"override_value" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pin_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"pin_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pin_reset_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"requested_by_id" uuid,
	"approved_by_id" uuid,
	"temp_pin_hash" text,
	"reason" text NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid,
	"cashier_id" uuid,
	"cashier_name" text,
	"terminal_code" text DEFAULT 'REG-01' NOT NULL,
	"invoice_number" text NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"payment_breakdown" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_transactions_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_day_id" uuid,
	"terminal_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"opened_by_supervisor_id" uuid,
	"closed_by_supervisor_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"reason_paused" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opening_count" jsonb NOT NULL,
	"opening_total" numeric(14, 2) NOT NULL,
	"closed_at" timestamp with time zone,
	"closing_count" jsonb,
	"closing_total" numeric(14, 2),
	"handover_slip" jsonb,
	"expected_cash" numeric(14, 2),
	"variance" numeric(14, 2),
	"variance_approved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"staff_code" text NOT NULL,
	"email" text,
	"phone" text,
	"role" "pos_staff_role" DEFAULT 'cashier' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"photo_url" text,
	"branch_id" text DEFAULT 'MAIN' NOT NULL,
	"default_shift" text DEFAULT 'morning' NOT NULL,
	"emergency_contact" text,
	"notes" text,
	"join_date" date,
	"password_hash" text NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"pin_hash" text,
	"must_change_pin" boolean DEFAULT false NOT NULL,
	"pin_changed_at" timestamp with time zone DEFAULT now(),
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"failed_pin_attempts" integer DEFAULT 0 NOT NULL,
	"pin_locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"last_login_ip" text,
	"last_terminal_code" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"totp_secret" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_staff_code_unique" UNIQUE("staff_code")
);
--> statement-breakpoint
CREATE TABLE "staff_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_name" text,
	"actor_role" text,
	"action" text NOT NULL,
	"target_id" text,
	"target_type" text,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"max_line_discount_pct" numeric(5, 2) DEFAULT 10,
	"max_invoice_discount_amount" numeric(14, 2) DEFAULT 1000,
	"max_refund_amount" numeric(14, 2) DEFAULT 5000,
	"max_void_amount" numeric(14, 2) DEFAULT 5000,
	"can_override_price" boolean DEFAULT false NOT NULL,
	"can_no_sale_open" boolean DEFAULT false NOT NULL,
	"max_cash_payout" numeric(14, 2) DEFAULT 2000,
	"can_credit_sale" boolean DEFAULT false NOT NULL,
	"return_window_days" integer DEFAULT 7,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_limits_staff_id_unique" UNIQUE("staff_id")
);
--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"terminal_id" uuid,
	"terminal_code" text,
	"session_token_hash" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"revoked_reason" text,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"period_type" text DEFAULT 'monthly' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"sales_target" numeric(14, 2) DEFAULT 500000 NOT NULL,
	"accuracy_target" numeric(5, 2) DEFAULT 99.5 NOT NULL,
	"achieved_sales" numeric(14, 2) DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_terminals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"terminal_id" uuid NOT NULL,
	"allowed_days" jsonb DEFAULT '["sun","mon","tue","wed","thu","fri","sat"]'::jsonb,
	"allowed_start_time" text DEFAULT '09:00',
	"allowed_end_time" text DEFAULT '20:00',
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terminals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"token_hash" text,
	"branch_id" text,
	"status" text DEFAULT 'approved' NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"ip_address" text,
	"mac_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_session_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" varchar(60) NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"system_qty_snapshot" integer DEFAULT 0 NOT NULL,
	"physical_count_qty" integer DEFAULT 0 NOT NULL,
	"variance_qty" integer DEFAULT 0 NOT NULL,
	"unit_cost_snapshot" numeric(12, 2) DEFAULT '0' NOT NULL,
	"variance_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"is_recounted" boolean DEFAULT false NOT NULL,
	"status" varchar(30) DEFAULT 'counted' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "audit_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_number" varchar(60) NOT NULL,
	"title" varchar(150) NOT NULL,
	"audit_type" varchar(30) DEFAULT 'full' NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'in_progress' NOT NULL,
	"blind_count_enabled" boolean DEFAULT true NOT NULL,
	"total_skus_counted" integer DEFAULT 0 NOT NULL,
	"total_variance_qty" integer DEFAULT 0 NOT NULL,
	"total_variance_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"started_by_id" uuid,
	"started_by_name" varchar(150),
	"approved_by_id" uuid,
	"approved_by_name" varchar(150),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "inventory_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_type" varchar(40) NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"product_id" uuid,
	"reference_id" varchar(80),
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_by_id" uuid,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_number" varchar(80) NOT NULL,
	"grn_id" uuid,
	"initial_quantity" integer DEFAULT 0 NOT NULL,
	"current_quantity" integer DEFAULT 0 NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"manufacturing_date" date,
	"expiry_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_serials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"serial_number" varchar(100) NOT NULL,
	"grn_item_id" uuid,
	"grn_id" uuid,
	"status" varchar(30) DEFAULT 'in_stock' NOT NULL,
	"warehouse_id" uuid,
	"bin_id" uuid,
	"cost_price" numeric(12, 2),
	"selling_price" numeric(12, 2),
	"warranty_months" integer DEFAULT 12 NOT NULL,
	"warranty_start_date" date,
	"warranty_end_date" date,
	"sold_invoice_no" varchar(60),
	"sold_date" timestamp,
	"customer_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"serial_id" uuid,
	"sku" varchar(60) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"action" varchar(40) DEFAULT 'restock' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "stock_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" varchar(60) NOT NULL,
	"return_type" varchar(30) DEFAULT 'customer_return' NOT NULL,
	"reference_invoice_or_po" varchar(80),
	"supplier_id" uuid,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reason" varchar(200) NOT NULL,
	"notes" text,
	"created_by_id" uuid,
	"created_by_name" varchar(150),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" varchar(60) NOT NULL,
	"quantity_requested" integer DEFAULT 1 NOT NULL,
	"quantity_shipped" integer DEFAULT 0 NOT NULL,
	"quantity_received" integer DEFAULT 0 NOT NULL,
	"discrepancy_note" varchar(300)
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_number" varchar(60) NOT NULL,
	"source_warehouse_id" uuid NOT NULL,
	"dest_warehouse_id" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"total_quantity" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"requested_by_id" uuid,
	"requested_by_name" varchar(150),
	"approved_by_id" uuid,
	"approved_by_name" varchar(150),
	"shipped_at" timestamp,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_bins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"zone" varchar(30) DEFAULT 'A' NOT NULL,
	"rack" varchar(30) DEFAULT '01' NOT NULL,
	"shelf" varchar(30) DEFAULT 'S1' NOT NULL,
	"bin" varchar(30) DEFAULT 'B01' NOT NULL,
	"code" varchar(60) NOT NULL,
	"description" varchar(150),
	"capacity_units" integer DEFAULT 100 NOT NULL,
	"current_usage" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warranty_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_number" varchar(60) NOT NULL,
	"serial_id" uuid,
	"product_id" uuid NOT NULL,
	"customer_name" varchar(150) NOT NULL,
	"customer_phone" varchar(30) NOT NULL,
	"customer_email" varchar(150),
	"invoice_number" varchar(80),
	"issue_description" text NOT NULL,
	"warranty_status" varchar(30) DEFAULT 'under_warranty' NOT NULL,
	"claim_status" varchar(30) DEFAULT 'received' NOT NULL,
	"technician_notes" text,
	"resolution" text,
	"supplier_rma_number" varchar(80),
	"supplier_id" uuid,
	"received_date" date NOT NULL,
	"resolved_date" date,
	"handled_by_id" uuid,
	"handled_by_name" varchar(150),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_name" varchar(150) NOT NULL,
	"account_number" varchar(60) NOT NULL,
	"masked_account_number" varchar(60),
	"bank_name" varchar(100) NOT NULL,
	"provider" varchar(80),
	"branch" varchar(100),
	"currency" varchar(10) DEFAULT 'NPR' NOT NULL,
	"account_type" varchar(30) DEFAULT 'bank' NOT NULL,
	"chart_account_id" uuid,
	"opening_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"current_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_period_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"period_month_name" varchar(40),
	"fiscal_year" varchar(20) DEFAULT '2082/83',
	"statement_ending_balance" numeric(14, 2) NOT NULL,
	"book_ending_balance" numeric(14, 2) NOT NULL,
	"deposits_in_transit" numeric(14, 2) DEFAULT '0',
	"outstanding_cheques" numeric(14, 2) DEFAULT '0',
	"bank_charges_adjustments" numeric(14, 2) DEFAULT '0',
	"adjusted_book_balance" numeric(14, 2) NOT NULL,
	"variance" numeric(14, 2) DEFAULT '0',
	"status" varchar(30) DEFAULT 'open',
	"prepared_by_id" uuid,
	"prepared_by_name" varchar(150),
	"prepared_at" timestamp,
	"approved_by_id" uuid,
	"approved_by_name" varchar(150),
	"approved_at" timestamp,
	"lock_signature" varchar(128),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"import_id" uuid,
	"statement_date" date NOT NULL,
	"value_date" date,
	"description" varchar(500) NOT NULL,
	"reference_no" varchar(120),
	"debit_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"balance_after" numeric(14, 2),
	"row_fingerprint" varchar(128),
	"is_reconciled" boolean DEFAULT false NOT NULL,
	"match_confidence" numeric(5, 2),
	"match_type" varchar(50),
	"matched_journal_id" uuid,
	"reconciled_at" timestamp,
	"reconciled_by_id" uuid,
	"reconciled_by_name" varchar(150),
	"suspense_status" varchar(30) DEFAULT 'none',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"cheque_number" varchar(50) NOT NULL,
	"cheque_type" varchar(20) DEFAULT 'outward' NOT NULL,
	"payee_or_drawer" varchar(150) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"issue_date" date NOT NULL,
	"clearing_date" date,
	"status" varchar(30) DEFAULT 'issued',
	"bounce_reason" varchar(200),
	"related_journal_id" uuid,
	"related_supplier_payment_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year" varchar(20) NOT NULL,
	"period_number" integer NOT NULL,
	"month_name_bs" varchar(30) NOT NULL,
	"start_date_ad" date NOT NULL,
	"end_date_ad" date NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"locked_at" timestamp,
	"locked_by_id" uuid,
	"locked_by_name" varchar(150),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"priority" integer DEFAULT 10 NOT NULL,
	"name" varchar(120) NOT NULL,
	"bank_account_id" uuid,
	"match_type" varchar(50) NOT NULL,
	"pattern" varchar(200) NOT NULL,
	"target_account_id" uuid,
	"tolerance_amount" numeric(10, 2) DEFAULT '0',
	"tolerance_days" integer DEFAULT 3,
	"confidence_score" numeric(5, 2) DEFAULT '90',
	"auto_apply" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(50) NOT NULL,
	"bank_account_id" uuid,
	"statement_id" uuid,
	"user_id" uuid,
	"user_name" varchar(150),
	"details_json" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_id" uuid NOT NULL,
	"journal_line_id" uuid,
	"journal_entry_id" uuid,
	"order_id" uuid,
	"pos_shift_id" uuid,
	"matched_amount" numeric(14, 2) NOT NULL,
	"match_confidence" numeric(5, 2) DEFAULT '100',
	"match_type" varchar(50) DEFAULT 'exact_ref',
	"notes" text,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statement_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_hash" varchar(128) NOT NULL,
	"import_source" varchar(40) DEFAULT 'csv',
	"total_rows" integer DEFAULT 0,
	"imported_rows" integer DEFAULT 0,
	"skipped_duplicates" integer DEFAULT 0,
	"opening_balance" numeric(14, 2),
	"closing_balance" numeric(14, 2),
	"status" varchar(30) DEFAULT 'completed',
	"imported_by_id" uuid,
	"imported_by_name" varchar(150),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_number" varchar(60) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"bill_id" uuid,
	"amount_paid" numeric(14, 2) NOT NULL,
	"tds_rate" numeric(5, 2) DEFAULT '1.5' NOT NULL,
	"tds_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_disbursed" numeric(14, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"payment_method" varchar(40) DEFAULT 'bank_transfer' NOT NULL,
	"bank_account_id" uuid,
	"cheque_or_ref_no" varchar(80),
	"journal_entry_id" uuid,
	"notes" text,
	"created_by_id" uuid,
	"created_by_name" varchar(150),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "z_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_number" varchar(60) NOT NULL,
	"business_date" date NOT NULL,
	"fiscal_year" varchar(20) DEFAULT '2082/83' NOT NULL,
	"gross_sales" numeric(14, 2) NOT NULL,
	"discounts_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"returns_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"taxable_amount" numeric(14, 2) NOT NULL,
	"vat_amount" numeric(14, 2) NOT NULL,
	"net_sales" numeric(14, 2) NOT NULL,
	"cash_expected" numeric(14, 2) NOT NULL,
	"cash_counted" numeric(14, 2) NOT NULL,
	"cash_variance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_summary_json" jsonb NOT NULL,
	"shifts_summary_json" jsonb NOT NULL,
	"sha256_hash" varchar(100) NOT NULL,
	"is_locked" boolean DEFAULT true NOT NULL,
	"closed_by_id" uuid,
	"closed_by_name" varchar(150),
	"closed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "staff_profiles" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "staff_profiles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "staff_profiles" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "invited_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "parent_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_images" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_images" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "product_images" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_specs" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_specs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "product_specs" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "brand_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "category_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "attribute_categories" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "attribute_categories" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "attribute_categories" ALTER COLUMN "attribute_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "attribute_categories" ALTER COLUMN "category_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "attribute_options" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "attribute_options" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "attribute_options" ALTER COLUMN "attribute_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "attributes" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "attributes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "filter_tags" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "filter_tags" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "product_attribute_values" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "product_attribute_values" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ALTER COLUMN "attribute_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ALTER COLUMN "option_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_filter_tags" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_filter_tags" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "product_filter_tags" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "product_filter_tags" ALTER COLUMN "filter_tag_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "variant_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "warehouse_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "variant_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "warehouse_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "order_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "expense_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "reverses_movement_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "performed_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "warehouses" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "warehouses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "cart_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "variant_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "carts" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "carts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "carts" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "wishlists" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "wishlists" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "wishlists" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "wishlists" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "delivery_partners" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "delivery_partners" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "delivery_zones" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "delivery_zones" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "order_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "variant_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "order_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "changed_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "coupon_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shipping_address_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_zone_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "order_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "order_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "delivery_partner_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "service_activity_logs" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "service_activity_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "service_activity_logs" ALTER COLUMN "ticket_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "service_activity_logs" ALTER COLUMN "created_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "service_tickets" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "service_tickets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "service_tickets" ALTER COLUMN "customer_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "service_tickets" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "service_tickets" ALTER COLUMN "assigned_to" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "order_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "announcement_bar" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "announcement_bar" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "hero_slides" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "hero_slides" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "hero_slides" ALTER COLUMN "featured_product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "homepage_sections" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "homepage_sections" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "navigation_menu_items" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "navigation_menu_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "navigation_menu_items" ALTER COLUMN "page_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "navigation_menu_items" ALTER COLUMN "parent_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "site_content_settings" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "site_content_settings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "payment_method_settings" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "payment_method_settings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "store_profile" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "store_profile" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "seo_page_meta" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "seo_page_meta" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "seo_redirects" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "seo_redirects" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "seo_settings" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "seo_settings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "parent_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "cod_settlements" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "cod_settlements" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cod_settlements" ALTER COLUMN "driver_user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "cod_settlements" ALTER COLUMN "deposit_account_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "cod_settlements" ALTER COLUMN "journal_entry_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "cod_settlements" ALTER COLUMN "settled_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "expense_categories" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "expense_categories" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "category_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "supplier_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "recorded_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "journal_entries" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "journal_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "journal_entries" ALTER COLUMN "source_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "journal_entries" ALTER COLUMN "posted_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "journal_lines" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "journal_lines" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "journal_lines" ALTER COLUMN "journal_entry_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "journal_lines" ALTER COLUMN "account_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ALTER COLUMN "bill_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "purchase_bills" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "purchase_bills" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "purchase_bills" ALTER COLUMN "supplier_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "purchase_bills" ALTER COLUMN "recorded_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "entity_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "delivery_routes" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "delivery_routes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "delivery_routes" ALTER COLUMN "order_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "delivery_routes" ALTER COLUMN "driver_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "delivery_routes" ALTER COLUMN "delivery_partner_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "driver_locations" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "driver_locations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "driver_locations" ALTER COLUMN "driver_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "customer_activity_logs" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "customer_activity_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "customer_activity_logs" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "customer_product_preferences" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "customer_product_preferences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "customer_product_preferences" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "customer_product_preferences" ALTER COLUMN "product_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ALTER COLUMN "created_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "contact_inquiries" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "contact_inquiries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "contact_inquiries" ALTER COLUMN "assigned_staff_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "contact_inquiries" ALTER COLUMN "converted_service_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "contact_inquiries" ALTER COLUMN "converted_lead_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inquiry_notes" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inquiry_notes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "inquiry_notes" ALTER COLUMN "inquiry_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "inquiry_notes" ALTER COLUMN "created_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "sales_leads" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "sales_leads" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "sales_leads" ALTER COLUMN "created_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "custom_roles" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "custom_roles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "custom_roles" ALTER COLUMN "created_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ALTER COLUMN "custom_role_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ALTER COLUMN "assigned_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "related_order_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "otp_codes" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "otp_codes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pos_pin" varchar(255);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_physical_product" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "requires_shipping" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight_kg" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "length_cm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "width_cm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "height_cm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_free_shipping" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "fixed_shipping_fee" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "goods_receipt_note_items" ADD CONSTRAINT "goods_receipt_note_items_grn_id_goods_receipt_notes_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."goods_receipt_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_note_items" ADD CONSTRAINT "goods_receipt_note_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_note_items" ADD CONSTRAINT "goods_receipt_note_items_po_item_id_purchase_order_items_id_fk" FOREIGN KEY ("po_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_storekeeper_id_users_id_fk" FOREIGN KEY ("storekeeper_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_purchase_bill_id_purchase_bills_id_fk" FOREIGN KEY ("purchase_bill_id") REFERENCES "public"."purchase_bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_approvals" ADD CONSTRAINT "po_approvals_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_approvals" ADD CONSTRAINT "po_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_attachments" ADD CONSTRAINT "po_attachments_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_communications" ADD CONSTRAINT "po_communications_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_revisions" ADD CONSTRAINT "purchase_order_revisions_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_revisions" ADD CONSTRAINT "purchase_order_revisions_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_terms" ADD CONSTRAINT "supplier_terms_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_days" ADD CONSTRAINT "business_days_closed_by_staff_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_cash_transactions" ADD CONSTRAINT "pos_cash_transactions_shift_id_pos_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."pos_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_approvals" ADD CONSTRAINT "pos_shift_approvals_shift_id_pos_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."pos_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_approvals" ADD CONSTRAINT "pos_shift_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_cash_movements" ADD CONSTRAINT "pos_shift_cash_movements_shift_id_pos_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."pos_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_denominations" ADD CONSTRAINT "pos_shift_denominations_shift_id_pos_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."pos_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_denominations" ADD CONSTRAINT "pos_shift_denominations_counted_by_id_users_id_fk" FOREIGN KEY ("counted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_denominations" ADD CONSTRAINT "pos_shift_denominations_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_tender_reconciliations" ADD CONSTRAINT "pos_shift_tender_reconciliations_shift_id_pos_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."pos_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_tender_reconciliations" ADD CONSTRAINT "pos_shift_tender_reconciliations_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_opened_by_supervisor_id_users_id_fk" FOREIGN KEY ("opened_by_supervisor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_closed_by_supervisor_id_users_id_fk" FOREIGN KEY ("closed_by_supervisor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_assigned_to_id_staff_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_staff_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_approver_id_staff_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_terminal_id_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limit_overrides" ADD CONSTRAINT "limit_overrides_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limit_overrides" ADD CONSTRAINT "limit_overrides_granted_by_id_staff_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_history" ADD CONSTRAINT "pin_history_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_reset_requests" ADD CONSTRAINT "pin_reset_requests_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_reset_requests" ADD CONSTRAINT "pin_reset_requests_requested_by_id_staff_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_reset_requests" ADD CONSTRAINT "pin_reset_requests_approved_by_id_staff_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_business_day_id_business_days_id_fk" FOREIGN KEY ("business_day_id") REFERENCES "public"."business_days"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_terminal_id_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_cashier_id_staff_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_opened_by_supervisor_id_staff_id_fk" FOREIGN KEY ("opened_by_supervisor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closed_by_supervisor_id_staff_id_fk" FOREIGN KEY ("closed_by_supervisor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_variance_approved_by_staff_id_fk" FOREIGN KEY ("variance_approved_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_limits" ADD CONSTRAINT "staff_limits_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_limits" ADD CONSTRAINT "staff_limits_updated_by_id_staff_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_terminal_id_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_targets" ADD CONSTRAINT "staff_targets_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_terminals" ADD CONSTRAINT "staff_terminals_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_terminals" ADD CONSTRAINT "staff_terminals_terminal_id_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_session_items" ADD CONSTRAINT "audit_session_items_session_id_audit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."audit_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_session_items" ADD CONSTRAINT "audit_session_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_started_by_id_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_grn_id_goods_receipt_notes_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."goods_receipt_notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_serials" ADD CONSTRAINT "product_serials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_serials" ADD CONSTRAINT "product_serials_grn_item_id_goods_receipt_note_items_id_fk" FOREIGN KEY ("grn_item_id") REFERENCES "public"."goods_receipt_note_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_serials" ADD CONSTRAINT "product_serials_grn_id_goods_receipt_notes_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."goods_receipt_notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_serials" ADD CONSTRAINT "product_serials_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_serials" ADD CONSTRAINT "product_serials_bin_id_warehouse_bins_id_fk" FOREIGN KEY ("bin_id") REFERENCES "public"."warehouse_bins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_return_items" ADD CONSTRAINT "stock_return_items_return_id_stock_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."stock_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_return_items" ADD CONSTRAINT "stock_return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_return_items" ADD CONSTRAINT "stock_return_items_serial_id_product_serials_id_fk" FOREIGN KEY ("serial_id") REFERENCES "public"."product_serials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_source_warehouse_id_warehouses_id_fk" FOREIGN KEY ("source_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_dest_warehouse_id_warehouses_id_fk" FOREIGN KEY ("dest_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_serial_id_product_serials_id_fk" FOREIGN KEY ("serial_id") REFERENCES "public"."product_serials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_handled_by_id_users_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_chart_account_id_accounts_id_fk" FOREIGN KEY ("chart_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_period_reconciliations" ADD CONSTRAINT "bank_period_reconciliations_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_period_reconciliations" ADD CONSTRAINT "bank_period_reconciliations_prepared_by_id_users_id_fk" FOREIGN KEY ("prepared_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_period_reconciliations" ADD CONSTRAINT "bank_period_reconciliations_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_import_id_statement_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."statement_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_matched_journal_id_journal_entries_id_fk" FOREIGN KEY ("matched_journal_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_reconciled_by_id_users_id_fk" FOREIGN KEY ("reconciled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_related_journal_id_journal_entries_id_fk" FOREIGN KEY ("related_journal_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_locked_by_id_users_id_fk" FOREIGN KEY ("locked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rules" ADD CONSTRAINT "match_rules_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rules" ADD CONSTRAINT "match_rules_target_account_id_accounts_id_fk" FOREIGN KEY ("target_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rules" ADD CONSTRAINT "match_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_audit_logs" ADD CONSTRAINT "reconciliation_audit_logs_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_audit_logs" ADD CONSTRAINT "reconciliation_audit_logs_statement_id_bank_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_audit_logs" ADD CONSTRAINT "reconciliation_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_statement_id_bank_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_journal_line_id_journal_lines_id_fk" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_pos_shift_id_pos_shifts_id_fk" FOREIGN KEY ("pos_shift_id") REFERENCES "public"."pos_shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_imported_by_id_users_id_fk" FOREIGN KEY ("imported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_bill_id_purchase_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."purchase_bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "z_reports" ADD CONSTRAINT "z_reports_closed_by_id_users_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goods_receipt_note_items_grn_idx" ON "goods_receipt_note_items" USING btree ("grn_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_notes_number_idx" ON "goods_receipt_notes" USING btree ("grn_number");--> statement-breakpoint
CREATE INDEX "goods_receipt_notes_po_idx" ON "goods_receipt_notes" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_notes_supplier_idx" ON "goods_receipt_notes" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_notes_status_idx" ON "goods_receipt_notes" USING btree ("financial_status");--> statement-breakpoint
CREATE INDEX "po_approvals_poid_idx" ON "po_approvals" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "po_attachments_poid_idx" ON "po_attachments" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "po_comm_poid_idx" ON "po_communications" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_po_idx" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "po_revisions_poid_idx" ON "purchase_order_revisions" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_number_idx" ON "purchase_orders" USING btree ("po_number");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pos_cash_shift_idx" ON "pos_cash_transactions" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "pos_approval_shift_idx" ON "pos_shift_approvals" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "pos_move_shift_idx" ON "pos_shift_cash_movements" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "pos_denom_shift_count_idx" ON "pos_shift_denominations" USING btree ("shift_id","count_type");--> statement-breakpoint
CREATE INDEX "pos_tender_shift_idx" ON "pos_shift_tender_reconciliations" USING btree ("shift_id","tender_type");--> statement-breakpoint
CREATE INDEX "pos_shifts_register_idx" ON "pos_shifts" USING btree ("register_code");--> statement-breakpoint
CREATE INDEX "pos_shifts_cashier_idx" ON "pos_shifts" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "pos_shifts_status_idx" ON "pos_shifts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_staff_code_idx" ON "staff" USING btree ("staff_code");--> statement-breakpoint
CREATE INDEX "staff_active_role_idx" ON "staff" USING btree ("active","role");--> statement-breakpoint
CREATE INDEX "audit_session_items_session_idx" ON "audit_session_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "audit_session_items_product_idx" ON "audit_session_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_sessions_number_idx" ON "audit_sessions" USING btree ("session_number");--> statement-breakpoint
CREATE INDEX "audit_sessions_status_idx" ON "audit_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_sessions_warehouse_idx" ON "audit_sessions" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_alerts_type_idx" ON "inventory_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "inventory_alerts_resolved_idx" ON "inventory_alerts" USING btree ("is_resolved");--> statement-breakpoint
CREATE INDEX "inventory_alerts_created_idx" ON "inventory_alerts" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "product_batches_prod_batch_idx" ON "product_batches" USING btree ("product_id","batch_number");--> statement-breakpoint
CREATE INDEX "product_batches_expiry_idx" ON "product_batches" USING btree ("expiry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "product_serials_product_serial_idx" ON "product_serials" USING btree ("product_id","serial_number");--> statement-breakpoint
CREATE INDEX "product_serials_serial_number_idx" ON "product_serials" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "product_serials_status_idx" ON "product_serials" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_serials_warehouse_idx" ON "product_serials" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_return_items_return_idx" ON "stock_return_items" USING btree ("return_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_returns_number_idx" ON "stock_returns" USING btree ("return_number");--> statement-breakpoint
CREATE INDEX "stock_returns_type_idx" ON "stock_returns" USING btree ("return_type");--> statement-breakpoint
CREATE INDEX "stock_returns_status_idx" ON "stock_returns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stock_transfer_items_transfer_idx" ON "stock_transfer_items" USING btree ("transfer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_transfers_number_idx" ON "stock_transfers" USING btree ("transfer_number");--> statement-breakpoint
CREATE INDEX "stock_transfers_status_idx" ON "stock_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stock_transfers_source_idx" ON "stock_transfers" USING btree ("source_warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_transfers_dest_idx" ON "stock_transfers" USING btree ("dest_warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_bins_code_idx" ON "warehouse_bins" USING btree ("code");--> statement-breakpoint
CREATE INDEX "warehouse_bins_warehouse_idx" ON "warehouse_bins" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warranty_claims_number_idx" ON "warranty_claims" USING btree ("claim_number");--> statement-breakpoint
CREATE INDEX "warranty_claims_status_idx" ON "warranty_claims" USING btree ("claim_status");--> statement-breakpoint
CREATE INDEX "warranty_claims_serial_idx" ON "warranty_claims" USING btree ("serial_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_number_idx" ON "bank_accounts" USING btree ("account_number");--> statement-breakpoint
CREATE INDEX "bank_accounts_type_idx" ON "bank_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE UNIQUE INDEX "bpr_acc_period_idx" ON "bank_period_reconciliations" USING btree ("bank_account_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "bank_statements_bank_date_idx" ON "bank_statements" USING btree ("bank_account_id","statement_date");--> statement-breakpoint
CREATE INDEX "bank_statements_reconciled_idx" ON "bank_statements" USING btree ("is_reconciled");--> statement-breakpoint
CREATE INDEX "stmt_fingerprint_idx" ON "bank_statements" USING btree ("row_fingerprint");--> statement-breakpoint
CREATE INDEX "stmt_import_id_idx" ON "bank_statements" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "cheques_num_idx" ON "cheques" USING btree ("cheque_number");--> statement-breakpoint
CREATE INDEX "cheques_acc_status_idx" ON "cheques" USING btree ("bank_account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_periods_fy_period_idx" ON "fiscal_periods" USING btree ("fiscal_year","period_number");--> statement-breakpoint
CREATE INDEX "fiscal_periods_is_locked_idx" ON "fiscal_periods" USING btree ("is_locked");--> statement-breakpoint
CREATE INDEX "recon_audit_action_idx" ON "reconciliation_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "recon_audit_acc_idx" ON "reconciliation_audit_logs" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "recon_match_stmt_idx" ON "reconciliation_matches" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "recon_match_jl_idx" ON "reconciliation_matches" USING btree ("journal_line_id");--> statement-breakpoint
CREATE INDEX "stmt_import_bank_idx" ON "statement_imports" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "stmt_import_hash_idx" ON "statement_imports" USING btree ("file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_payments_num_idx" ON "supplier_payments" USING btree ("payment_number");--> statement-breakpoint
CREATE INDEX "supplier_payments_supplier_idx" ON "supplier_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_payments_date_idx" ON "supplier_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "z_reports_num_idx" ON "z_reports" USING btree ("report_number");--> statement-breakpoint
CREATE UNIQUE INDEX "z_reports_business_date_idx" ON "z_reports" USING btree ("business_date");