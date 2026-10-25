-- drizzle/migrations/0027_warehouse_enterprise.sql
-- Enterprise Warehouse Management, Purchase Orders, GRNs, Bins, Serials/IMEI, Transfers, Audits, Returns, and Warranty tracking

-- 1. Purchase Orders & PO Items (if not already created)
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" serial PRIMARY KEY,
  "supplier_id" integer NOT NULL REFERENCES "suppliers"("id") ON DELETE RESTRICT,
  "po_number" varchar(60) NOT NULL,
  "order_date" date NOT NULL,
  "expected_delivery_date" date,
  "subtotal" numeric(12, 2) NOT NULL DEFAULT 0,
  "vat_amount" numeric(12, 2) NOT NULL DEFAULT 0,
  "total_amount" numeric(12, 2) NOT NULL DEFAULT 0,
  "status" varchar(30) NOT NULL DEFAULT 'draft',
  "payment_terms" varchar(100),
  "notes" text,
  "created_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_by_name" varchar(150),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_number_idx" ON "purchase_orders"("po_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_supplier_idx" ON "purchase_orders"("supplier_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx" ON "purchase_orders"("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "purchase_order_items" (
  "id" serial PRIMARY KEY,
  "purchase_order_id" integer NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
  "product_id" integer REFERENCES "products"("id") ON DELETE SET NULL,
  "sku" varchar(60),
  "description" varchar(300) NOT NULL,
  "quantity_ordered" integer NOT NULL DEFAULT 1,
  "quantity_received" integer NOT NULL DEFAULT 0,
  "unit_cost" numeric(12, 2) NOT NULL,
  "line_total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_items_po_idx" ON "purchase_order_items"("purchase_order_id");
--> statement-breakpoint

-- 2. Goods Receipt Notes & GRN Items
CREATE TABLE IF NOT EXISTS "goods_receipt_notes" (
  "id" serial PRIMARY KEY,
  "grn_number" varchar(60) NOT NULL,
  "purchase_order_id" integer REFERENCES "purchase_orders"("id") ON DELETE SET NULL,
  "supplier_id" integer NOT NULL REFERENCES "suppliers"("id") ON DELETE RESTRICT,
  "supplier_invoice_no" varchar(80),
  "received_date" date NOT NULL,
  "storekeeper_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "storekeeper_name" varchar(150),
  "total_items" integer NOT NULL DEFAULT 0,
  "total_quantity" integer NOT NULL DEFAULT 0,
  "total_amount" numeric(12, 2) NOT NULL DEFAULT 0,
  "financial_status" varchar(30) NOT NULL DEFAULT 'pending_invoice',
  "purchase_bill_id" integer REFERENCES "purchase_bills"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "goods_receipt_notes_number_idx" ON "goods_receipt_notes"("grn_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goods_receipt_notes_po_idx" ON "goods_receipt_notes"("purchase_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goods_receipt_notes_supplier_idx" ON "goods_receipt_notes"("supplier_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goods_receipt_notes_status_idx" ON "goods_receipt_notes"("financial_status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "goods_receipt_note_items" (
  "id" serial PRIMARY KEY,
  "grn_id" integer NOT NULL REFERENCES "goods_receipt_notes"("id") ON DELETE CASCADE,
  "product_id" integer REFERENCES "products"("id") ON DELETE SET NULL,
  "po_item_id" integer REFERENCES "purchase_order_items"("id") ON DELETE SET NULL,
  "sku" varchar(60),
  "description" varchar(300) NOT NULL,
  "quantity_received" integer NOT NULL DEFAULT 1,
  "unit_cost" numeric(12, 2) NOT NULL,
  "line_total" numeric(12, 2) NOT NULL,
  "batch_no" varchar(60),
  "expiry_date" date
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goods_receipt_note_items_grn_idx" ON "goods_receipt_note_items"("grn_id");
--> statement-breakpoint

-- 3. Warehouse Bins
CREATE TABLE IF NOT EXISTS "warehouse_bins" (
  "id" serial PRIMARY KEY,
  "warehouse_id" integer NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
  "zone" varchar(30) NOT NULL DEFAULT 'A',
  "rack" varchar(30) NOT NULL DEFAULT '01',
  "shelf" varchar(30) NOT NULL DEFAULT 'S1',
  "bin" varchar(30) NOT NULL DEFAULT 'B01',
  "code" varchar(60) NOT NULL,
  "description" varchar(150),
  "capacity_units" integer NOT NULL DEFAULT 100,
  "current_usage" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "warehouse_bins_code_idx" ON "warehouse_bins"("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warehouse_bins_warehouse_idx" ON "warehouse_bins"("warehouse_id");
--> statement-breakpoint

-- 4. Product Serials / IMEI
CREATE TABLE IF NOT EXISTS "product_serials" (
  "id" serial PRIMARY KEY,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "serial_number" varchar(100) NOT NULL,
  "grn_item_id" integer REFERENCES "goods_receipt_note_items"("id") ON DELETE SET NULL,
  "grn_id" integer REFERENCES "goods_receipt_notes"("id") ON DELETE SET NULL,
  "status" varchar(30) NOT NULL DEFAULT 'in_stock',
  "warehouse_id" integer REFERENCES "warehouses"("id") ON DELETE SET NULL,
  "bin_id" integer REFERENCES "warehouse_bins"("id") ON DELETE SET NULL,
  "cost_price" numeric(12, 2),
  "selling_price" numeric(12, 2),
  "warranty_months" integer NOT NULL DEFAULT 12,
  "warranty_start_date" date,
  "warranty_end_date" date,
  "sold_invoice_no" varchar(60),
  "sold_date" timestamp,
  "customer_id" integer,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_serials_product_serial_idx" ON "product_serials"("product_id", "serial_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_serials_serial_number_idx" ON "product_serials"("serial_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_serials_status_idx" ON "product_serials"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_serials_warehouse_idx" ON "product_serials"("warehouse_id");
--> statement-breakpoint

-- 5. Product Batches
CREATE TABLE IF NOT EXISTS "product_batches" (
  "id" serial PRIMARY KEY,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "batch_number" varchar(80) NOT NULL,
  "grn_id" integer REFERENCES "goods_receipt_notes"("id") ON DELETE SET NULL,
  "initial_quantity" integer NOT NULL DEFAULT 0,
  "current_quantity" integer NOT NULL DEFAULT 0,
  "unit_cost" numeric(12, 2) NOT NULL DEFAULT 0,
  "manufacturing_date" date,
  "expiry_date" date,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_batches_prod_batch_idx" ON "product_batches"("product_id", "batch_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_batches_expiry_idx" ON "product_batches"("expiry_date");
--> statement-breakpoint

-- 6. Stock Transfers
CREATE TABLE IF NOT EXISTS "stock_transfers" (
  "id" serial PRIMARY KEY,
  "transfer_number" varchar(60) NOT NULL,
  "source_warehouse_id" integer NOT NULL REFERENCES "warehouses"("id") ON DELETE RESTRICT,
  "dest_warehouse_id" integer NOT NULL REFERENCES "warehouses"("id") ON DELETE RESTRICT,
  "status" varchar(30) NOT NULL DEFAULT 'draft',
  "total_items" integer NOT NULL DEFAULT 0,
  "total_quantity" integer NOT NULL DEFAULT 0,
  "notes" text,
  "requested_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "requested_by_name" varchar(150),
  "approved_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_by_name" varchar(150),
  "shipped_at" timestamp,
  "received_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_transfers_number_idx" ON "stock_transfers"("transfer_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_transfers_status_idx" ON "stock_transfers"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_transfers_source_idx" ON "stock_transfers"("source_warehouse_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_transfers_dest_idx" ON "stock_transfers"("dest_warehouse_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "stock_transfer_items" (
  "id" serial PRIMARY KEY,
  "transfer_id" integer NOT NULL REFERENCES "stock_transfers"("id") ON DELETE CASCADE,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "sku" varchar(60) NOT NULL,
  "quantity_requested" integer NOT NULL DEFAULT 1,
  "quantity_shipped" integer NOT NULL DEFAULT 0,
  "quantity_received" integer NOT NULL DEFAULT 0,
  "discrepancy_note" varchar(300)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_transfer_items_transfer_idx" ON "stock_transfer_items"("transfer_id");
--> statement-breakpoint

-- 7. Audit Sessions
CREATE TABLE IF NOT EXISTS "audit_sessions" (
  "id" serial PRIMARY KEY,
  "session_number" varchar(60) NOT NULL,
  "title" varchar(150) NOT NULL,
  "audit_type" varchar(30) NOT NULL DEFAULT 'full',
  "warehouse_id" integer NOT NULL REFERENCES "warehouses"("id") ON DELETE RESTRICT,
  "status" varchar(30) NOT NULL DEFAULT 'in_progress',
  "blind_count_enabled" boolean NOT NULL DEFAULT true,
  "total_skus_counted" integer NOT NULL DEFAULT 0,
  "total_variance_qty" integer NOT NULL DEFAULT 0,
  "total_variance_value" numeric(14, 2) NOT NULL DEFAULT 0,
  "started_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "started_by_name" varchar(150),
  "approved_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_by_name" varchar(150),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "audit_sessions_number_idx" ON "audit_sessions"("session_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_sessions_status_idx" ON "audit_sessions"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_sessions_warehouse_idx" ON "audit_sessions"("warehouse_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "audit_session_items" (
  "id" serial PRIMARY KEY,
  "session_id" integer NOT NULL REFERENCES "audit_sessions"("id") ON DELETE CASCADE,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "sku" varchar(60) NOT NULL,
  "product_name" varchar(200) NOT NULL,
  "system_qty_snapshot" integer NOT NULL DEFAULT 0,
  "physical_count_qty" integer NOT NULL DEFAULT 0,
  "variance_qty" integer NOT NULL DEFAULT 0,
  "unit_cost_snapshot" numeric(12, 2) NOT NULL DEFAULT 0,
  "variance_value" numeric(14, 2) NOT NULL DEFAULT 0,
  "is_recounted" boolean NOT NULL DEFAULT false,
  "status" varchar(30) NOT NULL DEFAULT 'counted',
  "notes" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_session_items_session_idx" ON "audit_session_items"("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_session_items_product_idx" ON "audit_session_items"("product_id");
--> statement-breakpoint

-- 8. Returns
CREATE TABLE IF NOT EXISTS "stock_returns" (
  "id" serial PRIMARY KEY,
  "return_number" varchar(60) NOT NULL,
  "return_type" varchar(30) NOT NULL DEFAULT 'customer_return',
  "reference_invoice_or_po" varchar(80),
  "supplier_id" integer REFERENCES "suppliers"("id") ON DELETE SET NULL,
  "status" varchar(30) NOT NULL DEFAULT 'draft',
  "total_amount" numeric(12, 2) NOT NULL DEFAULT 0,
  "reason" varchar(200) NOT NULL,
  "notes" text,
  "created_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_by_name" varchar(150),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_returns_number_idx" ON "stock_returns"("return_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_returns_type_idx" ON "stock_returns"("return_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_returns_status_idx" ON "stock_returns"("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "stock_return_items" (
  "id" serial PRIMARY KEY,
  "return_id" integer NOT NULL REFERENCES "stock_returns"("id") ON DELETE CASCADE,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "serial_id" integer REFERENCES "product_serials"("id") ON DELETE SET NULL,
  "sku" varchar(60) NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_cost" numeric(12, 2) NOT NULL DEFAULT 0,
  "action" varchar(40) NOT NULL DEFAULT 'restock',
  "notes" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_return_items_return_idx" ON "stock_return_items"("return_id");
--> statement-breakpoint

-- 9. Warranty Claims
CREATE TABLE IF NOT EXISTS "warranty_claims" (
  "id" serial PRIMARY KEY,
  "claim_number" varchar(60) NOT NULL,
  "serial_id" integer REFERENCES "product_serials"("id") ON DELETE SET NULL,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "customer_name" varchar(150) NOT NULL,
  "customer_phone" varchar(30) NOT NULL,
  "customer_email" varchar(150),
  "invoice_number" varchar(80),
  "issue_description" text NOT NULL,
  "warranty_status" varchar(30) NOT NULL DEFAULT 'under_warranty',
  "claim_status" varchar(30) NOT NULL DEFAULT 'received',
  "technician_notes" text,
  "resolution" text,
  "supplier_rma_number" varchar(80),
  "supplier_id" integer REFERENCES "suppliers"("id") ON DELETE SET NULL,
  "received_date" date NOT NULL,
  "resolved_date" date,
  "handled_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "handled_by_name" varchar(150),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "warranty_claims_number_idx" ON "warranty_claims"("claim_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warranty_claims_status_idx" ON "warranty_claims"("claim_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warranty_claims_serial_idx" ON "warranty_claims"("serial_id");
--> statement-breakpoint

-- 10. Inventory Alerts
CREATE TABLE IF NOT EXISTS "inventory_alerts" (
  "id" serial PRIMARY KEY,
  "alert_type" varchar(40) NOT NULL,
  "severity" varchar(20) NOT NULL DEFAULT 'warning',
  "product_id" integer REFERENCES "products"("id") ON DELETE SET NULL,
  "reference_id" varchar(80),
  "title" varchar(200) NOT NULL,
  "message" text NOT NULL,
  "is_resolved" boolean NOT NULL DEFAULT false,
  "resolved_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "resolved_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_alerts_type_idx" ON "inventory_alerts"("alert_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_alerts_resolved_idx" ON "inventory_alerts"("is_resolved");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_alerts_created_idx" ON "inventory_alerts"("created_at" DESC);
