import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { marketingCampaigns } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { z } from 'zod';

const campaignSchema = z.object({ name: z.string().trim().min(1).max(150), channel: z.enum(['sms', 'email']), subject: z.string().trim().max(200).optional(), body: z.string().trim().min(1).max(5000), audience: z.record(z.string(), z.unknown()).default({}), recipientCount: z.number().int().min(0).default(0) });

export const POST = withRole(['admin'], async (request: NextRequest, { user }) => {
  const parsed = campaignSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid campaign payload' }, { status: 400 });
  const [campaign] = await db.insert(marketingCampaigns).values({ ...parsed.data, createdBy: user.userId, sentCount: 0, status: 'queued' }).returning();
  return NextResponse.json({ success: true, campaign, message: 'Campaign queued for delivery.' }, { status: 201 });
});
