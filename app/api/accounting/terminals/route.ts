import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { terminals, staffTerminals, staff, staffSessions, staffAuditLog } from '@/db/schema/pos-enterprise';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import { withRole } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

/**
 * GET /api/accounting/terminals
 * Returns registered POS devices with status, network telemetry, and assigned staff
 */
export const GET = withRole(['admin', 'sales'], async (request: NextRequest) => {
  try {
    const allTerminals = await db
      .select({
        id: terminals.id,
        code: terminals.code,
        name: terminals.name,
        branchId: terminals.branchId,
        isLocked: terminals.isLocked,
        active: terminals.active,
        status: terminals.status,
        lastSeenAt: terminals.lastSeenAt,
        ipAddress: terminals.ipAddress,
        macAddress: terminals.macAddress,
        createdAt: terminals.createdAt,
      })
      .from(terminals)
      .orderBy(terminals.code);

    // Fetch staff assigned to terminals
    const assignments = await db
      .select({
        terminalId: staffTerminals.terminalId,
        staffId: staffTerminals.staffId,
        staffCode: staff.staffCode,
        staffName: staff.name,
        staffRole: staff.role,
        allowedDays: staffTerminals.allowedDays,
        allowedStartTime: staffTerminals.allowedStartTime,
        allowedEndTime: staffTerminals.allowedEndTime,
        isPrimary: staffTerminals.isPrimary,
      })
      .from(staffTerminals)
      .innerJoin(staff, eq(staffTerminals.staffId, staff.id));

    // Fetch active sessions for each terminal
    const activeSessions = await db
      .select({
        terminalId: staffSessions.terminalId,
        staffId: staffSessions.staffId,
        staffName: staff.name,
        staffCode: staff.staffCode,
        lastActiveAt: staffSessions.lastActiveAt,
      })
      .from(staffSessions)
      .innerJoin(staff, eq(staffSessions.staffId, staff.id))
      .where(eq(staffSessions.isRevoked, false));

    const enriched = allTerminals.map((t) => {
      const assigned = assignments.filter((a) => a.terminalId === t.id);
      const currentSession = activeSessions.find((s) => s.terminalId === t.id);

      return {
        ...t,
        assignedStaff: assigned,
        activeSession: currentSession || null,
        isOnline: t.lastSeenAt ? Date.now() - new Date(t.lastSeenAt).getTime() < 30 * 60 * 1000 : false,
      };
    });

    return NextResponse.json({
      success: true,
      terminals: enriched,
    });
  } catch (error: any) {
    console.error('Error fetching terminals:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

/**
 * POST /api/accounting/terminals
 * Actions: APPROVE_DEVICE, REVOKE_DEVICE, RENAME_DEVICE, REGISTER_DEVICE, ASSIGN_STAFF
 */
export const POST = withRole(['admin', 'sales'], async (request: NextRequest, authContext: any) => {
  try {
    const body = await request.json();
    const { action } = body;

    // 1. APPROVE_DEVICE
    if (action === 'APPROVE_DEVICE') {
      const { terminalId } = body;
      if (!terminalId) return NextResponse.json({ success: false, error: 'Terminal ID is required' }, { status: 400 });

      const [updated] = await db
        .update(terminals)
        .set({
          status: 'approved',
          isLocked: false,
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(terminals.id, terminalId))
        .returning();

      await db.insert(staffAuditLog).values({
        actorName: authContext?.user?.name || 'Admin',
        actorRole: authContext?.user?.role || 'admin',
        action: 'DEVICE_APPROVED',
        targetId: terminalId,
        targetType: 'terminal',
        details: { code: updated.code, name: updated.name },
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      });

      return NextResponse.json({
        success: true,
        message: `Device ${updated.code} has been approved for POS operations.`,
        terminal: updated,
      });
    }

    // 2. REVOKE_DEVICE
    if (action === 'REVOKE_DEVICE') {
      const { terminalId, reason } = body;
      if (!terminalId) return NextResponse.json({ success: false, error: 'Terminal ID is required' }, { status: 400 });

      const [updated] = await db
        .update(terminals)
        .set({
          status: 'revoked',
          isLocked: true,
          updatedAt: new Date(),
        })
        .where(eq(terminals.id, terminalId))
        .returning();

      // Revoke any active sessions on this terminal
      await db
        .update(staffSessions)
        .set({ isRevoked: true, revokedReason: `Terminal ${updated.code} access revoked: ${reason || 'Admin action'}` })
        .where(eq(staffSessions.terminalId, terminalId));

      await db.insert(staffAuditLog).values({
        actorName: authContext?.user?.name || 'Admin',
        actorRole: authContext?.user?.role || 'admin',
        action: 'DEVICE_REVOKED',
        targetId: terminalId,
        targetType: 'terminal',
        details: { code: updated.code, reason },
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      });

      return NextResponse.json({
        success: true,
        message: `Device ${updated.code} revoked and active sessions terminated.`,
        terminal: updated,
      });
    }

    // 3. RENAME_DEVICE
    if (action === 'RENAME_DEVICE') {
      const { terminalId, name, branchId } = body;
      if (!terminalId || !name) {
        return NextResponse.json({ success: false, error: 'Terminal ID and Name are required' }, { status: 400 });
      }

      const [updated] = await db
        .update(terminals)
        .set({ name: name.trim(), branchId: branchId || 'Main - Dhangadhi' })
        .where(eq(terminals.id, terminalId))
        .returning();

      return NextResponse.json({
        success: true,
        message: `Terminal renamed to "${updated.name}".`,
        terminal: updated,
      });
    }

    // 4. REGISTER_DEVICE
    if (action === 'REGISTER_DEVICE') {
      const { code, name, branchId = 'Main - Dhangadhi' } = body;
      if (!code || !name) {
        return NextResponse.json({ success: false, error: 'Terminal Code and Name are required' }, { status: 400 });
      }

      const [created] = await db
        .insert(terminals)
        .values({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          branchId,
          status: 'pending_approval',
          isLocked: true,
          active: true,
        })
        .returning();

      await db.insert(staffAuditLog).values({
        actorName: authContext?.user?.name || 'Admin',
        actorRole: authContext?.user?.role || 'admin',
        action: 'DEVICE_REGISTERED',
        targetId: created.id,
        targetType: 'terminal',
        details: { code: created.code, name: created.name },
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      });

      return NextResponse.json({
        success: true,
        message: `Device ${created.code} registered. Pending Administrator approval.`,
        terminal: created,
      });
    }

    // 5. ASSIGN_STAFF_TERMINAL
    if (action === 'ASSIGN_STAFF_TERMINAL') {
      const { staffId, terminalId, allowedDays, allowedStartTime, allowedEndTime } = body;
      if (!staffId || !terminalId) {
        return NextResponse.json({ success: false, error: 'Staff ID and Terminal ID are required' }, { status: 400 });
      }

      await db
        .insert(staffTerminals)
        .values({
          staffId,
          terminalId,
          allowedDays: allowedDays || ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
          allowedStartTime: allowedStartTime || '09:00',
          allowedEndTime: allowedEndTime || '20:30',
          isPrimary: true,
        })
        .onConflictDoUpdate({
          target: [staffTerminals.staffId, staffTerminals.terminalId],
          set: {
            allowedDays: allowedDays || ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
            allowedStartTime: allowedStartTime || '09:00',
            allowedEndTime: allowedEndTime || '20:30',
          },
        });

      return NextResponse.json({
        success: true,
        message: 'Staff terminal binding updated with operating schedule.',
      });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Error in terminals route POST:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
