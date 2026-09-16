// lib/seo/types.ts
//
// The shapes the SEO engine passes around, shared by the admin form, the route
// handler, the storefront hook, the sitemap and the robots builder.
//
// Framework-free on purpose: `components/admin/SeoModule.tsx` and
// `app/api/v1/seo/route.ts` both validate against the same field list, which is
// how the form is kept from offering a field the server drops.

export type SitemapFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export type ScopeColumn = 'region_exclusive' | 'nepal_nationwide';

/** One row of `seo_settings`, normalised — nulls collapsed to empty strings. */
export interface SeoSettings {
  siteName: string;
  canonicalBaseUrl: string;
  titleSuffix: string;
  defaultMetaTitle: string;
  defaultMetaDescription: string;
  /** Comma-separated: the admin form is a single input. */
  defaultKeywords: string;
  ogImageUrl: string;
  twitterHandle: string;
  ogLocale: string;

  activeScope: ScopeColumn;
  regionBannerMessage: string;
  regionBannerEnabled: boolean;
  extraAreasServed: string;

  structuredDataEnabled: boolean;
  localBusinessType: string;
  priceRange: string;
  geoLatitude: number | null;
  geoLongitude: number | null;

  robotsIndexingEnabled: boolean;
  robotsExtraDisallow: string;
  sitemapIncludeProducts: boolean;
  sitemapIncludeCategories: boolean;
  sitemapIncludePages: boolean;
  sitemapDefaultFrequency: SitemapFrequency;

  googleSiteVerification: string;
  bingSiteVerification: string;
  googleAnalyticsId: string;
  facebookPixelId: string;
}

/** One row of `seo_page_meta`. */
export interface SeoPageMeta {
  pageKey: string;
  label: string;
  path: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  ogImageUrl: string;
  noIndex: boolean;
  includeInSitemap: boolean;
  sitemapPriority: number;
  sitemapFrequency: SitemapFrequency;
  displayOrder: number;
}

/** What `GET /api/v1/seo` returns and the storefront caches. */
export interface SeoBundle {
  settings: SeoSettings;
  pages: SeoPageMeta[];
  /** True when the row came from the database rather than the code defaults. */
  persisted: boolean;
}

/** Product-level overrides, edited in the "Product SEO Matrix" tab. */
export interface ProductSeoRow {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

export const SITEMAP_FREQUENCIES: SitemapFrequency[] = [
  'always',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'never',
];

/** `'a, b , ,c'` → `['a','b','c']`. */
export const splitKeywords = (value: string | null | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

/** De-duplicated, order-preserving join back to the stored form. */
export const joinKeywords = (values: string[]): string =>
  Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).join(', ');

/**
 * The head tags for one rendered page — the output of `resolveSeo`, and the
 * override shape a view can push through `SeoContext`.
 *
 * Lives here rather than in `hooks/useSeoMeta.ts` so the resolver, the sitemap
 * and `generateMetadata` can all use it without importing a client hook.
 */
export interface SeoConfig {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  keywords?: string[];
  noIndex?: boolean;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
  /** Populated by the resolver: `og:locale`, verification tags, analytics ids. */
  locale?: string;
  twitterHandle?: string;
  googleSiteVerification?: string;
  bingSiteVerification?: string;
}

