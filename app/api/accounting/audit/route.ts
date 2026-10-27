import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffAuditLog } from '@/db/schema/pos-enterprise';
import { desc, eq } from 'drizzle-orm';
import { withAccounting } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

/**
 * GET /api/accounting/audit
 * Returns tamper-evident staff security and access audit logs
 */
export const GET = withAccounting(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const actionFilter = searchParams.get('action');

    let query = db
      .select({
        id: staffAuditLog.id,
        actorId: staffAuditLog.actorId,
        actorName: staffAuditLog.actorName,
        actorRole: staffAuditLog.actorRole,
        action: staffAuditLog.action,
        targetId: staffAuditLog.targetId,
        targetType: staffAuditLog.targetType,
        details: staffAuditLog.details,
        ipAddress: staffAuditLog.ipAddress,
        createdAt: staffAuditLog.createdAt,
      })
      .from(staffAuditLog)
      .orderBy(desc(staffAuditLog.createdAt))
      .limit(100);

    const logs = await query;

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
