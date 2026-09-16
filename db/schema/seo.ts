import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  numeric,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { regionalScopeEnum, sitemapFrequencyEnum } from './enums';

// db/schema/seo.ts
//
// Search-engine metadata the admin console owns.
//
// Before this, every title and description lived in `hooks/useSeoMeta.ts` as a
// string literal, so changing a meta description meant a code deploy — and the
// literals had drifted (Dhangadhi geo coordinates on a Dhangadhi shop, "Bagmati
// Tech Store" keywords). Three tables:
//
//   seo_settings    one row: site-wide defaults, regional scope, verification
//   seo_page_meta   one row per storefront route, overriding the defaults
//   seo_redirects   301/302 map, so a renamed slug does not become a 404
//
// Per-product and per-page overrides already exist on `products.meta_title` and
// `pages.meta_title`; this schema deliberately does not duplicate them.

/** Single-row table — read the one row, `id = 1` after the migration seeds it. */
export const seoSettings = pgTable('seo_settings', {
  id: serial('id').primaryKey(),

  // ---- global metadata ---------------------------------------------------
  siteName: varchar('site_name', { length: 150 }).notNull().default('Intel Computer Center'),
  canonicalBaseUrl: varchar('canonical_base_url', { length: 300 })
    .notNull()
    .default('https://www.intelcomputer.com.np'),
  /** Appended to every page title that does not set its own. */
  titleSuffix: varchar('title_suffix', { length: 200 }),
  defaultMetaTitle: varchar('default_meta_title', { length: 200 }),
  defaultMetaDescription: varchar('default_meta_description', { length: 500 }),
  /** Comma-separated: the admin form is a single text input. */
  defaultKeywords: text('default_keywords'),
  ogImageUrl: varchar('og_image_url', { length: 500 }),
  twitterHandle: varchar('twitter_handle', { length: 60 }),
  ogLocale: varchar('og_locale', { length: 12 }).notNull().default('en_NP'),

  // ---- regional targeting ------------------------------------------------
  /**
   * Mirrors `SUDURPASHCHIM_CONFIG.activeScope`. The code default stays the
   * fallback; this column lets the owner flip to nationwide without a deploy.
   */
  activeScope: regionalScopeEnum('active_scope').notNull().default('region_exclusive'),
  regionBannerMessage: varchar('region_banner_message', { length: 300 }),
  regionBannerEnabled: boolean('region_banner_enabled').notNull().default(true),
  /** Extra `areaServed` entries beyond the hubs in `config/regional.ts`. */
  extraAreasServed: text('extra_areas_served'),

  // ---- structured data ---------------------------------------------------
  structuredDataEnabled: boolean('structured_data_enabled').notNull().default(true),
  /** schema.org type: ComputerStore, ElectronicsStore, LocalBusiness, Store. */
  localBusinessType: varchar('local_business_type', { length: 60 })
    .notNull()
    .default('ComputerStore'),
  priceRange: varchar('price_range', { length: 60 }).notNull().default('NPR 500 - NPR 500,000'),
  geoLatitude: numeric('geo_latitude', { precision: 9, scale: 6 }),
  geoLongitude: numeric('geo_longitude', { precision: 9, scale: 6 }),

  // ---- indexing ----------------------------------------------------------
  robotsIndexingEnabled: boolean('robots_indexing_enabled').notNull().default(true),
  robotsExtraDisallow: text('robots_extra_disallow'),
  sitemapIncludeProducts: boolean('sitemap_include_products').notNull().default(true),
  sitemapIncludeCategories: boolean('sitemap_include_categories').notNull().default(true),
  sitemapIncludePages: boolean('sitemap_include_pages').notNull().default(true),
  sitemapDefaultFrequency: sitemapFrequencyEnum('sitemap_default_frequency')
    .notNull()
    .default('daily'),

  // ---- verification / analytics -----------------------------------------
  googleSiteVerification: varchar('google_site_verification', { length: 200 }),
  bingSiteVerification: varchar('bing_site_verification', { length: 200 }),
  googleAnalyticsId: varchar('google_analytics_id', { length: 100 }),
  facebookPixelId: varchar('facebook_pixel_id', { length: 100 }),

  /** Room for future toggles without a migration per checkbox. */
  configuration: jsonb('configuration').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: varchar('updated_by', { length: 150 }),
});

/**
 * Per-route overrides.
 *
 * `pageKey` matches the `currentPage` value the storefront router uses
 * ('home', 'shop', 'services', …) so the client can look its own row up without
 * a path-matching pass. `path` is what the sitemap emits.
 */
export const seoPageMeta = pgTable(
  'seo_page_meta',
  {
    id: serial('id').primaryKey(),
    pageKey: varchar('page_key', { length: 60 }).notNull(),
    label: varchar('label', { length: 120 }).notNull(),
    path: varchar('path', { length: 300 }).notNull(),
    metaTitle: varchar('meta_title', { length: 200 }),
    metaDescription: varchar('meta_description', { length: 500 }),
    keywords: text('keywords'),
    ogImageUrl: varchar('og_image_url', { length: 500 }),
    /** Overrides the auto-generated JSON-LD for this route when set. */
    jsonLdOverride: jsonb('json_ld_override'),
    noIndex: boolean('no_index').notNull().default(false),
    includeInSitemap: boolean('include_in_sitemap').notNull().default(true),
    sitemapPriority: numeric('sitemap_priority', { precision: 2, scale: 1 })
      .notNull()
      .default('0.8'),
    sitemapFrequency: sitemapFrequencyEnum('sitemap_frequency').notNull().default('weekly'),
    displayOrder: integer('display_order').notNull().default(0),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    pageKeyIdx: uniqueIndex('seo_page_meta_page_key_idx').on(t.pageKey),
  }),
);

/** Slug changes that would otherwise 404 and lose the ranking. */
export const seoRedirects = pgTable(
  'seo_redirects',
  {
    id: serial('id').primaryKey(),
    fromPath: varchar('from_path', { length: 300 }).notNull(),
    toPath: varchar('to_path', { length: 300 }).notNull(),
    statusCode: integer('status_code').notNull().default(301),
    isActive: boolean('is_active').notNull().default(true),
    hitCount: integer('hit_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    fromIdx: uniqueIndex('seo_redirects_from_idx').on(t.fromPath),
  }),
);
