import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  staff,
  staffLimits,
  staffTerminals,
  terminals,
  pinHistory,
  pinResetRequests,
  staffSessions,
  staffAuditLog,
} from '@/db/schema/pos-enterprise';
import { posShifts } from '@/db/schema/pos';
import { eq, desc, sql, and, or, inArray } from 'drizzle-orm';
import { withAccounting } from '@/lib/auth/middleware';
import { hashCredential, verifyCredential } from '@/lib/security/crypto';
import { validatePinStrength, generateSecureTempPin } from '@/lib/security/pin-policy';

export const dynamic = 'force-dynamic';

const ROLE_METADATA: Record<
  string,
  { label: string; color: string; category: 'pos_staff' | 'back_office' }
> = {
  admin: { label: 'System Administrator', color: 'rose', category: 'back_office' },
  store_manager: { label: 'Store Manager', color: 'purple', category: 'pos_staff' },
  manager: { label: 'Store Manager', color: 'purple', category: 'pos_staff' },
  supervisor: { label: 'Floor Supervisor', color: 'indigo', category: 'pos_staff' },
  senior_cashier: { label: 'Senior Cashier', color: 'blue', category: 'pos_staff' },
  cashier: { label: 'Counter Cashier', color: 'emerald', category: 'pos_staff' },
  accountant: { label: 'Accountant', color: 'teal', category: 'back_office' },
  auditor: { label: 'Auditor', color: 'cyan', category: 'back_office' },
  inventory_manager: { label: 'Inventory Manager', color: 'amber', category: 'back_office' },
  sales_manager: { label: 'Sales Manager', color: 'orange', category: 'back_office' },
};

/**
 * GET /api/accounting/cashiers
 * Returns the enterprise staff roster, assigned terminals, and computed shift performance metrics
 */
export const GET = withAccounting(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase().trim() || '';
    const roleFilter = searchParams.get('role') || 'all';
    const statusFilter = searchParams.get('status') || 'all';
    const categoryFilter = searchParams.get('category') || 'all';
    const sortBy = searchParams.get('sortBy') || 'name';

    // 1. Fetch all staff members
    const allStaff = await db
      .select()
      .from(staff)
      .orderBy(staff.name);

    // 2. Fetch all shifts to compute accurate live metrics
    const allShifts = await db
      .select({
        id: posShifts.id,
        shiftNumber: posShifts.shiftNumber,
        registerCode: posShifts.registerCode,
        cashierCode: posShifts.cashierCode,
        cashierName: posShifts.cashierName,
        totalSales: posShifts.totalSales,
        expectedCash: posShifts.expectedCash,
        closingCash: posShifts.closingCash,
        cashDiscrepancy: posShifts.cashDiscrepancy,
        status: posShifts.status,
        openedAt: posShifts.openedAt,
        closedAt: posShifts.closedAt,
      })
      .from(posShifts)
      .orderBy(desc(posShifts.openedAt));

    // 3. Fetch terminal assignments
    const terminalLinks = await db
      .select({
        staffId: staffTerminals.staffId,
        terminalId: staffTerminals.terminalId,
        terminalCode: terminals.code,
        terminalName: terminals.name,
      })
      .from(staffTerminals)
      .leftJoin(terminals, eq(staffTerminals.terminalId, terminals.id));

    // 4. Fetch limits
    const limitsList = await db.select().from(staffLimits);
    const limitsMap = new Map(limitsList.map((l) => [l.staffId, l]));

    // 5. Aggregate stats per staff member
    const now = new Date();
    const staffProfiles = allStaff.map((member) => {
      const meta = ROLE_METADATA[member.role] || {
        label: member.role,
        color: 'slate',
        category: 'pos_staff',
      };

      // Match shifts by code or name
      const userShifts = allShifts.filter((s) => {
        if (s.cashierCode && s.cashierCode.toLowerCase() === member.staffCode.toLowerCase()) return true;
        if (s.cashierName && member.name && s.cashierName.toLowerCase().includes(member.name.toLowerCase().split(' ')[0])) return true;
        return false;
      });

      const totalShifts = userShifts.length;
      let totalSales = 0;
      let totalShort = 0;
      let totalOver = 0;
      let totalNetVariance = 0;
      let varianceIncidents = 0;
      let balancedShifts = 0;

      for (const s of userShifts) {
        totalSales += Number(s.totalSales || 0);
        const disc = Number(s.cashDiscrepancy || 0);
        totalNetVariance += disc;

        if (disc < 0) {
          totalShort += Math.abs(disc);
        } else if (disc > 0) {
          totalOver += disc;
        }

        if (Math.abs(disc) < 1) {
          balancedShifts++;
        }

        if (Math.abs(disc) > 100) {
          varianceIncidents++;
        }
      }

      const avgVariancePerShift = totalShifts > 0 ? Number((totalNetVariance / totalShifts).toFixed(2)) : 0;
      const accuracyRate = totalShifts > 0 ? Number(((balancedShifts / totalShifts) * 100).toFixed(1)) : 100.0;

      // Anomaly detection flags
      const isShortageRepeated = varianceIncidents >= 2;
      const isNetHigh = Math.abs(totalNetVariance) > 1500;
      const anomalyFlag = isShortageRepeated || isNetHigh;

      // PIN Status Calculation
      let pinStatus: 'SET' | 'TEMPORARY' | 'LOCKED' | 'NOT_SET' = 'NOT_SET';
      if (member.pinLockedUntil && new Date(member.pinLockedUntil) > now) {
        pinStatus = 'LOCKED';
      } else if (member.mustChangePin) {
        pinStatus = 'TEMPORARY';
      } else if (member.pinHash) {
        pinStatus = 'SET';
      }

      // Terminals assigned
      const assignedTerms = terminalLinks
        .filter((t) => t.staffId === member.id && t.terminalCode)
        .map((t) => t.terminalCode as string);

      const limits = limitsMap.get(member.id) || null;

      return {
        id: member.id,
        staffCode: member.staffCode,
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        roleLabel: meta.label,
        roleColor: meta.color,
        category: meta.category,
        status: member.status || (member.active ? 'active' : 'suspended'),
        active: member.active,
        branchId: member.branchId || 'MAIN',
        defaultShift: member.defaultShift || 'morning',
        emergencyContact: member.emergencyContact,
        notes: member.notes,
        joinDate: member.joinDate,
        pinStatus,
        hasPin: Boolean(member.pinHash),
        pinChangedAt: member.pinChangedAt,
        failedPinAttempts: member.failedPinAttempts || 0,
        pinLockedUntil: member.pinLockedUntil,
        lastLoginAt: member.lastLoginAt,
        lastLoginIp: member.lastLoginIp,
        lastTerminalCode: member.lastTerminalCode,
        assignedTerminals: assignedTerms,
        limits,
        metrics: {
          totalShifts,
          totalSales,
          totalShort,
          totalOver,
          totalNetVariance,
          avgVariancePerShift,
          varianceIncidents,
          balancedShifts,
          accuracyRate,
          anomalyFlag,
        },
      };
    });

    // 6. Filter results
    let filtered = staffProfiles;

    if (search) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.staffCode.toLowerCase().includes(search) ||
          (s.phone && s.phone.includes(search)) ||
          (s.email && s.email.toLowerCase().includes(search))
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((s) => s.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((s) => s.category === categoryFilter);
    }

    // 7. Sort
    if (sortBy === 'shifts') {
      filtered.sort((a, b) => b.metrics.totalShifts - a.metrics.totalShifts);
    } else if (sortBy === 'variance') {
      filtered.sort((a, b) => Math.abs(b.metrics.totalNetVariance) - Math.abs(a.metrics.totalNetVariance));
    } else if (sortBy === 'code') {
      filtered.sort((a, b) => a.staffCode.localeCompare(b.staffCode));
    } else {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Summary calculations
    const posStaffOnly = staffProfiles.filter((s) => s.category === 'pos_staff');
    const totalPosSales = posStaffOnly.reduce((acc, s) => acc + s.metrics.totalSales, 0);
    const totalPosShifts = posStaffOnly.reduce((acc, s) => acc + s.metrics.totalShifts, 0);
    const netPosVariance = posStaffOnly.reduce((acc, s) => acc + s.metrics.totalNetVariance, 0);
    const anomaliesCount = posStaffOnly.filter((s) => s.metrics.anomalyFlag).length;

    return NextResponse.json({
      success: true,
      staff: filtered,
      summary: {
        totalStaff: staffProfiles.length,
        activeCashiers: staffProfiles.filter((s) => s.role.includes('cashier') && s.status === 'active').length,
        totalPosShifts,
        totalPosSales,
        netPosVariance,
        anomaliesCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching cashiers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

/**
 * POST /api/accounting/cashiers
 * Enterprise mutations: Create Staff, Update Staff, Secure PIN Reset (Maker-Checker), Unlock PIN, Soft-Delete
 */
export const POST = withAccounting(async (request: NextRequest, authContext: any) => {
  try {
    const body = await request.json();
    const { action } = body;

    // =========================================================================
    // ACTION 1: CREATE_STAFF
    // =========================================================================
    if (action === 'CREATE_STAFF') {
      const {
        name,
        staffCode,
        phone,
        email,
        role = 'cashier',
        initialPin,
        branchId = 'Main - Dhangadhi',
        defaultShift = 'morning',
        emergencyContact,
        notes,
      } = body;

      if (!name || !staffCode || !phone) {
        return NextResponse.json(
          { success: false, error: 'Full name, unique Staff Code, and Phone number are required.' },
          { status: 400 }
        );
      }

      const cleanCode = staffCode.trim().toUpperCase();
      const cleanPhone = phone.trim();

      // Check unique staff code
      const existingCode = await db.select({ id: staff.id }).from(staff).where(eq(staff.staffCode, cleanCode));
      if (existingCode.length > 0) {
        return NextResponse.json(
          { success: false, error: `Staff code "${cleanCode}" is already in use.` },
          { status: 400 }
        );
      }

      // Check unique phone
      const existingPhone = await db.select({ id: staff.id }).from(staff).where(eq(staff.phone, cleanPhone));
      if (existingPhone.length > 0) {
        return NextResponse.json(
          { success: false, error: `Phone number "${cleanPhone}" is already registered to another staff member.` },
          { status: 400 }
        );
      }

      // Validate PIN Strength if provided
      let pinHash: string | null = null;
      if (initialPin) {
        const pinCheck = validatePinStrength(initialPin);
        if (!pinCheck.valid) {
          return NextResponse.json(
            { success: false, error: pinCheck.reason || 'Weak PIN rejected by security policy.' },
            { status: 400 }
          );
        }
        pinHash = await hashCredential(initialPin);
      }

      const defaultPasswordHash = await hashCredential('Welcome@123');

      // Insert new staff member
      const [newStaff] = await db
        .insert(staff)
        .values({
          staffCode: cleanCode,
          name: name.trim(),
          email: email?.trim() || null,
          phone: cleanPhone,
          role: role as any,
          passwordHash: defaultPasswordHash,
          pinHash,
          status: 'active',
          branchId,
          defaultShift,
          emergencyContact: emergencyContact?.trim() || null,
          notes: notes?.trim() || null,
          mustChangePassword: true,
          mustChangePin: Boolean(initialPin),
          active: true,
          joinDate: sql`CURRENT_DATE`,
          pinChangedAt: pinHash ? sql`NOW()` : null,
        })
        .returning();

      // If PIN was set, record in pin_history
      if (pinHash && newStaff?.id) {
        await db.insert(pinHistory).values({
          staffId: newStaff.id,
          pinHash,
        });
      }

      // Create default staff_limits
      if (newStaff?.id) {
        const isSupervisor = role === 'admin' || role === 'store_manager' || role === 'supervisor';
        await db.insert(staffLimits).values({
          staffId: newStaff.id,
          maxLineDiscountPct: isSupervisor ? 25.0 : 7.5,
          maxInvoiceDiscountAmount: isSupervisor ? 15000.0 : 1500.0,
          maxRefundAmount: isSupervisor ? 50000.0 : 5000.0,
          maxVoidAmount: isSupervisor ? 50000.0 : 3000.0,
          canOverridePrice: isSupervisor,
          canNoSaleOpen: isSupervisor,
          maxCashPayout: isSupervisor ? 25000.0 : 2000.0,
          canCreditSale: isSupervisor,
          returnWindowDays: isSupervisor ? 30 : 7,
        });

        // Audit Log
        await db.insert(staffAuditLog).values({
          actorName: authContext?.user?.name || 'Admin',
          actorRole: authContext?.user?.role || 'admin',
          action: 'STAFF_CREATED',
          targetId: newStaff.id,
          targetType: 'staff',
          details: { staffCode: cleanCode, name: newStaff.name, role },
          ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        });
      }

      return NextResponse.json({
        success: true,
        message: `Staff member ${newStaff.name} (${cleanCode}) created successfully.`,
        staff: newStaff,
      });
    }

    // =========================================================================
    // ACTION 2: UPDATE_STAFF
    // =========================================================================
    if (action === 'UPDATE_STAFF') {
      const { staffId, name, phone, email, role, status, branchId, defaultShift, emergencyContact, notes } = body;

      if (!staffId) {
        return NextResponse.json({ success: false, error: 'Staff ID is required.' }, { status: 400 });
      }

      const [existing] = await db.select().from(staff).where(eq(staff.id, staffId));
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Staff member not found.' }, { status: 404 });
      }

      const updates: any = { updatedAt: sql`NOW()` };
      if (name) updates.name = name.trim();
      if (phone) updates.phone = phone.trim();
      if (email !== undefined) updates.email = email ? email.trim() : null;
      if (role) updates.role = role;
      if (status) {
        updates.status = status;
        updates.active = status === 'active';
      }
      if (branchId) updates.branchId = branchId;
      if (defaultShift) updates.defaultShift = defaultShift;
      if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact;
      if (notes !== undefined) updates.notes = notes;

      const [updated] = await db.update(staff).set(updates).where(eq(staff.id, staffId)).returning();

      // If suspended or terminated, revoke sessions immediately
      if (status && status !== 'active') {
        await db
          .update(staffSessions)
          .set({ isRevoked: true, revokedReason: `Staff status changed to ${status}` })
          .where(eq(staffSessions.staffId, staffId));
      }

      await db.insert(staffAuditLog).values({
        actorName: authContext?.user?.name || 'Admin',
        actorRole: authContext?.user?.role || 'admin',
        action: 'STAFF_UPDATED',
        targetId: staffId,
        targetType: 'staff',
        details: { before: { name: existing.name, role: existing.role, status: existing.status }, after: updates },
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      });

      return NextResponse.json({
        success: true,
        message: `Profile updated for ${updated.name}.`,
        staff: updated,
      });
    }

    // =========================================================================
    // ACTION 3: SECURE_RESET_PIN (Maker-Checker flow)
    // =========================================================================
    if (action === 'SECURE_RESET_PIN') {
      const { staffId, authorizerPin, reason } = body;

      if (!staffId) {
        return NextResponse.json({ success: false, error: 'Target staff member is required.' }, { status: 400 });
      }
      if (!authorizerPin) {
        return NextResponse.json({ success: false, error: 'Authorizer PIN is required for maker-checker approval.' }, { status: 400 });
      }
      if (!reason || reason.trim().length < 5) {
        return NextResponse.json({ success: false, error: 'A valid written justification (at least 5 characters) is required.' }, { status: 400 });
      }

      const [target] = await db.select().from(staff).where(eq(staff.id, staffId));
      if (!target) {
        return NextResponse.json({ success: false, error: 'Target staff member not found.' }, { status: 404 });
      }

      // Verify Authorizer
      // Find all supervisors/managers/admins in staff table to verify the authorizer PIN
      const potentialApprovers = await db
        .select()
        .from(staff)
        .where(
          and(
            inArray(staff.role, ['admin', 'store_manager', 'manager', 'supervisor']),
            eq(staff.active, true)
          )
        );

      let verifiedApprover: any = null;
      for (const approver of potentialApprovers) {
        if (approver.pinHash) {
          const match = await verifyCredential(approver.pinHash, authorizerPin);
          if (match) {
            verifiedApprover = approver;
            break;
          }
        }
      }

      if (!verifiedApprover) {
        return NextResponse.json(
          { success: false, error: 'Invalid Authorizer PIN. Supervisor or Administrator authority required.' },
          { status: 403 }
        );
      }

      // MAKER-CHECKER SECURITY RULES:
      // 1. Admin cannot reset their own PIN without a SECOND Admin
      if (target.id === verifiedApprover.id && target.role === 'admin') {
        return NextResponse.json(
          { success: false, error: 'Maker-Checker Violation: An Administrator cannot reset their own PIN. A second Administrator must authorize.' },
          { status: 403 }
        );
      }

      // 2. A Supervisor/Manager cannot reset an Administrator's PIN
      if (target.role === 'admin' && verifiedApprover.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Access Denied: Only a System Administrator can authorize a PIN reset for an Admin account.' },
          { status: 403 }
        );
      }

      // Generate a non-trivial temporary 6-digit PIN
      const tempPin = generateSecureTempPin();
      const tempPinHash = await hashCredential(tempPin);

      // Check pin history to avoid immediate reuse
      const recentPins = await db
        .select({ pinHash: pinHistory.pinHash })
        .from(pinHistory)
        .where(eq(pinHistory.staffId, target.id))
        .orderBy(desc(pinHistory.createdAt))
        .limit(3);

      for (const p of recentPins) {
        const isReused = await verifyCredential(p.pinHash, tempPin);
        if (isReused) {
          // Re-generate if conflict
          break;
        }
      }

      // Update staff with temporary PIN
      await db
        .update(staff)
        .set({
          pinHash: tempPinHash,
          mustChangePin: true,
          failedPinAttempts: 0,
          pinLockedUntil: null,
          pinChangedAt: sql`NOW()`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(staff.id, target.id));

      // Record in pin_reset_requests
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry
      await db.insert(pinResetRequests).values({
        staffId: target.id,
        approvedById: verifiedApprover.id,
        tempPinHash,
        reason: reason.trim(),
        status: 'approved',
        expiresAt,
      });

      // Record in pin_history
      await db.insert(pinHistory).values({
        staffId: target.id,
        pinHash: tempPinHash,
      });

      // Tamper-evident Audit Log
      await db.insert(staffAuditLog).values({
        actorId: verifiedApprover.id,
        actorName: verifiedApprover.name,
        actorRole: verifiedApprover.role,
        action: 'PIN_RESET_AUTHORIZED',
        targetId: target.id,
        targetType: 'staff',
        details: {
          targetStaffCode: target.staffCode,
          targetName: target.name,
          reason: reason.trim(),
          approverCode: verifiedApprover.staffCode,
        },
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      });

      return NextResponse.json({
        success: true,
        tempPin,
        expiresAt: expiresAt.toISOString(),
        authorizerName: verifiedApprover.name,
        message: `Temporary PIN generated for ${target.name}. Must be changed upon first login.`,
      });
    }

    // =========================================================================
    // ACTION 4: UNLOCK_PIN
    // =========================================================================
    if (action === 'UNLOCK_PIN') {
      const { staffId, authorizerPin, reason } = body;

      if (!staffId || !authorizerPin) {
        return NextResponse.json({ success: false, error: 'Staff ID and Authorizer PIN required.' }, { status: 400 });
      }

      // Verify authorizer
      const potentialApprovers = await db
        .select()
        .from(staff)
        .where(
          and(
            inArray(staff.role, ['admin', 'store_manager', 'manager', 'supervisor']),
            eq(staff.active, true)
          )
        );

      let verifiedApprover: any = null;
      for (const approver of potentialApprovers) {
        if (approver.pinHash) {
          const match = await verifyCredential(approver.pinHash, authorizerPin);
          if (match) {
            verifiedApprover = approver;
            break;
          }
        }
      }

      if (!verifiedApprover) {
        return NextResponse.json({ success: false, error: 'Invalid Supervisor/Admin PIN.' }, { status: 403 });
      }

      await db
        .update(staff)
        .set({
          failedPinAttempts: 0,
          pinLockedUntil: null,
          updatedAt: sql`NOW()`,
        })
        .where(eq(staff.id, staffId));

      await db.insert(staffAuditLog).values({
        actorId: verifiedApprover.id,
        actorName: verifiedApprover.name,
        actorRole: verifiedApprover.role,
        action: 'PIN_UNLOCKED',
        targetId: staffId,
        targetType: 'staff',
        details: { reason: reason || 'Manual unlock by supervisor' },
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      });

      return NextResponse.json({
        success: true,
        message: 'Account unlocked successfully. Failed attempt counter cleared.',
      });
    }

    // =========================================================================
    // ACTION 5: TOGGLE_STATUS (Soft delete / status management)
    // =========================================================================
    if (action === 'TOGGLE_STATUS') {
      const { staffId, status: newStatus } = body;

      if (!staffId || !newStatus) {
        return NextResponse.json({ success: false, error: 'Staff ID and status are required.' }, { status: 400 });
      }

      const validStatuses = ['active', 'suspended', 'terminated'];
      if (!validStatuses.includes(newStatus)) {
        return NextResponse.json({ success: false, error: 'Invalid status value.' }, { status: 400 });
      }

      const [updated] = await db
        .update(staff)
        .set({
          status: newStatus,
          active: newStatus === 'active',
          updatedAt: sql`NOW()`,
        })
        .where(eq(staff.id, staffId))
        .returning();

      if (newStatus !== 'active') {
        // Revoke all sessions
        await db
          .update(staffSessions)
          .set({ isRevoked: true, revokedReason: `Staff set to ${newStatus}` })
          .where(eq(staffSessions.staffId, staffId));
      }

      await db.insert(staffAuditLog).values({
        actorName: authContext?.user?.name || 'Admin',
        actorRole: authContext?.user?.role || 'admin',
        action: 'STAFF_STATUS_CHANGED',
        targetId: staffId,
        targetType: 'staff',
        details: { newStatus },
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      });

      return NextResponse.json({
        success: true,
        message: `Staff status updated to ${newStatus.toUpperCase()}.`,
        staff: updated,
      });
    }

    return NextResponse.json({ success: false, error: `Unrecognized action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Error in staff route POST:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
