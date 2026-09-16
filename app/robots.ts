import { MetadataRoute } from 'next';

import { getSeoBundle } from '@/lib/seo/queries';

// app/robots.ts
//
// The crawl policy, driven by the console's Sitemap & Indexing tab.
//
// `/admin/` and `/checkout/` are disallowed unconditionally rather than read from
// the settings row: an operator clearing the extra-disallow box should not be able
// to invite Google into the order pipeline.

export const revalidate = 3600;

const ALWAYS_DISALLOW = ['/admin/', '/checkout/', '/account/', '/cart/', '/api/'];

/** Accepts one-per-line or comma-separated input from the console. */
function parseDisallow(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter((part) => part.startsWith('/'));
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { settings } = await getSeoBundle();
  const baseUrl = settings.canonicalBaseUrl.replace(/\/+$/, '');

  // Indexing switched off — say so once, plainly, rather than shipping a sitemap
  // alongside a blanket disallow.
  if (!settings.robotsIndexingEnabled) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...ALWAYS_DISALLOW, ...parseDisallow(settings.robotsExtraDisallow)],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
