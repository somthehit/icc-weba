import type { Metadata } from 'next';

import { SUDURPASHCHIM_CONFIG } from '@/config/regional';
import { buildLocalBusinessJsonLd } from '@/lib/seo/jsonld';
import { getSeoBundle } from '@/lib/seo/queries';

import './globals.css'; // Global styles

// app/layout.tsx
//
// The server-rendered `<head>`.
//
// The storefront is one client route with a hash router, so `useSeoMeta` does the
// per-view work in the browser. This layer matters for the crawlers and preview
// bots that never execute JavaScript — a Facebook or Viber share scrape sees only
// what is in the initial HTML. Previously that was three hardcoded strings naming
// the wrong district; it is now the admin-managed record.

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSeoBundle();

  const title = [settings.defaultMetaTitle, settings.titleSuffix]
    .filter(Boolean)
    .join(' ')
    .trim();
  const description = settings.defaultMetaDescription;
  const baseUrl = settings.canonicalBaseUrl.replace(/\/+$/, '');

  return {
    metadataBase: new URL(baseUrl),
    title: title || settings.siteName,
    description,
    applicationName: settings.siteName,
    keywords: settings.defaultKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    alternates: { canonical: '/' },
    robots: settings.robotsIndexingEnabled
      ? { index: true, follow: true }
      : { index: false, follow: false },
    verification: {
      ...(settings.googleSiteVerification ? { google: settings.googleSiteVerification } : {}),
      ...(settings.bingSiteVerification
        ? { other: { 'msvalidate.01': settings.bingSiteVerification } }
        : {}),
    },
    openGraph: {
      title: title || settings.siteName,
      description,
      type: 'website',
      siteName: settings.siteName,
      url: baseUrl,
      locale: settings.ogLocale,
      ...(settings.ogImageUrl
        ? { images: [{ url: settings.ogImageUrl, width: 1200, height: 630 }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: title || settings.siteName,
      description,
      ...(settings.twitterHandle ? { site: settings.twitterHandle } : {}),
      ...(settings.ogImageUrl ? { images: [settings.ogImageUrl] } : {}),
    },
    other: {
      // ISO 3166-2:NP code for Sudurpashchim — the regional signal that survives
      // in the static HTML for crawlers that skip our client-side tags.
      'geo.region': 'NP-SU',
      'geo.placename': `${SUDURPASHCHIM_CONFIG.headquartersCity}, ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}, Nepal`,
      'geo.position': `${SUDURPASHCHIM_CONFIG.geo.latitude};${SUDURPASHCHIM_CONFIG.geo.longitude}`,
      ICBM: `${SUDURPASHCHIM_CONFIG.geo.latitude}, ${SUDURPASHCHIM_CONFIG.geo.longitude}`,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { settings } = await getSeoBundle();
  const baseUrl = settings.canonicalBaseUrl.replace(/\/+$/, '');

  return (
    <html lang="en-NP" className="scroll-smooth">
      <head>
        {settings.structuredDataEnabled && (
          // Server-rendered so a share scrape sees the LocalBusiness node. The
          // client hook replaces `#seo-json-ld` per view; this one has its own id
          // and stays put as the site-level record.
          <script
            id="seo-json-ld-site"
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(buildLocalBusinessJsonLd(settings, baseUrl)),
            }}
          />
        )}
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
