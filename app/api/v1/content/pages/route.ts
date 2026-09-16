import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { pages } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';

const pageSchema = z.object({ id: z.number().int().positive().optional(), title: z.string().trim().min(1).max(200), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), content: z.object({ html: z.string().max(100000) }), status: z.enum(['draft', 'published']).default('draft'), metaTitle: z.string().max(200).optional(), metaDescription: z.string().max(500).optional() });
export const GET = withRole(['admin', 'sales'], async () => NextResponse.json({ pages: await db.select().from(pages).orderBy(desc(pages.updatedAt)) }));
export const POST = withRole(['admin'], async (request: NextRequest) => { const parsed = pageSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Invalid page' }, { status: 400 }); const [page] = await db.insert(pages).values(parsed.data).returning(); return NextResponse.json({ page }, { status: 201 }); });
export const PUT = withRole(['admin'], async (request: NextRequest) => { const parsed = pageSchema.safeParse(await request.json()); if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: 'Invalid page' }, { status: 400 }); const { id, ...data } = parsed.data; const [page] = await db.update(pages).set({ ...data, updatedAt: new Date() }).where(eq(pages.id, id)).returning(); return NextResponse.json({ page }); });
