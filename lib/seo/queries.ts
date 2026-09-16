// lib/seo/queries.ts
//
// Reading the SEO tables. Server-only — imported by the route handler,
// `app/sitemap.ts`, `app/robots.ts` and `generateMetadata`.
//
// Every read degrades to `lib/seo/defaults.ts` instead of throwing. A missing
// `seo_settings` row (fresh database, migration not yet applied) must not take the
// storefront's `<head>` down with it, and `robots.txt` returning a 500 is worse
// than returning the default policy.

import 'server-only';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { asc } from 'drizzle-orm';

import { seoPageMeta, seoSettings } from '@/db/schema';
import { DEFAULT_PAGE_META, DEFAULT_SEO_SETTINGS } from './defaults';
import type { SeoBundle, SeoPageMeta, SeoSettings, SitemapFrequency } from './types';

/**
 * Cache tag for the SEO bundle.
 *
 * `PUT /api/v1/seo` calls `revalidateTag` with this after a successful write, so
 * the hourly TTL below is a backstop rather than the mechanism — an operator who
 * publishes a title sees it on the next request, not in an hour.
 */
export const SEO_CACHE_TAG = 'seo-bundle';

type SettingsRow = typeof seoSettings.$inferSelect;
type PageRow = typeof seoPageMeta.$inferSelect;

const str = (value: string | null | undefined, fallback = '') => value ?? fallback;

/** `numeric` columns come back as strings from node-postgres. */
const num = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function normalizeSettings(row: SettingsRow): SeoSettings {
  return {
    siteName: str(row.siteName, DEFAULT_SEO_SETTINGS.siteName),
    canonicalBaseUrl: str(row.canonicalBaseUrl, DEFAULT_SEO_SETTINGS.canonicalBaseUrl),
    titleSuffix: str(row.titleSuffix, DEFAULT_SEO_SETTINGS.titleSuffix),
    defaultMetaTitle: str(row.defaultMetaTitle, DEFAULT_SEO_SETTINGS.defaultMetaTitle),
    defaultMetaDescription: str(
      row.defaultMetaDescription,
      DEFAULT_SEO_SETTINGS.defaultMetaDescription,
    ),
    defaultKeywords: str(row.defaultKeywords, DEFAULT_SEO_SETTINGS.defaultKeywords),
    ogImageUrl: str(row.ogImageUrl, DEFAULT_SEO_SETTINGS.ogImageUrl),
    twitterHandle: str(row.twitterHandle),
    ogLocale: str(row.ogLocale, DEFAULT_SEO_SETTINGS.ogLocale),

    activeScope: row.activeScope,
    regionBannerMessage: str(row.regionBannerMessage, DEFAULT_SEO_SETTINGS.regionBannerMessage),
    regionBannerEnabled: row.regionBannerEnabled,
    extraAreasServed: str(row.extraAreasServed),

    structuredDataEnabled: row.structuredDataEnabled,
    localBusinessType: str(row.localBusinessType, DEFAULT_SEO_SETTINGS.localBusinessType),
    priceRange: str(row.priceRange, DEFAULT_SEO_SETTINGS.priceRange),
    geoLatitude: num(row.geoLatitude) ?? DEFAULT_SEO_SETTINGS.geoLatitude,
    geoLongitude: num(row.geoLongitude) ?? DEFAULT_SEO_SETTINGS.geoLongitude,

    robotsIndexingEnabled: row.robotsIndexingEnabled,
    robotsExtraDisallow: str(row.robotsExtraDisallow),
    sitemapIncludeProducts: row.sitemapIncludeProducts,
    sitemapIncludeCategories: row.sitemapIncludeCategories,
    sitemapIncludePages: row.sitemapIncludePages,
    sitemapDefaultFrequency: row.sitemapDefaultFrequency as SitemapFrequency,

    googleSiteVerification: str(row.googleSiteVerification),
    bingSiteVerification: str(row.bingSiteVerification),
    googleAnalyticsId: str(row.googleAnalyticsId),
    facebookPixelId: str(row.facebookPixelId),
  };
}

export function normalizePage(row: PageRow): SeoPageMeta {
  return {
    pageKey: row.pageKey,
    label: row.label,
    path: row.path,
    metaTitle: str(row.metaTitle),
    metaDescription: str(row.metaDescription),
    keywords: str(row.keywords),
    ogImageUrl: str(row.ogImageUrl),
    noIndex: row.noIndex,
    includeInSitemap: row.includeInSitemap,
    sitemapPriority: num(row.sitemapPriority) ?? 0.8,
    sitemapFrequency: row.sitemapFrequency as SitemapFrequency,
    displayOrder: row.displayOrder,
  };
}

/** Postgres puts the useful part of a Drizzle failure on `cause`. */
function describeDbError(error: unknown): string {
  const e = error as { message?: string; cause?: { code?: string; message?: string } };
  const code = e?.cause?.code;
  const detail = e?.cause?.message ?? e?.message ?? String(error);
  return code ? `[${code}] ${detail}` : detail;
}

/**
 * The uncached read. Everything below this is about not doing it very often.
 */
async function loadSeoBundle(): Promise<SeoBundle> {
  try {
    // Imported here rather than at module scope because `@/db` throws on a missing
    // `DATABASE_URL`. This runs in the root layout, so a static import would turn
    // one absent env var into a blank page for every route on the site.
    const { db } = await import('@/db');

    const [settingsRows, pageRows] = await Promise.all([
      db.select().from(seoSettings).limit(1),
      db.select().from(seoPageMeta).orderBy(asc(seoPageMeta.displayOrder), asc(seoPageMeta.pageKey)),
    ]);

    const row = settingsRows[0];
    if (!row) {
      return {
        settings: DEFAULT_SEO_SETTINGS,
        pages: pageRows.length ? pageRows.map(normalizePage) : DEFAULT_PAGE_META,
        persisted: false,
      };
    }

    return {
      settings: normalizeSettings(row),
      // A route the operator has not saved yet still needs its default copy, so
      // the two lists are merged by `pageKey` rather than replaced.
      pages: mergePages(pageRows.map(normalizePage)),
      persisted: true,
    };
  } catch (error) {
    // `warn`, not `error`: this is a designed fallback and the page renders
    // correctly from it. At error level Next's dev overlay presented a handled
    // degradation as a crash.
    console.warn('[seo] settings unavailable, serving built-in defaults:', describeDbError(error));
    return { settings: DEFAULT_SEO_SETTINGS, pages: DEFAULT_PAGE_META, persisted: false };
  }
}

/**
 * Cached across requests, tagged so a publish invalidates it immediately.
 *
 * Without this the root layout queried the database on every single page view.
 * `DATABASE_URL` points at Supabase's transaction pooler, which has a hard client
 * limit, and in dev `export const revalidate` is not honoured — so "cache it on
 * the route" was not actually caching anything and the pooler started returning
 * `Connection terminated due to connection timeout`.
 */
const loadSeoBundleCached = unstable_cache(loadSeoBundle, ['seo-bundle'], {
  revalidate: 3600,
  tags: [SEO_CACHE_TAG],
});

/**
 * Settings + every route row, or the code defaults.
 *
 * `persisted: false` tells the admin console to show "using built-in defaults"
 * rather than pretending the empty form it rendered is what is live.
 *
 * The React `cache()` wrapper is the second half of the fix: `app/layout.tsx`
 * reads this from both `generateMetadata` and `RootLayout`, which without
 * memoisation was two independent calls — four queries — per page render.
 */
export const getSeoBundle = cache(async (): Promise<SeoBundle> => {
  try {
    return await loadSeoBundleCached();
  } catch (error) {
    // `unstable_cache` itself can throw outside a request scope (a script
    // importing this module, for instance). Fall through to a direct read.
    console.warn('[seo] cache layer unavailable, reading directly:', describeDbError(error));
    return loadSeoBundle();
  }
});

/** Stored rows win; routes with no row yet keep their built-in copy. */
export function mergePages(stored: SeoPageMeta[]): SeoPageMeta[] {
  const byKey = new Map(stored.map((page) => [page.pageKey, page]));
  const merged = DEFAULT_PAGE_META.map((fallback) => {
    const row = byKey.get(fallback.pageKey);
    if (!row) return fallback;
    byKey.delete(fallback.pageKey);
    return {
      ...fallback,
      ...row,
      metaTitle: row.metaTitle || fallback.metaTitle,
      metaDescription: row.metaDescription || fallback.metaDescription,
      keywords: row.keywords || fallback.keywords,
    };
  });
  // Rows for routes not in the built-in list (added later by an operator).
  return [...merged, ...byKey.values()].sort((a, b) => a.displayOrder - b.displayOrder);
}
