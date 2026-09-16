import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { contactInquiries, salesLeads } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';

export const POST = withRole(['admin', 'sales'], async (_request: NextRequest, { user }, context: { params: Promise<{ id: string }> }) => { const id = Number((await context.params).id); const [inquiry] = await db.select().from(contactInquiries).where(eq(contactInquiries.id, id)).limit(1); if (!inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 }); if (inquiry.convertedLeadId) return NextResponse.json({ error: 'Inquiry already converted', leadId: inquiry.convertedLeadId }, { status: 409 }); const [lead] = await db.insert(salesLeads).values({ leadNumber: `LEAD-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, fullName: inquiry.fullName, phone: inquiry.phone, email: inquiry.email, request: inquiry.message, createdBy: user.userId }).returning(); await db.update(contactInquiries).set({ convertedLeadId: lead.id, status: 'CONVERTED', updatedAt: new Date() }).where(eq(contactInquiries.id, id)); return NextResponse.json({ lead }, { status: 201 }); });
