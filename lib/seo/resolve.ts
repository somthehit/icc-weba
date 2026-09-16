// lib/seo/resolve.ts
//
// One function that turns (admin settings + route + runtime context) into the head
// tags for a page.
//
// This replaces a 300-line `switch (currentPage)` of literal strings in
// `hooks/useSeoMeta.ts`. The switch is gone, not moved: the per-route copy now
// comes from `seo_page_meta` (seeded from `lib/seo/defaults.ts`), and the only
// thing left in code is the structured data that has to be computed from live
// data — product price, availability, breadcrumbs, FAQ entries.

import { SUDURPASHCHIM_CONFIG, SAME_DAY_HUBS, isNationwideActive } from '@/config/regional';
import { STORE_INFO } from '@/lib/data/initial-data';
import { ALWAYS_NOINDEX_KEYS, DEFAULT_SEO_SETTINGS, DEFAULT_PAGE_META } from './defaults';
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildLocalBusinessJsonLd,
  buildProductJsonLd,
  buildServiceJsonLd,
  buildWebsiteJsonLd,
  type JsonLd,
} from './jsonld';
import type { SeoBundle, SeoConfig, SeoPageMeta, SeoSettings } from './types';
import { splitKeywords } from './types';

/** What the storefront knows at render time and the resolver may use. */
export interface SeoRenderContext {
  /** `StoreContext.currentPage` — the `page_key` to look up. */
  pageKey: string;
  origin: string;
  searchQuery?: string;
  /** From `?category=<slug>` on /shop — the filtered catalogue landing page. */
  category?: { slug: string; name: string } | null;
  product?: {
    name: string;
    slug: string;
    sku?: string | null;
    brand?: string;
    category?: string;
    images?: string[];
    shortDescription?: string;
    longDescription?: string;
    sellingPrice: number;
    inStock?: boolean;
    rating?: number;
    reviewCount?: number;
    metaTitle?: string | null;
    metaDescription?: string | null;
  } | null;
  faqs?: Array<{ question: string; answer: string }>;
}

/** Locale-aware NPR formatting for the product title. */
const npr = (value: number) => `NPR ${Math.round(value).toLocaleString('en-IN')}`;

const trimTo = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

/**
 * Title + suffix, but only when the suffix actually fits.
 *
 * Google truncates around 60 characters, so appending the 76-character regional
 * suffix to an already-long product title buys nothing and hides the product
 * name. The suffix is a default, not a decoration.
 */
function withSuffix(title: string, suffix: string): string {
  if (!suffix) return title;
  if (title.toLowerCase().includes(suffix.replace(/^\|\s*/, '').toLowerCase())) return title;
  const combined = `${title} ${suffix}`.replace(/\s+/g, ' ').trim();
  return combined.length <= 70 ? combined : title;
}

export function findPageMeta(pages: SeoPageMeta[], pageKey: string): SeoPageMeta | null {
  return (
    pages.find((page) => page.pageKey === pageKey) ??
    DEFAULT_PAGE_META.find((page) => page.pageKey === pageKey) ??
    null
  );
}

/**
 * The delivery line the storefront shows, derived from the active scope so the
 * banner, the footer and the FAQ cannot disagree with each other.
 */
export function regionBanner(settings: SeoSettings): string | null {
  if (!settings.regionBannerEnabled) return null;
  return settings.regionBannerMessage || SUDURPASHCHIM_CONFIG.bannerMessage;
}

/**
 * The head tags for one page.
 *
 * Precedence, narrowest first: an explicit `override` from the view →
 * runtime-computed values (product, search) → the route's `seo_page_meta` row →
 * `seo_settings` defaults → `lib/seo/defaults.ts`.
 */
export function resolveSeo(
  bundle: SeoBundle,
  context: SeoRenderContext,
  override?: SeoConfig | null,
): SeoConfig {
  const settings = bundle.settings ?? DEFAULT_SEO_SETTINGS;
  const page = findPageMeta(bundle.pages ?? [], context.pageKey);
  const origin = (context.origin || settings.canonicalBaseUrl || '').replace(/\/$/, '');

  const suffix = settings.titleSuffix ?? '';
  const baseKeywords = splitKeywords(settings.defaultKeywords);

  let title = page?.metaTitle || settings.defaultMetaTitle || settings.siteName;
  let description = page?.metaDescription || settings.defaultMetaDescription;
  let canonicalUrl = `${origin}${page?.path ?? '/'}`;
  let ogImage = page?.ogImageUrl || settings.ogImageUrl;
  let ogType: SeoConfig['ogType'] = 'website';
  let keywords = [...baseKeywords, ...splitKeywords(page?.keywords)];
  let jsonLd: JsonLd | JsonLd[] | null = null;

  // Routes whose metadata depends on data only the client has.
  switch (context.pageKey) {
    case 'home': {
      jsonLd = [
        buildLocalBusinessJsonLd(settings, origin),
        buildWebsiteJsonLd(settings, origin),
      ];
      break;
    }

    case 'shop': {
      const query = context.searchQuery?.trim();
      if (query) {
        title = `Search: "${query}" | ${STORE_INFO.shortName}`;
        description = `Prices and stock for "${query}" at ${settings.siteName} — genuine products, official warranty and express delivery across ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}.`;
        canonicalUrl = `${origin}/shop?search=${encodeURIComponent(query)}`;
        keywords = [...keywords, query, `${query} price in ${SUDURPASHCHIM_CONFIG.headquartersCity}`];
        break;
      }

      // A category landing page needs its own title, or every `?category=` URL in
      // the sitemap reports as a duplicate of the bare /shop page.
      if (context.category) {
        const { name, slug } = context.category;
        title = `${name} in ${SUDURPASHCHIM_CONFIG.headquartersCity}, ${SUDURPASHCHIM_CONFIG.headquartersDistrict}`;
        description = `Buy ${name.toLowerCase()} in ${SUDURPASHCHIM_CONFIG.headquartersCity} with official warranty and COD. Same-day delivery in ${SAME_DAY_HUBS.join(', ')}, express dispatch across ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}.`;
        canonicalUrl = `${origin}/shop?category=${encodeURIComponent(slug)}`;
        keywords = [
          `${name} ${SUDURPASHCHIM_CONFIG.headquartersCity}`,
          `${name} price ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}`,
          ...keywords,
        ];
        jsonLd = buildBreadcrumbJsonLd([
          { name: 'Home', url: `${origin}/` },
          { name: 'Shop', url: `${origin}/shop` },
          { name, url: canonicalUrl },
        ]);
      }
      break;
    }

    case 'product-detail': {
      const product = context.product;
      if (product) {
        const images = product.images?.length
          ? product.images
          : ogImage
            ? [ogImage]
            : [];
        const body = product.shortDescription || product.longDescription || '';

        title =
          product.metaTitle ||
          `${product.name} Price in ${SUDURPASHCHIM_CONFIG.headquartersCity} (${npr(product.sellingPrice)})`;
        description =
          product.metaDescription ||
          trimTo(
            `${body} Buy ${product.name} in ${SUDURPASHCHIM_CONFIG.headquartersCity} with official warranty, COD and ${SAME_DAY_HUBS[0]} same-day delivery.`,
            300,
          );
        canonicalUrl = `${origin}/product/${product.slug}`;
        ogImage = images[0] || ogImage;
        ogType = 'product';
        keywords = [
          product.name,
          `${product.name} price in ${SUDURPASHCHIM_CONFIG.headquartersCity}`,
          `buy ${product.name} ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}`,
          ...(product.brand ? [product.brand] : []),
          ...(product.category ? [product.category] : []),
          ...baseKeywords,
        ];

        jsonLd = [
          buildProductJsonLd({
            name: product.name,
            images,
            description: body,
            sku: product.sku || product.slug,
            brand: product.brand || settings.siteName,
            category: product.category || 'Electronics',
            price: product.sellingPrice,
            inStock: product.inStock !== false,
            canonicalUrl,
            rating: product.rating,
            reviewCount: product.reviewCount,
            sellerName: settings.siteName,
          }),
          buildBreadcrumbJsonLd([
            { name: 'Home', url: `${origin}/` },
            { name: 'Shop', url: `${origin}/shop` },
            { name: product.name, url: canonicalUrl },
          ]),
        ];
      } else {
        title = `Product Details | ${STORE_INFO.shortName}`;
        canonicalUrl = `${origin}/shop`;
      }
      break;
    }

    case 'services': {
      jsonLd = buildServiceJsonLd(settings, description);
      break;
    }

    case 'faq': {
      const entries = context.faqs?.length ? context.faqs : defaultFaqEntries();
      jsonLd = buildFaqJsonLd(entries);
      break;
    }

    case 'about':
    case 'contact': {
      jsonLd = buildLocalBusinessJsonLd(settings, origin);
      break;
    }

    default:
      break;
  }

  // Indexing: the hardcoded list wins over the database, so a mis-click in the
  // console cannot put the checkout in Google.
  const noIndex =
    ALWAYS_NOINDEX_KEYS.has(context.pageKey) ||
    Boolean(page?.noIndex) ||
    !settings.robotsIndexingEnabled;

  const resolved: SeoConfig = {
    title: withSuffix(title, suffix),
    description,
    canonicalUrl,
    ogImage,
    ogType,
    keywords,
    noIndex,
    jsonLd: settings.structuredDataEnabled ? (jsonLd ?? undefined) : undefined,
    locale: settings.ogLocale,
    twitterHandle: settings.twitterHandle,
    googleSiteVerification: settings.googleSiteVerification,
    bingSiteVerification: settings.bingSiteVerification,
  };

  if (!override) return resolved;

  // A view's explicit push wins, field by field — a partial override should not
  // wipe the resolved JSON-LD it said nothing about.
  return {
    ...resolved,
    ...Object.fromEntries(
      Object.entries(override).filter(([, value]) => value !== undefined && value !== null),
    ),
  };
}

/**
 * FAQ answers that match the actual delivery footprint.
 *
 * The previous copy promised free delivery in "Kailali, Lalitpur and Bhaktapur" —
 * two Dhangadhi-valley districts this warehouse does not serve — and appeared in
 * FAQPage structured data, which is exactly the sort of claim that gets a rich
 * result pulled.
 */
export function defaultFaqEntries(): Array<{ question: string; answer: string }> {
  const districts = SUDURPASHCHIM_CONFIG.keyDistricts;
  const codDistricts = districts.filter((d) => d.codAvailable).map((d) => d.name);

  return [
    {
      question: `Which areas do you deliver to?`,
      answer: isNationwideActive()
        ? `We deliver across all 77 districts of Nepal, with same-day dispatch inside ${SAME_DAY_HUBS.join(', ')}.`
        : `We currently deliver to all ${districts.length} districts of ${SUDURPASHCHIM_CONFIG.primaryProvinceShort} Province — ${districts.map((d) => d.name).join(', ')}. Same-day delivery is available in ${SAME_DAY_HUBS.join(', ')}. Nepal-wide delivery is coming soon.`,
    },
    {
      question: `How long does delivery take to ${SUDURPASHCHIM_CONFIG.headquartersCity} and Mahendranagar?`,
      answer: `${districts[0].hubs.join(', ')} (Kailali) receive orders in ${districts[0].estTime}. Kanchanpur hubs including Mahendranagar take ${districts[1].estTime}. Hill districts such as Bajhang, Bajura and Darchula take 3-4 days.`,
    },
    {
      question: 'Is Cash on Delivery available?',
      answer: `Yes. Cash on Delivery is available in ${codDistricts.join(', ')}. eSewa, Khalti, Fonepay QR and bank transfer are accepted everywhere we ship.`,
    },
    {
      question: `Are all products genuine with official Nepal warranty?`,
      answer: `Yes. Every item is brand new, sourced from authorised Nepal distributors, and covered by manufacturer warranty with in-house service at our ${SUDURPASHCHIM_CONFIG.headquartersHub}.`,
    },
  ];
}
