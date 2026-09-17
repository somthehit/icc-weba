CREATE TYPE "public"."attribute_data_type" AS ENUM('text', 'number', 'boolean', 'select');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_reason" AS ENUM('sale', 'sale_cancelled', 'supplier_restock', 'customer_return', 'damaged', 'stolen', 'expired', 'internal_use', 'audit_correction', 'initial_stock');--> statement-breakpoint
CREATE TYPE "public"."regional_scope" AS ENUM('region_exclusive', 'nepal_nationwide');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('ON_DUTY', 'ON_TRANSIT', 'OFF_DUTY');--> statement-breakpoint
CREATE TYPE "public"."sitemap_frequency" AS ENUM('always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('SUPER_ADMIN', 'STORE_MANAGER', 'SALES_AGENT', 'SERVICE_TECHNICIAN', 'DELIVERY_DRIVER');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'delivery_driver';--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"staff_role" "staff_role" NOT NULL,
	"department" varchar(120),
	"skills" text[] DEFAULT '{}' NOT NULL,
	"specialization" varchar(180),
	"vehicle_number" varchar(40),
	"driving_license_no" varchar(60),
	"shift_status" "shift_status" DEFAULT 'OFF_DUTY' NOT NULL,
	"assigned_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "attribute_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"attribute_id" integer NOT NULL,
	"category_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribute_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"attribute_id" integer NOT NULL,
	"value" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attributes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"description" varchar(300),
	"data_type" "attribute_data_type" DEFAULT 'text' NOT NULL,
	"unit" varchar(20),
	"is_filterable" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filter_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" varchar(300),
	"color" varchar(20) DEFAULT 'blue' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_attribute_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"attribute_id" integer NOT NULL,
	"option_id" integer,
	"value_text" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "product_filter_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"filter_tag_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer,
	"warehouse_id" integer,
	"product_name_snapshot" varchar(200) NOT NULL,
	"sku_snapshot" varchar(60) NOT NULL,
	"quantity_delta" integer NOT NULL,
	"quantity_after" integer NOT NULL,
	"reason" "inventory_movement_reason" NOT NULL,
	"unit_cost_snapshot" numeric(12, 2),
	"note" varchar(500),
	"reference_no" varchar(60),
	"order_id" integer,
	"expense_id" integer,
	"reverses_movement_id" integer,
	"performed_by" integer,
	"performed_by_name" varchar(150),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"activity_type" varchar(40) NOT NULL,
	"message" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_type" varchar(40) NOT NULL,
	"title" varchar(150),
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_content_settings" (
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
--> statement-breakpoint
CREATE TABLE "seo_page_meta" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_key" varchar(60) NOT NULL,
	"label" varchar(120) NOT NULL,
	"path" varchar(300) NOT NULL,
	"meta_title" varchar(200),
	"meta_description" varchar(500),
	"keywords" text,
	"og_image_url" varchar(500),
	"json_ld_override" jsonb,
	"no_index" boolean DEFAULT false NOT NULL,
	"include_in_sitemap" boolean DEFAULT true NOT NULL,
	"sitemap_priority" numeric(2, 1) DEFAULT '0.8' NOT NULL,
	"sitemap_frequency" "sitemap_frequency" DEFAULT 'weekly' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_redirects" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_path" varchar(300) NOT NULL,
	"to_path" varchar(300) NOT NULL,
	"status_code" integer DEFAULT 301 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_name" varchar(150) DEFAULT 'Intel Computer Center' NOT NULL,
	"canonical_base_url" varchar(300) DEFAULT 'https://www.intelcomputer.com.np' NOT NULL,
	"title_suffix" varchar(200),
	"default_meta_title" varchar(200),
	"default_meta_description" varchar(500),
	"default_keywords" text,
	"og_image_url" varchar(500),
	"twitter_handle" varchar(60),
	"og_locale" varchar(12) DEFAULT 'en_NP' NOT NULL,
	"active_scope" "regional_scope" DEFAULT 'region_exclusive' NOT NULL,
	"region_banner_message" varchar(300),
	"region_banner_enabled" boolean DEFAULT true NOT NULL,
	"extra_areas_served" text,
	"structured_data_enabled" boolean DEFAULT true NOT NULL,
	"local_business_type" varchar(60) DEFAULT 'ComputerStore' NOT NULL,
	"price_range" varchar(60) DEFAULT 'NPR 500 - NPR 500,000' NOT NULL,
	"geo_latitude" numeric(9, 6),
	"geo_longitude" numeric(9, 6),
	"robots_indexing_enabled" boolean DEFAULT true NOT NULL,
	"robots_extra_disallow" text,
	"sitemap_include_products" boolean DEFAULT true NOT NULL,
	"sitemap_include_categories" boolean DEFAULT true NOT NULL,
	"sitemap_include_pages" boolean DEFAULT true NOT NULL,
	"sitemap_default_frequency" "sitemap_frequency" DEFAULT 'daily' NOT NULL,
	"google_site_verification" varchar(200),
	"bing_site_verification" varchar(200),
	"google_analytics_id" varchar(100),
	"facebook_pixel_id" varchar(100),
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar(150)
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(160) NOT NULL,
	"type" varchar(20) NOT NULL,
	"parent_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cod_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlement_number" varchar(40) DEFAULT 'COD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('cod_settlement_number_seq')::text, 6, '0') NOT NULL,
	"driver_user_id" integer,
	"driver_name" varchar(150) NOT NULL,
	"order_reference" varchar(60),
	"collected_amount" numeric(14, 2) NOT NULL,
	"deposit_account_id" integer NOT NULL,
	"bank_reference" varchar(80),
	"attachment_url" varchar(500),
	"journal_entry_id" integer NOT NULL,
	"notes" text,
	"settled_by" integer,
	"settled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(300),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
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
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_number" varchar(40) NOT NULL,
	"entry_date" date NOT NULL,
	"description" varchar(300) NOT NULL,
	"source_type" varchar(40),
	"source_id" integer,
	"attachment_url" varchar(500),
	"posted_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_entry_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"description" varchar(300),
	"debit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_bill_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL,
	"product_id" integer,
	"description" varchar(300) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_bills" (
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
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"contact_person" varchar(120),
	"phone" varchar(15),
	"email" varchar(160),
	"address" varchar(300),
	"vat_pan_no" varchar(30),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_product_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"preference" varchar(12) NOT NULL,
	"affinity_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_by" integer,
	"name" varchar(150) NOT NULL,
	"channel" varchar(12) NOT NULL,
	"subject" varchar(200),
	"body" text NOT NULL,
	"audience" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"converted_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"inquiry_number" varchar(30) DEFAULT 'INQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('contact_inquiry_number_seq')::text, 6, '0') NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"phone" varchar(15) NOT NULL,
	"email" varchar(200),
	"subject" varchar(120) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'UNREAD' NOT NULL,
	"assigned_staff_id" integer,
	"converted_service_id" integer,
	"converted_lead_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiry_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"inquiry_id" integer NOT NULL,
	"note" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_number" varchar(30) NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"phone" varchar(15) NOT NULL,
	"email" varchar(200),
	"request" text NOT NULL,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_name" varchar(80) NOT NULL,
	"role_slug" varchar(60) NOT NULL,
	"description" text,
	"icon" varchar(16) DEFAULT '🛡️' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_role_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"custom_role_id" integer NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(50) DEFAULT 'info' NOT NULL,
	"related_order_id" integer,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" varchar(15) NOT NULL,
	"code" varchar(6) NOT NULL,
	"purpose" varchar(30) DEFAULT 'phone_verify' NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "tole" varchar(255);--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "house_number" varchar(50);--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "postal_code" varchar(10);--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "delivery_instructions" text;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "latitude" integer;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "longitude" integer;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "barcode" varchar(64);--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "districts" varchar(500);--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "municipalities" varchar(1000);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_cost_snapshot" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_address_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "channel" varchar(20) DEFAULT 'OFFLINE_WALKIN' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "workflow_status" varchar(30) DEFAULT 'PENDING_INSPECTION' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "device_brand" varchar(100);--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "device_model" varchar(150);--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "serial_number" varchar(120);--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "condition_checklist" jsonb;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "lock_code" varchar(120);--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "preferred_date" timestamp;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "preferred_time" varchar(80);--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "service_address" varchar(500);--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "advance_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "charged_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "admin_response" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "admin_response_at" timestamp;--> statement-breakpoint
ALTER TABLE "hero_slides" ADD COLUMN "desktop_image_url" varchar(500);--> statement-breakpoint
ALTER TABLE "hero_slides" ADD COLUMN "mobile_image_url" varchar(500);--> statement-breakpoint
ALTER TABLE "hero_slides" ADD COLUMN "starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "hero_slides" ADD COLUMN "ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "tagline" varchar(300);--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "legal_name" varchar(200);--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "pan_vat_number" varchar(20);--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "dark_logo_url" varchar(500);--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "favicon_url" varchar(500);--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "invoice_logo_url" varchar(500);--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "address" varchar(500);--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "opening_hours" varchar(200);--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "announcement_text" varchar(300);--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "announcement_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "multi_currency_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "calendar" varchar(3) DEFAULT 'AD' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "guest_checkout_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "minimum_order_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "stock_lock_minutes" numeric(6, 0) DEFAULT '15' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "unpaid_order_cancel_minutes" numeric(6, 0) DEFAULT '30' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profile" ADD COLUMN "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_categories" ADD CONSTRAINT "attribute_categories_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_categories" ADD CONSTRAINT "attribute_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_option_id_attribute_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."attribute_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filter_tags" ADD CONSTRAINT "product_filter_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filter_tags" ADD CONSTRAINT "product_filter_tags_filter_tag_id_filter_tags_id_fk" FOREIGN KEY ("filter_tag_id") REFERENCES "public"."filter_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reverses_movement_id_inventory_movements_id_fk" FOREIGN KEY ("reverses_movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_activity_logs" ADD CONSTRAINT "service_activity_logs_ticket_id_service_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."service_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_activity_logs" ADD CONSTRAINT "service_activity_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_settlements" ADD CONSTRAINT "cod_settlements_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_settlements" ADD CONSTRAINT "cod_settlements_deposit_account_id_accounts_id_fk" FOREIGN KEY ("deposit_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_settlements" ADD CONSTRAINT "cod_settlements_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_settlements" ADD CONSTRAINT "cod_settlements_settled_by_users_id_fk" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_bill_id_purchase_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."purchase_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_activity_logs" ADD CONSTRAINT "customer_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_product_preferences" ADD CONSTRAINT "customer_product_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_product_preferences" ADD CONSTRAINT "customer_product_preferences_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_inquiries" ADD CONSTRAINT "contact_inquiries_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_inquiries" ADD CONSTRAINT "contact_inquiries_converted_service_id_service_tickets_id_fk" FOREIGN KEY ("converted_service_id") REFERENCES "public"."service_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_notes" ADD CONSTRAINT "inquiry_notes_inquiry_id_contact_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."contact_inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_notes" ADD CONSTRAINT "inquiry_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_custom_role_id_custom_roles_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."custom_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_profiles_role_idx" ON "staff_profiles" USING btree ("staff_role");--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_categories_pair_idx" ON "attribute_categories" USING btree ("attribute_id","category_id");--> statement-breakpoint
CREATE INDEX "attribute_categories_category_idx" ON "attribute_categories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_options_attribute_slug_idx" ON "attribute_options" USING btree ("attribute_id","slug");--> statement-breakpoint
CREATE INDEX "attribute_options_attribute_idx" ON "attribute_options" USING btree ("attribute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attributes_slug_idx" ON "attributes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "filter_tags_slug_idx" ON "filter_tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attribute_values_pair_idx" ON "product_attribute_values" USING btree ("product_id","attribute_id");--> statement-breakpoint
CREATE INDEX "product_attribute_values_attribute_idx" ON "product_attribute_values" USING btree ("attribute_id");--> statement-breakpoint
CREATE INDEX "product_attribute_values_option_idx" ON "product_attribute_values" USING btree ("option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_filter_tags_pair_idx" ON "product_filter_tags" USING btree ("product_id","filter_tag_id");--> statement-breakpoint
CREATE INDEX "product_filter_tags_tag_idx" ON "product_filter_tags" USING btree ("filter_tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_reverses_idx" ON "inventory_movements" USING btree ("reverses_movement_id") WHERE "inventory_movements"."reverses_movement_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "inventory_movements_product_created_idx" ON "inventory_movements" USING btree ("product_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inventory_movements_created_idx" ON "inventory_movements" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inventory_movements_reason_idx" ON "inventory_movements" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "inventory_movements_performed_by_idx" ON "inventory_movements" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "inventory_movements_warehouse_idx" ON "inventory_movements" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_order_idx" ON "inventory_movements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "service_activity_ticket_idx" ON "service_activity_logs" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "homepage_sections_order_idx" ON "homepage_sections" USING btree ("display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_page_meta_page_key_idx" ON "seo_page_meta" USING btree ("page_key");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_redirects_from_idx" ON "seo_redirects" USING btree ("from_path");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_code_idx" ON "accounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "accounts_type_idx" ON "accounts" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "cod_settlements_number_idx" ON "cod_settlements" USING btree ("settlement_number");--> statement-breakpoint
CREATE INDEX "cod_settlements_driver_idx" ON "cod_settlements" USING btree ("driver_user_id");--> statement-breakpoint
CREATE INDEX "cod_settlements_settled_idx" ON "cod_settlements" USING btree ("settled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_name_idx" ON "expense_categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_number_idx" ON "journal_entries" USING btree ("entry_number");--> statement-breakpoint
CREATE INDEX "journal_entries_date_idx" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "journal_entries_source_idx" ON "journal_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_idx" ON "journal_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_account_idx" ON "journal_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "purchase_bill_items_bill_idx" ON "purchase_bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_bills_supplier_number_idx" ON "purchase_bills" USING btree ("supplier_id","bill_number");--> statement-breakpoint
CREATE INDEX "purchase_bills_status_idx" ON "purchase_bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_bills_due_date_idx" ON "purchase_bills" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "customer_activity_user_date_idx" ON "customer_activity_logs" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_product_preferences_user_product_idx" ON "customer_product_preferences" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_inquiries_number_idx" ON "contact_inquiries" USING btree ("inquiry_number");--> statement-breakpoint
CREATE INDEX "contact_inquiries_status_idx" ON "contact_inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_inquiries_created_idx" ON "contact_inquiries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inquiry_notes_inquiry_idx" ON "inquiry_notes" USING btree ("inquiry_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_roles_slug_idx" ON "custom_roles" USING btree ("role_slug");--> statement-breakpoint
CREATE INDEX "custom_roles_system_idx" ON "custom_roles" USING btree ("is_system");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_role_assignments_user_idx" ON "staff_role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "staff_role_assignments_role_idx" ON "staff_role_assignments" USING btree ("custom_role_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_codes" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "products_barcode_idx" ON "products" USING btree ("barcode") WHERE "products"."barcode" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "reviews_is_approved_idx" ON "reviews" USING btree ("is_approved");