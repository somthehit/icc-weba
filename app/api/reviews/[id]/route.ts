import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { reviews } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';

const moderationSchema = z.object({ isApproved: z.boolean().optional(), adminResponse: z.string().trim().max(4000).nullable().optional() });

export const PATCH = withRole(['admin', 'sales'], async (request: NextRequest, _auth, context: { params: Promise<{ id: string }> }) => {
  const id = Number((await context.params).id);
  const parsed = moderationSchema.safeParse(await request.json());
  if (!parsed.success || !id) return NextResponse.json({ error: 'Invalid review update' }, { status: 400 });
  const [review] = await db.update(reviews).set({ ...parsed.data, adminResponseAt: parsed.data.adminResponse !== undefined && parsed.data.adminResponse !== null ? new Date() : undefined }).where(eq(reviews.id, id)).returning();
  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  return NextResponse.json({ review });
});
