// lib/validation/seo.ts
//
// What the SEO console is allowed to save.
//
// The route handler used to be the only thing between an admin form and a
// `db.update().set(body)`, which is how `PUT /api/settings` once accepted any
// column on any settings table. Everything here is an explicit allow-list: a
// field not named below is dropped, not forwarded.
//
// Lengths mirror the `varchar` widths in `db/schema/seo.ts` so a 250-character
// meta title fails validation with a readable message instead of a Postgres
// `value too long` 500.

import { z } from 'zod';

const sitemapFrequency = z.enum([
  'always',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'never',
]);

/** Optional text field: `''` from an untouched input is stored as NULL. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? null : (value ?? null)));

/**
 * A URL field that tolerates the empty string.
 *
 * The form ships `''` for "no OG image", and `z.url()` rejects it — which showed
 * up as a validation error on a field the operator never touched.
 */
const optionalUrl = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => value === '' || /^https?:\/\//i.test(value) || value.startsWith('/'), {
      message: 'Must be an absolute http(s) URL or a site-relative path',
    })
    .optional()
    .transform((value) => (value === '' ? null : (value ?? null)));

export const seoSettingsSchema = z.object({
  siteName: z.string().trim().min(2).max(150),
  canonicalBaseUrl: z
    .string()
    .trim()
    .min(8)
    .max(300)
    .regex(/^https?:\/\//i, 'Must start with http:// or https://')
    // A trailing slash here doubles up when paths are appended.
    .transform((value) => value.replace(/\/+$/, '')),
  titleSuffix: optionalText(200),
  defaultMetaTitle: optionalText(200),
  defaultMetaDescription: optionalText(500),
  defaultKeywords: optionalText(2000),
  ogImageUrl: optionalUrl(500),
  twitterHandle: optionalText(60),
  ogLocale: z.string().trim().min(2).max(12).default('en_NP'),

  activeScope: z.enum(['region_exclusive', 'nepal_nationwide']),
  regionBannerMessage: optionalText(300),
  regionBannerEnabled: z.boolean().default(true),
  extraAreasServed: optionalText(2000),

  structuredDataEnabled: z.boolean().default(true),
  localBusinessType: z
    .enum(['ComputerStore', 'ElectronicsStore', 'HardwareStore', 'Store', 'LocalBusiness'])
    .default('ComputerStore'),
  priceRange: z.string().trim().min(1).max(60).default('NPR 500 - NPR 500,000'),
  // Nepal's bounding box, so a mistyped coordinate cannot move the shop abroad.
  geoLatitude: z.coerce.number().min(26).max(31).nullable().optional(),
  geoLongitude: z.coerce.number().min(80).max(89).nullable().optional(),

  robotsIndexingEnabled: z.boolean().default(true),
  robotsExtraDisallow: optionalText(2000),
  sitemapIncludeProducts: z.boolean().default(true),
  sitemapIncludeCategories: z.boolean().default(true),
  sitemapIncludePages: z.boolean().default(true),
  sitemapDefaultFrequency: sitemapFrequency.default('daily'),

  googleSiteVerification: optionalText(200),
  bingSiteVerification: optionalText(200),
  googleAnalyticsId: optionalText(100),
  facebookPixelId: optionalText(100),
});

export const seoPageMetaSchema = z.object({
  pageKey: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, digits and hyphens only'),
  label: z.string().trim().min(1).max(120),
  path: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .regex(/^\//, 'Must be a site-relative path starting with /'),
  metaTitle: optionalText(200),
  metaDescription: optionalText(500),
  keywords: optionalText(2000),
  ogImageUrl: optionalUrl(500),
  noIndex: z.boolean().default(false),
  includeInSitemap: z.boolean().default(true),
  sitemapPriority: z.coerce.number().min(0).max(1).default(0.8),
  sitemapFrequency: sitemapFrequency.default('weekly'),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
});

/** Per-product overrides, saved from the Product SEO Matrix tab. */
export const productSeoSchema = z.object({
  id: z.coerce.number().int().positive(),
  metaTitle: optionalText(200),
  metaDescription: optionalText(500),
});

/**
 * The console posts one tab at a time, so the body is a discriminated union
 * rather than a partial of everything — a "Publish" on the Global tab cannot
 * silently blank the page rows it never loaded.
 */
export const seoPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('global'), data: seoSettingsSchema }),
  z.object({ type: z.literal('pages'), data: z.array(seoPageMetaSchema).min(1).max(100) }),
  z.object({ type: z.literal('products'), data: z.array(productSeoSchema).min(1).max(200) }),
]);

export const seoQuerySchema = z.object({
  /** `products` adds the catalogue rows the matrix tab edits — a heavier read. */
  include: z.enum(['settings', 'products']).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SeoSettingsInput = z.infer<typeof seoSettingsSchema>;
export type SeoPageMetaInput = z.infer<typeof seoPageMetaSchema>;
export type SeoPayload = z.infer<typeof seoPayloadSchema>;
