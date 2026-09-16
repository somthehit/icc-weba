-- 0023_seo_regional_engine.sql
--
-- The SEO engine and the Sudurpashchim regional scope.
--
-- Everything search engines read used to be string literals in
-- `hooks/useSeoMeta.ts`, which meant (a) no way to fix a meta description without
-- a deploy and (b) the literals had already drifted from reality — Dhangadhi geo
-- coordinates and "Bagmati Tech Store" keywords on a shop that trades out of
-- Dhangadhi. These three tables move that copy into the admin console.
--
-- Also re-seeds `delivery_zones`: the previous rows described Dhangadhi Valley,
-- Dhangadhi, Butwal and Biratnagar, none of which this warehouse ships to. The
-- replacement is the nine districts of Sudurpashchim Province, which is the
-- footprint `config/regional.ts` declares.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "regional_scope" AS ENUM ('region_exclusive', 'nepal_nationwide');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "sitemap_frequency" AS ENUM ('always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- seo_settings — single row of site-wide defaults
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "seo_settings" (
  "id"                        serial PRIMARY KEY,
  "site_name"                 varchar(150) DEFAULT 'Intel Computer Center' NOT NULL,
  "canonical_base_url"        varchar(300) DEFAULT 'https://www.intelcomputer.com.np' NOT NULL,
  "title_suffix"              varchar(200),
  "default_meta_title"        varchar(200),
  "default_meta_description"  varchar(500),
  "default_keywords"          text,
  "og_image_url"              varchar(500),
  "twitter_handle"            varchar(60),
  "og_locale"                 varchar(12) DEFAULT 'en_NP' NOT NULL,
  "active_scope"              "regional_scope" DEFAULT 'region_exclusive' NOT NULL,
  "region_banner_message"     varchar(300),
  "region_banner_enabled"     boolean DEFAULT true NOT NULL,
  "extra_areas_served"        text,
  "structured_data_enabled"   boolean DEFAULT true NOT NULL,
  "local_business_type"       varchar(60) DEFAULT 'ComputerStore' NOT NULL,
  "price_range"               varchar(60) DEFAULT 'NPR 500 - NPR 500,000' NOT NULL,
  "geo_latitude"              numeric(9, 6),
  "geo_longitude"             numeric(9, 6),
  "robots_indexing_enabled"   boolean DEFAULT true NOT NULL,
  "robots_extra_disallow"     text,
  "sitemap_include_products"  boolean DEFAULT true NOT NULL,
  "sitemap_include_categories" boolean DEFAULT true NOT NULL,
  "sitemap_include_pages"     boolean DEFAULT true NOT NULL,
  "sitemap_default_frequency" "sitemap_frequency" DEFAULT 'daily' NOT NULL,
  "google_site_verification"  varchar(200),
  "bing_site_verification"    varchar(200),
  "google_analytics_id"       varchar(100),
  "facebook_pixel_id"         varchar(100),
  "configuration"             jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at"                timestamp DEFAULT now() NOT NULL,
  "updated_by"                varchar(150)
);

-- ---------------------------------------------------------------------------
-- seo_page_meta — one row per storefront route
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "seo_page_meta" (
  "id"                 serial PRIMARY KEY,
  "page_key"           varchar(60) NOT NULL,
  "label"              varchar(120) NOT NULL,
  "path"               varchar(300) NOT NULL,
  "meta_title"         varchar(200),
  "meta_description"   varchar(500),
  "keywords"           text,
  "og_image_url"       varchar(500),
  "json_ld_override"   jsonb,
  "no_index"           boolean DEFAULT false NOT NULL,
  "include_in_sitemap" boolean DEFAULT true NOT NULL,
  "sitemap_priority"   numeric(2, 1) DEFAULT '0.8' NOT NULL,
  "sitemap_frequency"  "sitemap_frequency" DEFAULT 'weekly' NOT NULL,
  "display_order"      integer DEFAULT 0 NOT NULL,
  "updated_at"         timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "seo_page_meta_page_key_idx" ON "seo_page_meta" ("page_key");

-- ---------------------------------------------------------------------------
-- seo_redirects — keep the ranking when a slug changes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "seo_redirects" (
  "id"          serial PRIMARY KEY,
  "from_path"   varchar(300) NOT NULL,
  "to_path"     varchar(300) NOT NULL,
  "status_code" integer DEFAULT 301 NOT NULL,
  "is_active"   boolean DEFAULT true NOT NULL,
  "hit_count"   integer DEFAULT 0 NOT NULL,
  "created_at"  timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "seo_redirects_from_idx" ON "seo_redirects" ("from_path");

-- ---------------------------------------------------------------------------
-- default row — the values the storefront falls back to before anyone edits
-- ---------------------------------------------------------------------------
INSERT INTO "seo_settings" (
  "site_name", "canonical_base_url", "title_suffix",
  "default_meta_title", "default_meta_description", "default_keywords",
  "og_image_url", "active_scope", "region_banner_message",
  "local_business_type", "price_range", "geo_latitude", "geo_longitude"
)
SELECT
  'Intel Computer Center',
  'https://www.intelcomputer.com.np',
  '| Best Electronics & Tech Store in Sudurpashchim (Dhangadhi & Mahendranagar)',
  'Best Laptop & Tech Store in Dhangadhi, Kailali | Sudurpashchim Express',
  'Buy genuine laptops, mobile accessories, and computer parts in Sudurpashchim. Fast same-day COD delivery in Dhangadhi, Mahendranagar, Attariya & Tikapur.',
  'laptop store dhangadhi, computer shop mahendranagar, tech store kailali, sudurpashchim electronics, online shopping dhangadhi, cctv installation dhangadhi, printer repair kailali',
  'https://picsum.photos/seed/intel-computer-store/1200/630',
  'region_exclusive',
  '🚚 Fast Express Delivery Across All 9 Districts of Sudurpashchim Province! (Nepal-wide delivery coming soon)',
  'ComputerStore',
  'NPR 500 - NPR 500,000',
  28.695400,
  80.606000
WHERE NOT EXISTS (SELECT 1 FROM "seo_settings");

-- ---------------------------------------------------------------------------
-- route rows — `page_key` matches the storefront router's `currentPage`
-- ---------------------------------------------------------------------------
INSERT INTO "seo_page_meta"
  ("page_key", "label", "path", "meta_title", "meta_description", "keywords", "no_index", "include_in_sitemap", "sitemap_priority", "sitemap_frequency", "display_order")
VALUES
  ('home', 'Homepage', '/',
   'Intel Computer Center | Laptops, CCTV & Tech Store in Dhangadhi',
   'Shop genuine laptops, gaming PCs, GPUs, monitors, CCTV cameras and printers in Dhangadhi, Kailali. Official warranty, COD and express delivery across all 9 districts of Sudurpashchim.',
   'computer shop dhangadhi, laptop price dhangadhi, electronics store sudurpashchim', false, true, '1.0', 'daily', 1),
  ('shop', 'Shop / Catalogue', '/shop',
   'Shop Computers, Laptops & Tech Gear | Dhangadhi, Sudurpashchim',
   'Browse Dell, Lenovo, ASUS and HP laptops, GPUs, monitors, Hikvision CCTV kits, Canon printers and networking gear with delivery across Kailali, Kanchanpur and Dadeldhura.',
   'laptop shop kailali, gpu price nepal, cctv kit dhangadhi', false, true, '0.9', 'daily', 2),
  ('services', 'Repair & Services', '/services',
   'Laptop Repair, CCTV Installation & IT Servicing in Dhangadhi',
   'Chip-level laptop repair, desktop maintenance, CCTV surveillance installation and network setup across Dhangadhi, Attariya, Tikapur and Mahendranagar.',
   'laptop repair dhangadhi, cctv installation kailali, printer repair mahendranagar', false, true, '0.8', 'weekly', 3),
  ('brands', 'Brands', '/brands',
   'Official Authorized Tech Brands in Sudurpashchim | Intel Computer Center',
   'Genuine products with manufacturer warranty from Dell, Lenovo, ASUS, Hikvision, Canon, Brother, MSI and HP — stocked in Dhangadhi.',
   'dell dealer dhangadhi, hikvision dealer sudurpashchim', false, true, '0.7', 'weekly', 4),
  ('about', 'About & Contact', '/about',
   'About Us & Store Location in Dhangadhi | Intel Computer Center',
   'Visit our showroom at Main Road, Near Campus Chowk, Dhangadhi. Call +977-91-521890 for sales, service and corporate IT procurement across Sudurpashchim.',
   'computer store near me dhangadhi, intel computer center contact', false, true, '0.7', 'monthly', 5),
  ('faq', 'FAQ & Support', '/faq',
   'Delivery, Warranty & Payment FAQs | Intel Computer Center Dhangadhi',
   'Answers on Sudurpashchim delivery times, Cash on Delivery districts, warranty claims, eSewa/Khalti payment and repair turnaround.',
   'cod delivery sudurpashchim, warranty claim dhangadhi', false, true, '0.6', 'monthly', 6),
  ('track-order', 'Order Tracking', '/track-order',
   'Track Your Order | Intel Computer Center Sudurpashchim',
   'Enter your order number or phone to see live rider status for deliveries across Kailali, Kanchanpur and the wider Sudurpashchim Province.',
   'track order dhangadhi', false, true, '0.5', 'weekly', 7),
  ('compare', 'Product Comparison', '/compare',
   'Compare Laptop & Component Specs and Prices | Dhangadhi',
   'Side-by-side technical specification and price comparison for laptops, GPUs, monitors and electronics available in Sudurpashchim.',
   'laptop comparison nepal', false, true, '0.5', 'weekly', 8),
  ('cart', 'Cart', '/cart', 'Your Shopping Cart | Intel Computer Center', 'Review your cart, check the free-delivery threshold for your district, and continue to checkout.', NULL, true, false, '0.1', 'never', 9),
  ('checkout', 'Checkout', '/checkout', 'Secure Checkout | Intel Computer Center', 'Pay with Cash on Delivery, eSewa, Khalti, Fonepay or bank transfer.', NULL, true, false, '0.1', 'never', 10),
  ('account', 'Customer Account', '/account', 'Your Account & Orders | Intel Computer Center', 'Manage your profile, orders, invoices and warranty claims.', NULL, true, false, '0.1', 'never', 11),
  ('wishlist', 'Wishlist', '/wishlist', 'Your Wishlist | Intel Computer Center', 'Saved products, ready when you are.', NULL, true, false, '0.1', 'never', 12),
  ('admin', 'Admin Console', '/admin', 'Admin Console | Intel Computer Center', 'Internal store operations panel.', NULL, true, false, '0.1', 'never', 13)
ON CONFLICT ("page_key") DO NOTHING;

-- ---------------------------------------------------------------------------
-- delivery_zones — replace the out-of-region rows with Sudurpashchim's nine
-- districts. Existing zones are deactivated rather than deleted: `orders` rows
-- may reference the fee that was charged, and a delete would rewrite history.
--
-- The two coverage columns are guarded here as well as in 0016. There is no
-- migration ledger on this database (it was bootstrapped with `drizzle-kit
-- push`), so files are applied by hand and 0016 may not have run — without the
-- guards this whole file rolls back on `column "districts" does not exist`.
-- ---------------------------------------------------------------------------
ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "districts" varchar(500);
ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "municipalities" varchar(1000);

INSERT INTO "delivery_zones" ("name", "provinces", "districts", "municipalities", "flat_fee", "estimated_days", "is_active")
SELECT * FROM (VALUES
  ('Kailali — Dhangadhi Express',  'sudurpashchim', 'Kailali',     'Dhangadhi,Attariya,Tikapur,Lamki,Sukkhad', 100.00, 1, true),
  ('Kanchanpur — Mahendranagar',   'sudurpashchim', 'Kanchanpur',  'Mahendranagar,Belauri,Jhalari',            150.00, 2, true),
  ('Dadeldhura',                   'sudurpashchim', 'Dadeldhura',  'Amargadhi,Gankhet',                        200.00, 2, true),
  ('Doti',                         'sudurpashchim', 'Doti',        'Sipakhati,Dipayal Silgadhi',               250.00, 3, true),
  ('Baitadi',                      'sudurpashchim', 'Baitadi',     'Dasharathchand,Patan',                     250.00, 3, true),
  ('Achham',                       'sudurpashchim', 'Achham',      'Mangalsen,Sanfebagar',                     250.00, 3, true),
  ('Bajhang',                      'sudurpashchim', 'Bajhang',     'Chainpur',                                 300.00, 4, true),
  ('Bajura',                       'sudurpashchim', 'Bajura',      'Martadi',                                  300.00, 4, true),
  ('Darchula',                     'sudurpashchim', 'Darchula',    'Khalanga',                                 300.00, 4, true)
) AS seed("name", "provinces", "districts", "municipalities", "flat_fee", "estimated_days", "is_active")
WHERE NOT EXISTS (
  SELECT 1 FROM "delivery_zones" dz WHERE dz."name" = seed."name"
);

-- Everything that is not one of the nine rows above is retired.
--
-- Deactivated rather than deleted: `orders` reference the zone whose fee was
-- charged, and deleting would rewrite what a past customer was billed.
--
-- The `districts IS NULL` case is the one that actually mattered: the legacy
-- "Dhangadhi Main City" zone covered `sudurpashchim` with no district list, and
-- `zoneCoversAddress` treats an empty district list as "matches every district".
-- Left active it shadowed all nine new zones and quoted NPR 200 for a Dhangadhi
-- run that now costs 100.
UPDATE "delivery_zones"
   SET "is_active" = false
 WHERE "name" NOT IN (
   'Kailali — Dhangadhi Express',
   'Kanchanpur — Mahendranagar',
   'Dadeldhura', 'Doti', 'Baitadi', 'Achham', 'Bajhang', 'Bajura', 'Darchula'
 );
