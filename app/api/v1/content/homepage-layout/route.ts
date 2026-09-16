import { NextRequest, NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { homepageSections } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { DEFAULT_HOMEPAGE_BLOCKS, HOMEPAGE_BLOCK_KEYS } from '@/lib/content/homepage-layout';

const sectionSchema = z.object({
  sectionType: z.enum(HOMEPAGE_BLOCK_KEYS),
  title: z.string().min(1).max(150),
  configuration: z.record(z.string(), z.unknown()).default({}),
  displayOrder: z.number().int().min(1),
  isEnabled: z.boolean().default(true),
});
const layoutSchema = z.union([z.array(sectionSchema), z.object({ blocks: z.array(sectionSchema) })]);

export const GET = withRole(['admin', 'sales'], async () => {
  const sections = await db.select().from(homepageSections).orderBy(asc(homepageSections.displayOrder));
  return NextResponse.json({ sections: sections.length ? sections : DEFAULT_HOMEPAGE_BLOCKS });
});

const saveLayout = withRole(['admin'], async (request: NextRequest) => {
  const parsed = layoutSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid homepage layout' }, { status: 400 });
  const blocks = Array.isArray(parsed.data) ? parsed.data : parsed.data.blocks;
  await db.transaction(async (tx) => {
    await tx.delete(homepageSections);
    if (blocks.length) await tx.insert(homepageSections).values(blocks);
  });
  return NextResponse.json({ success: true, sections: blocks });
});

export const PUT = saveLayout;
export const POST = saveLayout;
