'use client';

// hooks/useSeoMeta.ts
//
// Writes the resolved SEO config into `document.head`.
//
// This used to be a 435-line file whose bulk was a `switch (currentPage)` of
// hardcoded titles, descriptions and JSON-LD. All of that copy now lives in
// `seo_page_meta` (seeded from `lib/seo/defaults.ts`) and is merged by
// `lib/seo/resolve.ts`, so what is left here is the DOM work: create-or-update a
// meta tag, a link tag, and the JSON-LD script.
//
// Why DOM mutation rather than Next's `metadata` export: the storefront is one
// client-rendered route (`app/page.tsx`) with a hash router, so there is no
// server render per view to attach metadata to. `app/layout.tsx` still emits the
// static defaults for crawlers that do not execute JavaScript.

import { useEffect } from 'react';

import { useStore } from '@/context/StoreContext';
import { DEFAULT_BASE_URL, DEFAULT_SEO_BUNDLE } from '@/lib/seo/defaults';
import { resolveSeo } from '@/lib/seo/resolve';
import type { SeoBundle, SeoConfig } from '@/lib/seo/types';

export type { SeoConfig };

/** Create-or-update, so repeated navigations do not append duplicate tags. */
function updateMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector(
    `meta[${attrName}="${attrValue}"]`,
  ) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/** Removes the tag entirely — an empty `content` is not the same as absent. */
function removeMetaTag(attrName: 'name' | 'property', attrValue: string) {
  if (typeof document === 'undefined') return;
  document.head.querySelector(`meta[${attrName}="${attrValue}"]`)?.remove();
}

function updateLinkTag(rel: string, href: string) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function updateJsonLd(
  scriptId: string,
  data: Record<string, any> | Array<Record<string, any>> | null,
) {
  if (typeof document === 'undefined') return;
  const existing = document.head.querySelector(`script#${scriptId}`) as HTMLScriptElement | null;

  if (!data) {
    existing?.remove();
    return;
  }

  const element = existing ?? document.createElement('script');
  if (!existing) {
    element.id = scriptId;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

/**
 * The origin to build canonical URLs from.
 *
 * A canonical pointing at `localhost:3000` or a Cloud Run preview host is worse
 * than none — it tells Google the real domain is a duplicate — so those fall back
 * to the configured production domain.
 */
function canonicalOrigin(configured: string): string {
  if (typeof window === 'undefined') return configured || DEFAULT_BASE_URL;
  const { origin } = window.location;
  const isEphemeral =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('run.app') ||
    origin.includes('vercel.app') ||
    origin.includes('.local');
  return isEphemeral ? configured || DEFAULT_BASE_URL : origin;
}

/**
 * Injects the head tags for the current view.
 *
 * @param overrideConfig fields a view wants to win over the resolved values
 * @param bundle         admin-managed settings; falls back to the code defaults
 */
export function useSeoMeta(overrideConfig?: SeoConfig, bundle?: SeoBundle | null) {
  const store = useStore();

  const active = bundle ?? DEFAULT_SEO_BUNDLE;
  const currentPage = store?.currentPage || 'home';
  const selectedProductSlug = store?.selectedProductSlug || null;
  const searchQuery = store?.searchQuery || '';
  const products = store?.products;
  const categories = store?.categories;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const product =
      currentPage === 'product-detail' && selectedProductSlug
        ? (products || []).find((p) => p.slug === selectedProductSlug) || null
        : null;

    // `/shop?category=<slug>` is a distinct indexed URL (the sitemap submits one
    // per category), so it needs its own title rather than the generic shop one.
    const categorySlug =
      currentPage === 'shop' ? new URLSearchParams(window.location.search).get('category') : null;
    const category = categorySlug
      ? {
          slug: categorySlug,
          name: (categories || []).find((c) => c.id === categorySlug)?.name ?? categorySlug,
        }
      : null;

    const seo = resolveSeo(
      active,
      {
        pageKey: currentPage,
        origin: canonicalOrigin(active.settings.canonicalBaseUrl),
        searchQuery,
        category,
        product: product
          ? {
              name: product.name,
              slug: product.slug,
              sku: product.sku,
              brand: product.brand,
              category: product.category,
              images: product.images,
              shortDescription: product.shortDescription,
              longDescription: product.longDescription,
              sellingPrice: product.sellingPrice,
              inStock: product.inStock,
              rating: product.rating,
              reviewCount: product.reviewCount,
              metaTitle: product.metaTitle,
              metaDescription: product.metaDescription,
            }
          : null,
      },
      overrideConfig,
    );

    // 1. Title
    if (seo.title) document.title = seo.title;

    // 2. Standard meta
    updateMetaTag('name', 'description', seo.description ?? '');
    if (seo.keywords?.length) {
      updateMetaTag('name', 'keywords', seo.keywords.join(', '));
    } else {
      removeMetaTag('name', 'keywords');
    }
    updateMetaTag('name', 'robots', seo.noIndex ? 'noindex, nofollow' : 'index, follow');
    updateMetaTag('name', 'geo.region', 'NP-SU');
    updateMetaTag('name', 'geo.placename', 'Dhangadhi, Sudurpashchim, Nepal');

    // Search Console tokens, when the operator has entered them.
    if (seo.googleSiteVerification) {
      updateMetaTag('name', 'google-site-verification', seo.googleSiteVerification);
    }
    if (seo.bingSiteVerification) {
      updateMetaTag('name', 'msvalidate.01', seo.bingSiteVerification);
    }

    // 3. Canonical
    if (seo.canonicalUrl) updateLinkTag('canonical', seo.canonicalUrl);

    // 4. OpenGraph
    updateMetaTag('property', 'og:title', seo.title ?? '');
    updateMetaTag('property', 'og:description', seo.description ?? '');
    updateMetaTag('property', 'og:url', seo.canonicalUrl ?? '');
    if (seo.ogImage) updateMetaTag('property', 'og:image', seo.ogImage);
    updateMetaTag('property', 'og:type', seo.ogType ?? 'website');
    updateMetaTag('property', 'og:site_name', active.settings.siteName);
    updateMetaTag('property', 'og:locale', seo.locale || 'en_NP');

    // 5. Twitter card
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', seo.title ?? '');
    updateMetaTag('name', 'twitter:description', seo.description ?? '');
    if (seo.ogImage) updateMetaTag('name', 'twitter:image', seo.ogImage);
    if (seo.twitterHandle) updateMetaTag('name', 'twitter:site', seo.twitterHandle);

    // 6. Structured data
    updateJsonLd('seo-json-ld', seo.jsonLd ?? null);
  }, [active, currentPage, selectedProductSlug, searchQuery, products, categories, overrideConfig]);
}
