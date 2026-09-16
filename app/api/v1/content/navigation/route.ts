import { NextRequest, NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { navigationMenuItems, siteContentSettings } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';

const schema = z.object({ items: z.array(z.object({ label: z.string().min(1).max(80), url: z.string().max(300), displayOrder: z.number().int().min(0), isActive: z.boolean() })).max(50), settings: z.object({ socialLinks: z.record(z.string(), z.string().max(500)).default({}), footerColumns: z.array(z.object({ title: z.string().max(80), links: z.array(z.object({ label: z.string().max(80), url: z.string().max(300) })) })).max(4).default([]), copyrightText: z.string().max(300).optional(), metaTitle: z.string().max(200).optional(), metaDescription: z.string().max(500).optional(), openGraphImageUrl: z.string().max(500).optional(), googleAnalyticsId: z.string().max(100).optional(), facebookPixelId: z.string().max(100).optional() }) });
export const GET = withRole(['admin', 'sales'], async () => { const [items, settings] = await Promise.all([db.select().from(navigationMenuItems).orderBy(asc(navigationMenuItems.displayOrder)), db.select().from(siteContentSettings).limit(1)]); return NextResponse.json({ items, settings: settings[0] || null }); });
export const PUT = withRole(['admin'], async (request: NextRequest) => { const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Invalid navigation settings' }, { status: 400 }); await db.transaction(async (tx) => { await tx.delete(navigationMenuItems); if (parsed.data.items.length) await tx.insert(navigationMenuItems).values(parsed.data.items); await tx.delete(siteContentSettings); await tx.insert(siteContentSettings).values(parsed.data.settings); }); return NextResponse.json({ success: true }); });
