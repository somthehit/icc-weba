import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffSessions, staff, terminals, staffAuditLog } from '@/db/schema/pos-enterprise';
import { eq, desc, and } from 'drizzle-orm';
import { withRole } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

/**
 * GET /api/accounting/sessions
 * Returns all active and recent POS staff sessions across terminals
 */
export const GET = withRole(['admin', 'sales'], async (request: NextRequest) => {
  try {
    const sessions = await db
      .select({
        id: staffSessions.id,
        staffId: staffSessions.staffId,
        staffName: staff.name,
        staffCode: staff.staffCode,
        staffRole: staff.role,
        terminalId: staffSessions.terminalId,
        terminalCode: staffSessions.terminalCode,
        terminalName: terminals.name,
        ipAddress: staffSessions.ipAddress,
        userAgent: staffSessions.userAgent,
        isRevoked: staffSessions.isRevoked,
        revokedReason: staffSessions.revokedReason,
        lastActiveAt: staffSessions.lastActiveAt,
        createdAt: staffSessions.createdAt,
      })
      .from(staffSessions)
      .innerJoin(staff, eq(staffSessions.staffId, staff.id))
      .leftJoin(terminals, eq(staffSessions.terminalId, terminals.id))
      .orderBy(desc(staffSessions.lastActiveAt))
      .limit(50);

    const activeCount = sessions.filter((s) => !s.isRevoked).length;

    return NextResponse.json({
      success: true,
      sessions,
      summary: {
        totalSessions: sessions.length,
        activeSessions: activeCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

/**
 * POST /api/accounting/sessions
 * Actions: FORCE_LOGOUT, REVOKE_ALL
 */
export const POST = withRole(['admin', 'sales'], async (request: NextRequest, authContext: any) => {
  try {
    const body = await request.json();
    const { action, sessionId, staffId, reason } = body;

    // 1. FORCE_LOGOUT single session
    if (action === 'FORCE_LOGOUT') {
      if (!sessionId) {
        return NextResponse.json({ success: false, error: 'Session ID is required' }, { status: 400 });
      }

      const [updated] = await db
        .update(staffSessions)
        .set({
          isRevoked: true,
          revokedReason: reason || 'Terminated by Administrator via POS Access Control',
        })
        .where(eq(staffSessions.id, sessionId))
        .returning();

      if (!updated) {
        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
      }

      await db.insert(staffAuditLog).values({
        actorName: authContext?.user?.name || 'Admin',
        actorRole: authContext?.user?.role || 'admin',
        action: 'FORCE_LOGOUT',
        targetId: updated.staffId,
        targetType: 'session',
        details: { sessionId, terminalCode: updated.terminalCode, reason },
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      });

      return NextResponse.json({
        success: true,
        message: 'Session revoked immediately. Cashier has been logged out.',
        session: updated,
      });
    }

    // 2. REVOKE_ALL for a staff member
    if (action === 'REVOKE_ALL') {
      if (!staffId) {
        return NextResponse.json({ success: false, error: 'Staff ID is required' }, { status: 400 });
      }

      await db
        .update(staffSessions)
        .set({
          isRevoked: true,
          revokedReason: reason || 'All active sessions revoked by Administrator',
        })
        .where(and(eq(staffSessions.staffId, staffId), eq(staffSessions.isRevoked, false)));

      await db.insert(staffAuditLog).values({
        actorName: authContext?.user?.name || 'Admin',
        actorRole: authContext?.user?.role || 'admin',
        action: 'REVOKE_ALL_SESSIONS',
        targetId: staffId,
        targetType: 'staff',
        details: { staffId, reason },
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      });

      return NextResponse.json({
        success: true,
        message: 'All concurrent sessions for staff member have been terminated.',
      });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Error in sessions route POST:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
