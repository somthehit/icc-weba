import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { serviceActivityLogs, serviceTickets } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { serviceStatusSchema } from '@/lib/validation/services';

export const PATCH = withRole(['admin', 'service_technician'], async (request: NextRequest, { user }, context: { params: Promise<{ id: string }> }) => { const id = Number((await context.params).id); const parsed = serviceStatusSchema.safeParse(await request.json()); if (!parsed.success || !id) return NextResponse.json({ error: 'Invalid status update' }, { status: 400 }); const { note, ...data } = parsed.data; const [ticket] = await db.transaction(async (tx) => { const [updated] = await tx.update(serviceTickets).set({ ...data, updatedAt: new Date(), resolvedAt: data.workflowStatus === 'DELIVERED_CLOSED' ? new Date() : undefined }).where(eq(serviceTickets.id, id)).returning(); if (updated) await tx.insert(serviceActivityLogs).values({ ticketId: id, activityType: 'STATUS_CHANGE', message: note || `Status changed to ${data.workflowStatus}.`, createdBy: user.userId }); return [updated]; }); if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 }); return NextResponse.json({ ticket }); });
