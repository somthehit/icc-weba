import { MetadataRoute } from 'next';

import { db } from '@/db';
import { categories, pages as cmsPages, products } from '@/db/schema';
import { eq } from 'drizzle-orm';

import { getSeoBundle } from '@/lib/seo/queries';

// app/sitemap.ts
//
// The sitemap, built from the database rather than from the seed file.
//
// The previous version listed `INITIAL_PRODUCTS` — a hardcoded demo array — and
// emitted product URLs as `/#product/<slug>`. A fragment is not a distinct URL to
// a crawler, so every one of those entries collapsed onto the homepage and the
// catalogue was effectively unlisted. They are now real paths, and which sections
// appear is controlled from the console's Sitemap & Indexing tab.

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { settings, pages: routes } = await getSeoBundle();
  const baseUrl = settings.canonicalBaseUrl.replace(/\/+$/, '');
  const now = new Date();

  // A site the operator has taken out of the index should not advertise a
  // sitemap full of URLs.
  if (!settings.robotsIndexingEnabled) return [];

  const staticRoutes: MetadataRoute.Sitemap = routes
    .filter((route) => route.includeInSitemap && !route.noIndex)
    .map((route) => ({
      url: `${baseUrl}${route.path === '/' ? '' : route.path}`,
      lastModified: now,
      changeFrequency: route.sitemapFrequency as MetadataRoute.Sitemap[number]['changeFrequency'],
      priority: route.sitemapPriority,
    }));

  const dynamicRoutes: MetadataRoute.Sitemap = [];

  // Each block is independently guarded: a missing table (migration not yet
  // applied) should cost that section, not the whole sitemap.
  if (settings.sitemapIncludeProducts) {
    try {
      const rows = await db
        .select({ slug: products.slug, updatedAt: products.updatedAt })
        .from(products)
        .where(eq(products.isActive, true))
        .limit(5000);

      for (const row of rows) {
        dynamicRoutes.push({
          url: `${baseUrl}/product/${row.slug}`,
          lastModified: row.updatedAt ?? now,
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    } catch (error) {
      console.error('sitemap: product rows unavailable', error);
    }
  }

  if (settings.sitemapIncludeCategories) {
    try {
      const rows = await db
        .select({ slug: categories.slug })
        .from(categories)
        .where(eq(categories.isActive, true));

      for (const row of rows) {
        dynamicRoutes.push({
          url: `${baseUrl}/shop?category=${row.slug}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    } catch (error) {
      console.error('sitemap: category rows unavailable', error);
    }
  }

  if (settings.sitemapIncludePages) {
    try {
      const rows = await db
        .select({ slug: cmsPages.slug, updatedAt: cmsPages.updatedAt })
        .from(cmsPages)
        .where(eq(cmsPages.status, 'published'));

      for (const row of rows) {
        dynamicRoutes.push({
          url: `${baseUrl}/pages/${row.slug}`,
          lastModified: row.updatedAt ?? now,
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      }
    } catch (error) {
      console.error('sitemap: CMS pages unavailable', error);
    }
  }

  return [...staticRoutes, ...dynamicRoutes];
}
