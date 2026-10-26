CREATE TYPE "public"."attribute_data_type" AS ENUM('text', 'number', 'boolean', 'select');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."delivery_partner_type" AS ENUM('in_house', 'courier');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_reason" AS ENUM('sale', 'sale_cancelled', 'supplier_restock', 'customer_return', 'damaged', 'stolen', 'expired', 'internal_use', 'audit_correction', 'initial_stock');--> statement-breakpoint
CREATE TYPE "public"."notification_event" AS ENUM('low_stock', 'new_order', 'service_ticket', 'weekly_summary');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cod', 'esewa', 'khalti', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'inactive', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."province" AS ENUM('koshi', 'madhesh', 'bagmati', 'gandaki', 'lumbini', 'karnali', 'sudurpashchim');--> statement-breakpoint
CREATE TYPE "public"."regional_scope" AS ENUM('region_exclusive', 'nepal_nationwide');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('ON_DUTY', 'ON_TRANSIT', 'OFF_DUTY');--> statement-breakpoint
CREATE TYPE "public"."sitemap_frequency" AS ENUM('always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('SUPER_ADMIN', 'STORE_MANAGER', 'SALES_AGENT', 'SERVICE_TECHNICIAN', 'DELIVERY_DRIVER');--> statement-breakpoint
CREATE TYPE "public"."stock_status" AS ENUM('in_stock', 'low_stock', 'out_of_stock', 'pre_order', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'assigned', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."ticket_type" AS ENUM('repair', 'cctv_survey', 'installation', 'warranty_claim', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'admin', 'sales', 'inventory_manager', 'service_technician', 'delivery_driver');--> statement-breakpoint
CREATE TYPE "public"."pos_day_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."pos_shift_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."pos_staff_role" AS ENUM('cashier', 'senior_cashier', 'supervisor', 'store_manager', 'manager', 'inventory_manager', 'sales_manager', 'accountant', 'auditor', 'admin');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(50) DEFAULT 'Home',
	"full_name" varchar(150) NOT NULL,
	"phone" varchar(15) NOT NULL,
	"province" "province" NOT NULL,
	"district" varchar(100) NOT NULL,
	"municipality" varchar(150) NOT NULL,
	"ward_no" varchar(10) NOT NULL,
	"tole" varchar(255),
	"street_address" varchar(255),
	"house_number" varchar(50),
	"landmark" varchar(255),
	"postal_code" varchar(10),
	"delivery_instructions" text,
	"latitude" integer,
	"longitude" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
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
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"email" varchar(200) NOT NULL,
	"phone" varchar(15),
	"password_hash" varchar(255),
	"pos_pin" varchar(255),
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"avatar_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified_at" timestamp,
	"invited_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"logo_url" varchar(500),
	"description" text,
	"is_partner" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"category_slugs" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"description" text,
	"icon_name" varchar(60),
	"subcategories" jsonb,
	"parent_id" uuid,
	"image_url" varchar(500),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"alt_text" varchar(200),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"spec_key" varchar(60) NOT NULL,
	"spec_value" varchar(200) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_name" varchar(120) NOT NULL,
	"sku" varchar(60) NOT NULL,
	"price_adjustment" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(60) NOT NULL,
	"barcode" varchar(64),
	"name" varchar(200) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"brand_id" uuid,
	"category_id" uuid,
	"description" text,
	"short_description" varchar(500),
	"base_price" numeric(12, 2) NOT NULL,
	"compare_at_price" numeric(12, 2),
	"cost_price" numeric(12, 2),
	"warranty_months" integer DEFAULT 0,
	"warranty_type" varchar(60) DEFAULT 'official_np',
	"warranty_text" varchar(250),
	"subcategory" varchar(120),
	"release_date" date,
	"tags" jsonb,
	"features" jsonb,
	"whats_in_the_box" jsonb,
	"rating_average" numeric(2, 1) DEFAULT '0' NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_deal_of_day" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"is_new_arrival" boolean DEFAULT false NOT NULL,
	"is_best_seller" boolean DEFAULT false NOT NULL,
	"is_trending" boolean DEFAULT false NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"stock_status" "stock_status" DEFAULT 'in_stock' NOT NULL,
	"offer_enabled" boolean DEFAULT false NOT NULL,
	"offer_discount_type" "discount_type",
	"offer_discount_value" numeric(12, 2),
	"offer_max_discount_amount" numeric(12, 2),
	"offer_starts_at" timestamp,
	"offer_ends_at" timestamp,
	"offer_is_flash_sale" boolean DEFAULT false NOT NULL,
	"offer_stackable" boolean DEFAULT false NOT NULL,
	"meta_title" varchar(200),
	"meta_description" varchar(500),
	"is_physical_product" boolean DEFAULT true NOT NULL,
	"requires_shipping" boolean DEFAULT true NOT NULL,
	"weight_kg" numeric(8, 3),
	"length_cm" numeric(8, 2),
	"width_cm" numeric(8, 2),
	"height_cm" numeric(8, 2),
	"is_free_shipping" boolean DEFAULT false NOT NULL,
	"fixed_shipping_fee" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribute_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribute_id" uuid NOT NULL,
	"category_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribute_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"option_id" uuid,
	"value_text" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "product_filter_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"filter_tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"warehouse_id" uuid NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 3 NOT NULL,
	"reorder_point" integer DEFAULT 10 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"warehouse_id" uuid,
	"product_name_snapshot" varchar(200) NOT NULL,
	"sku_snapshot" varchar(60) NOT NULL,
	"quantity_delta" integer NOT NULL,
	"quantity_after" integer NOT NULL,
	"reason" "inventory_movement_reason" NOT NULL,
	"unit_cost_snapshot" numeric(12, 2),
	"note" varchar(500),
	"reference_no" varchar(60),
	"order_id" uuid,
	"expense_id" uuid,
	"reverses_movement_id" uuid,
	"performed_by" uuid,
	"performed_by_name" varchar(150),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"province" "province",
	"district" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"min_order_value" numeric(12, 2) DEFAULT '0',
	"max_discount_amount" numeric(12, 2),
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_at_add" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" "delivery_partner_type" DEFAULT 'in_house' NOT NULL,
	"contact_phone" varchar(15),
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"provinces" varchar(300),
	"districts" varchar(500),
	"municipalities" varchar(1000),
	"flat_fee" numeric(10, 2) NOT NULL,
	"estimated_days" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"product_name_snapshot" varchar(200) NOT NULL,
	"sku_snapshot" varchar(60) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"unit_cost_snapshot" numeric(12, 2)
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "order_status" NOT NULL,
	"note" varchar(300),
	"changed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(30) NOT NULL,
	"user_id" uuid,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"delivery_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"coupon_id" uuid,
	"total_amount" numeric(12, 2) NOT NULL,
	"shipping_address_id" uuid,
	"shipping_address_snapshot" jsonb,
	"delivery_zone_id" uuid,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"customer_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"provider_transaction_id" varchar(150),
	"amount" numeric(12, 2) NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"raw_response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"delivery_partner_id" uuid,
	"rider_name" varchar(120),
	"tracking_code" varchar(80),
	"dispatched_at" timestamp,
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "service_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"activity_type" varchar(40) NOT NULL,
	"message" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" varchar(30) NOT NULL,
	"customer_id" uuid,
	"type" "ticket_type" NOT NULL,
	"channel" varchar(20) DEFAULT 'OFFLINE_WALKIN' NOT NULL,
	"workflow_status" varchar(30) DEFAULT 'PENDING_INSPECTION' NOT NULL,
	"subject" varchar(200) NOT NULL,
	"description" text,
	"device_brand" varchar(100),
	"device_model" varchar(150),
	"serial_number" varchar(120),
	"condition_checklist" jsonb,
	"lock_code" varchar(120),
	"preferred_date" timestamp,
	"preferred_time" varchar(80),
	"service_address" varchar(500),
	"advance_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"product_id" uuid,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"assigned_to" uuid,
	"charged_amount" numeric(12, 2),
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"rating" integer NOT NULL,
	"title" varchar(150),
	"comment" text,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"user_city" varchar(120),
	"hardware_setup" varchar(300),
	"component_aspect" varchar(60),
	"component_ratings" jsonb,
	"pros" jsonb,
	"cons" jsonb,
	"is_approved" boolean DEFAULT false NOT NULL,
	"is_verified_purchase" boolean DEFAULT false NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"admin_response" text,
	"admin_response_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_bar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" varchar(300) NOT NULL,
	"background_color" varchar(20) DEFAULT '#1B3A8C',
	"is_enabled" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "hero_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"eyebrow_text" varchar(120),
	"subtitle" varchar(400),
	"cta_label" varchar(60) DEFAULT 'Shop Now',
	"cta_url" varchar(300),
	"desktop_image_url" varchar(500),
	"mobile_image_url" varchar(500),
	"badge_text" varchar(30),
	"featured_product_id" uuid,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_type" varchar(40) NOT NULL,
	"title" varchar(150),
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation_menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(80) NOT NULL,
	"url" varchar(300),
	"page_id" uuid,
	"parent_id" uuid,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"content" jsonb,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"meta_title" varchar(200),
	"meta_description" varchar(500),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_content_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "notification_event" NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_method_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"method" "payment_method" NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"merchant_id" varchar(150),
	"secret_key_encrypted" varchar(500),
	"config" jsonb
);
--> statement-breakpoint
CREATE TABLE "store_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_name" varchar(150) DEFAULT 'Intel Computer Center' NOT NULL,
	"tagline" varchar(300),
	"contact_email" varchar(200),
	"contact_phone" varchar(15),
	"legal_name" varchar(200),
	"pan_vat_number" varchar(20),
	"logo_url" varchar(500),
	"dark_logo_url" varchar(500),
	"favicon_url" varchar(500),
	"invoice_logo_url" varchar(500),
	"address" varchar(500),
	"opening_hours" varchar(200),
	"announcement_text" varchar(300),
	"announcement_enabled" boolean DEFAULT true NOT NULL,
	"province" "province",
	"district" varchar(100),
	"municipality" varchar(150),
	"ward_no" varchar(10),
	"currency" varchar(10) DEFAULT 'NPR' NOT NULL,
	"vat_rate_percent" numeric(5, 2) DEFAULT '13.00' NOT NULL,
	"prices_include_vat" boolean DEFAULT true NOT NULL,
	"multi_currency_enabled" boolean DEFAULT false NOT NULL,
	"calendar" varchar(3) DEFAULT 'AD' NOT NULL,
	"guest_checkout_enabled" boolean DEFAULT true NOT NULL,
	"minimum_order_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"stock_lock_minutes" numeric(6, 0) DEFAULT '15' NOT NULL,
	"unpaid_order_cancel_minutes" numeric(6, 0) DEFAULT '30' NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"free_delivery_threshold" numeric(12, 2) DEFAULT '50000.00' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_page_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_path" varchar(300) NOT NULL,
	"to_path" varchar(300) NOT NULL,
	"status_code" integer DEFAULT 301 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(160) NOT NULL,
	"type" varchar(20) NOT NULL,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cod_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_number" varchar(40) DEFAULT 'COD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('cod_settlement_number_seq')::text, 6, '0') NOT NULL,
	"driver_user_id" uuid,
	"driver_name" varchar(150) NOT NULL,
	"order_reference" varchar(60),
	"collected_amount" numeric(14, 2) NOT NULL,
	"deposit_account_id" uuid NOT NULL,
	"bank_reference" varchar(80),
	"attachment_url" varchar(500),
	"journal_entry_id" uuid NOT NULL,
	"notes" text,
	"settled_by" uuid,
	"settled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(300),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"supplier_id" uuid,
	"description" varchar(300) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"expense_date" date NOT NULL,
	"payment_method" varchar(40) DEFAULT 'cash' NOT NULL,
	"reference_no" varchar(60),
	"recorded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" varchar(40) NOT NULL,
	"entry_date" date NOT NULL,
	"description" varchar(300) NOT NULL,
	"source_type" varchar(40),
	"source_id" varchar(64),
	"attachment_url" varchar(500),
	"posted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"description" varchar(300),
	"debit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(14, 2) DEFAULT '0' NOT NULL
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
CREATE TABLE "purchase_bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"product_id" uuid,
	"description" varchar(300) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"bill_number" varchar(60) NOT NULL,
	"bill_date" date NOT NULL,
	"due_date" date,
	"subtotal" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" varchar(20) DEFAULT 'unpaid' NOT NULL,
	"notes" text,
	"recorded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" varchar(64),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"delivery_partner_id" uuid,
	"status" varchar(30) DEFAULT 'assigned' NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"picked_up_at" timestamp,
	"in_transit_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"failure_reason" varchar(300),
	"proof_of_delivery" jsonb,
	"delivery_notes" varchar(500),
	"estimated_arrival" timestamp,
	"distance_km" numeric(8, 2),
	"route_polyline" varchar(5000),
	"stop_sequence" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "driver_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy" numeric(8, 2),
	"speed" numeric(6, 2),
	"heading" numeric(6, 2),
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_product_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"preference" varchar(12) NOT NULL,
	"affinity_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_number" varchar(30) DEFAULT 'INQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('contact_inquiry_number_seq')::text, 6, '0') NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"phone" varchar(15) NOT NULL,
	"email" varchar(200),
	"subject" varchar(120) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'UNREAD' NOT NULL,
	"assigned_staff_id" uuid,
	"converted_service_id" uuid,
	"converted_lead_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiry_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_number" varchar(30) NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"phone" varchar(15) NOT NULL,
	"email" varchar(200),
	"request" text NOT NULL,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_name" varchar(80) NOT NULL,
	"role_slug" varchar(60) NOT NULL,
	"description" text,
	"icon" varchar(16) DEFAULT '🛡️' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"custom_role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(50) DEFAULT 'info' NOT NULL,
	"related_order_id" uuid,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(15) NOT NULL,
	"code" varchar(6) NOT NULL,
	"purpose" varchar(30) DEFAULT 'phone_verify' NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_specs" ADD CONSTRAINT "product_specs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_categories" ADD CONSTRAINT "attribute_categories_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_categories" ADD CONSTRAINT "attribute_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_option_id_attribute_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."attribute_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filter_tags" ADD CONSTRAINT "product_filter_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filter_tags" ADD CONSTRAINT "product_filter_tags_filter_tag_id_filter_tags_id_fk" FOREIGN KEY ("filter_tag_id") REFERENCES "public"."filter_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reverses_movement_id_inventory_movements_id_fk" FOREIGN KEY ("reverses_movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_address_id_addresses_id_fk" FOREIGN KEY ("shipping_address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_zone_id_delivery_zones_id_fk" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_delivery_partner_id_delivery_partners_id_fk" FOREIGN KEY ("delivery_partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_activity_logs" ADD CONSTRAINT "service_activity_logs_ticket_id_service_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."service_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_activity_logs" ADD CONSTRAINT "service_activity_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_featured_product_id_products_id_fk" FOREIGN KEY ("featured_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_menu_items" ADD CONSTRAINT "navigation_menu_items_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_menu_items" ADD CONSTRAINT "navigation_menu_items_parent_id_navigation_menu_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."navigation_menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_settlements" ADD CONSTRAINT "cod_settlements_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_settlements" ADD CONSTRAINT "cod_settlements_deposit_account_id_accounts_id_fk" FOREIGN KEY ("deposit_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_settlements" ADD CONSTRAINT "cod_settlements_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_settlements" ADD CONSTRAINT "cod_settlements_settled_by_users_id_fk" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_note_items" ADD CONSTRAINT "goods_receipt_note_items_grn_id_goods_receipt_notes_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."goods_receipt_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_note_items" ADD CONSTRAINT "goods_receipt_note_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_note_items" ADD CONSTRAINT "goods_receipt_note_items_po_item_id_purchase_order_items_id_fk" FOREIGN KEY ("po_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_storekeeper_id_users_id_fk" FOREIGN KEY ("storekeeper_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_purchase_bill_id_purchase_bills_id_fk" FOREIGN KEY ("purchase_bill_id") REFERENCES "public"."purchase_bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_approvals" ADD CONSTRAINT "po_approvals_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_approvals" ADD CONSTRAINT "po_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_attachments" ADD CONSTRAINT "po_attachments_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_communications" ADD CONSTRAINT "po_communications_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_bill_id_purchase_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."purchase_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_revisions" ADD CONSTRAINT "purchase_order_revisions_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_revisions" ADD CONSTRAINT "purchase_order_revisions_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_terms" ADD CONSTRAINT "supplier_terms_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_routes" ADD CONSTRAINT "delivery_routes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_routes" ADD CONSTRAINT "delivery_routes_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_routes" ADD CONSTRAINT "delivery_routes_delivery_partner_id_delivery_partners_id_fk" FOREIGN KEY ("delivery_partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "staff_profiles_role_idx" ON "staff_profiles" USING btree ("staff_role");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_specs_product_idx" ON "product_specs" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_idx" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_idx" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "products_barcode_idx" ON "products" USING btree ("barcode") WHERE "products"."barcode" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
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
CREATE UNIQUE INDEX "inventory_product_warehouse_idx" ON "inventory" USING btree ("product_id","variant_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_low_stock_idx" ON "inventory" USING btree ("quantity_on_hand");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_reverses_idx" ON "inventory_movements" USING btree ("reverses_movement_id") WHERE "inventory_movements"."reverses_movement_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "inventory_movements_product_created_idx" ON "inventory_movements" USING btree ("product_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inventory_movements_created_idx" ON "inventory_movements" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inventory_movements_reason_idx" ON "inventory_movements" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "inventory_movements_performed_by_idx" ON "inventory_movements" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "inventory_movements_warehouse_idx" ON "inventory_movements" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_order_idx" ON "inventory_movements" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_idx" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "cart_items_cart_idx" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "carts_user_idx" ON "carts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "carts_session_idx" ON "carts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "wishlists_user_product_idx" ON "wishlists" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_status_history_order_idx" ON "order_status_history" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_order_idx" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "service_activity_ticket_idx" ON "service_activity_logs" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "service_tickets_ticket_number_idx" ON "service_tickets" USING btree ("ticket_number");--> statement-breakpoint
CREATE INDEX "service_tickets_status_idx" ON "service_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_tickets_assigned_idx" ON "service_tickets" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "reviews_product_idx" ON "reviews" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "reviews_is_approved_idx" ON "reviews" USING btree ("is_approved");--> statement-breakpoint
CREATE INDEX "homepage_sections_order_idx" ON "homepage_sections" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_event_idx" ON "notification_preferences" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_method_settings_method_idx" ON "payment_method_settings" USING btree ("method");--> statement-breakpoint
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
CREATE INDEX "goods_receipt_note_items_grn_idx" ON "goods_receipt_note_items" USING btree ("grn_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_notes_number_idx" ON "goods_receipt_notes" USING btree ("grn_number");--> statement-breakpoint
CREATE INDEX "goods_receipt_notes_po_idx" ON "goods_receipt_notes" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_notes_supplier_idx" ON "goods_receipt_notes" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_notes_status_idx" ON "goods_receipt_notes" USING btree ("financial_status");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_number_idx" ON "journal_entries" USING btree ("entry_number");--> statement-breakpoint
CREATE INDEX "journal_entries_date_idx" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "journal_entries_source_idx" ON "journal_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_idx" ON "journal_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_account_idx" ON "journal_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "po_approvals_poid_idx" ON "po_approvals" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "po_attachments_poid_idx" ON "po_attachments" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "po_comm_poid_idx" ON "po_communications" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_bill_items_bill_idx" ON "purchase_bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_bills_supplier_number_idx" ON "purchase_bills" USING btree ("supplier_id","bill_number");--> statement-breakpoint
CREATE INDEX "purchase_bills_status_idx" ON "purchase_bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_bills_due_date_idx" ON "purchase_bills" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "purchase_order_items_po_idx" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "po_revisions_poid_idx" ON "purchase_order_revisions" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_number_idx" ON "purchase_orders" USING btree ("po_number");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "delivery_routes_order_idx" ON "delivery_routes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "delivery_routes_driver_idx" ON "delivery_routes" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "delivery_routes_status_idx" ON "delivery_routes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "driver_locations_driver_idx" ON "driver_locations" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "driver_locations_timestamp_idx" ON "driver_locations" USING btree ("timestamp");--> statement-breakpoint
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