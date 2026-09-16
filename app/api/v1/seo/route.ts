import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { products, seoPageMeta, seoSettings } from '@/db/schema';
import { STAFF_ROLES, withRole } from '@/lib/auth/middleware';
import { getUserFromRequest } from '@/lib/auth/utils';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import { seoPayloadSchema, seoQuerySchema } from '@/lib/validation/seo';
import { DEFAULT_PAGE_META, DEFAULT_SEO_SETTINGS } from '@/lib/seo/defaults';
import { getSeoBundle, SEO_CACHE_TAG } from '@/lib/seo/queries';

/**
 * The SEO engine's read/write surface.
 *
 * GET is public because the storefront's `<head>` depends on it — a visitor with
 * no session still needs the title, description and JSON-LD. What the public
 * branch does *not* return is the analytics/verification block or the product
 * matrix: those are operational configuration, and `include=products` would
 * otherwise be a catalogue dump behind a settings URL.
 *
 * Writes are admin-only twice over — the Edge rule in `middleware.ts` and
 * `withRole(['admin'])` here.
 */

/** Fields a guest has no use for and should not be handed. */
function publicSettings(settings: Awaited<ReturnType<typeof getSeoBundle>>['settings']) {
  const {
    googleSiteVerification,
    bingSiteVerification,
    googleAnalyticsId,
    facebookPixelId,
    robotsExtraDisallow,
    ...rest
  } = settings;
  // Verification tokens are rendered into the public `<head>` anyway, so they are
  // returned; the analytics ids and the disallow list are not.
  return { ...rest, googleSiteVerification, bingSiteVerification };
}

export async function GET(request: NextRequest) {
  try {
    const query = parseQuery(request.url, seoQuerySchema);
    if (!query.ok) return query.response;

    const caller = await getUserFromRequest(request);
    const isStaff = Boolean(
      caller && STAFF_ROLES.includes(caller.role as (typeof STAFF_ROLES)[number]),
    );

    const bundle = await getSeoBundle();

    if (query.data.include === 'products') {
      if (!isStaff) {
        return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
      }

      const term = query.data.search?.trim();
      const rows = await db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          sku: products.sku,
          metaTitle: products.metaTitle,
          metaDescription: products.metaDescription,
        })
        .from(products)
        .where(
          term
            ? and(
                eq(products.isActive, true),
                or(
                  ilike(products.name, `%${term}%`),
                  ilike(products.sku, `%${term}%`),
                  ilike(products.slug, `%${term}%`),
                ),
              )
            : eq(products.isActive, true),
        )
        .orderBy(asc(products.name))
        .limit(query.data.limit)
        .offset(query.data.offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(eq(products.isActive, true));

      return NextResponse.json({ products: rows, total: count });
    }

    if (!isStaff) {
      return NextResponse.json({
        settings: publicSettings(bundle.settings),
        // Routes carry no secrets, but the noindex ones are internal surface the
        // storefront never renders — no reason to advertise them.
        pages: bundle.pages.filter((page) => !page.noIndex),
        persisted: bundle.persisted,
      });
    }

    return NextResponse.json(bundle);
  } catch (error) {
    console.error('Error fetching SEO settings:', error);
    // Never fail the storefront's head over this.
    return NextResponse.json({
      settings: DEFAULT_SEO_SETTINGS,
      pages: DEFAULT_PAGE_META.filter((page) => !page.noIndex),
      persisted: false,
      degraded: true,
    });
  }
}

export const PUT = withRole(['admin'], async (request: NextRequest, { user }) => {
  try {
    const parsed = await parseJson(request, seoPayloadSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    if (payload.type === 'global') {
      const values = {
        ...payload.data,
        // `numeric` columns take strings; a null clears back to the code default.
        geoLatitude:
          payload.data.geoLatitude === null || payload.data.geoLatitude === undefined
            ? null
            : String(payload.data.geoLatitude),
        geoLongitude:
          payload.data.geoLongitude === null || payload.data.geoLongitude === undefined
            ? null
            : String(payload.data.geoLongitude),
        updatedAt: new Date(),
        updatedBy: user.email,
      };

      const [existing] = await db.select({ id: seoSettings.id }).from(seoSettings).limit(1);

      if (existing) {
        const [updated] = await db
          .update(seoSettings)
          .set(values)
          .where(eq(seoSettings.id, existing.id))
          .returning();
        revalidateTag(SEO_CACHE_TAG);
        return NextResponse.json({ success: true, settings: updated });
      }

      const [created] = await db.insert(seoSettings).values(values).returning();
      revalidateTag(SEO_CACHE_TAG);
      return NextResponse.json({ success: true, settings: created }, { status: 201 });
    }

    if (payload.type === 'pages') {
      // Upsert per route rather than delete-and-reinsert: the console posts only
      // the rows the operator can see, and wiping the table would drop the rest.
      await db.transaction(async (tx) => {
        for (const page of payload.data) {
          await tx
            .insert(seoPageMeta)
            .values({
              ...page,
              sitemapPriority: String(page.sitemapPriority),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: seoPageMeta.pageKey,
              set: {
                label: page.label,
                path: page.path,
                metaTitle: page.metaTitle,
                metaDescription: page.metaDescription,
                keywords: page.keywords,
                ogImageUrl: page.ogImageUrl,
                noIndex: page.noIndex,
                includeInSitemap: page.includeInSitemap,
                sitemapPriority: String(page.sitemapPriority),
                sitemapFrequency: page.sitemapFrequency,
                displayOrder: page.displayOrder,
                updatedAt: new Date(),
              },
            });
        }
      });

      // The layout, sitemap and robots all read the cached bundle; without this
      // a published change would not show until the hourly TTL expired.
      revalidateTag(SEO_CACHE_TAG);

      const bundle = await getSeoBundle();
      return NextResponse.json({ success: true, pages: bundle.pages });
    }

    // products — per-SKU title/description overrides live on the catalogue row.
    await db.transaction(async (tx) => {
      for (const row of payload.data) {
        await tx
          .update(products)
          .set({
            metaTitle: row.metaTitle,
            metaDescription: row.metaDescription,
            updatedAt: new Date(),
          })
          .where(eq(products.id, row.id));
      }
    });

    return NextResponse.json({ success: true, updated: payload.data.length });
  } catch (error) {
    console.error('Error saving SEO settings:', error);
    return NextResponse.json({ error: 'Failed to save SEO settings' }, { status: 500 });
  }
});
