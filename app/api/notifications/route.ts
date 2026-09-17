import { NextResponse } from 'next/server';
import { eq, desc, sql } from 'drizzle-orm';

import { db } from '@/db';
import { notifications } from '@/db/schema';
import { withAuth } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { z } from 'zod';

/**
 * Customer notification inbox.
 *
 * GET  — list all notifications for the authenticated user (newest first)
 * PUT  — mark one as read, or mark all as read
 */

const markReadSchema = z.object({
  id: z.string().optional(),
  markAll: z.boolean().optional(),
});

export const GET = withAuth(async (_request, { user }) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return NextResponse.json({
      notifications: rows.map((r) => ({
        id: String(r.id),
        title: r.title,
        message: r.message,
        time: formatTimeAgo(r.createdAt),
        unread: !r.read,
        type: r.type,
      })),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
});

export const PUT = withAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, markReadSchema);
    if (!parsed.ok) return parsed.response;

    const { id, markAll } = parsed.data;

    if (markAll) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, user.userId));
      return NextResponse.json({ success: true });
    }

    if (id) {
      const notifId = parseInt(id, 10);
      if (isNaN(notifId)) {
        return NextResponse.json({ error: 'Invalid notification id' }, { status: 400 });
      }
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, notifId));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Provide id or markAll' }, { status: 400 });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
});

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hr ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-NP', { month: 'short', day: 'numeric' });
}
