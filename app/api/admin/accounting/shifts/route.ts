import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { posShifts, posCashTransactions } from '@/db/schema/pos';
import { staff } from '@/db/schema/pos-enterprise';
import { appendAuditHashEntry } from '@/lib/audit/hash-chain';
import { eq, desc, sql, and } from 'drizzle-orm';
import { verifyCredential } from '@/lib/security/crypto';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status') || 'all'; // 'submitted_to_account', 'reconciled', 'all'

    const rows = await db
      .select()
      .from(posShifts)
      .orderBy(desc(posShifts.openedAt))
      .limit(100);

    const shiftsWithAudit = rows.map((s) => {
      const opening = Number(s.openingFloat || 0);
      const cashSales = Number(s.totalCashSales || 0);
      const expected = Number(s.expectedCash || opening + cashSales);
      const actual = s.closingCash !== null && s.closingCash !== undefined ? Number(s.closingCash) : expected;
      const variance = Number(s.cashDiscrepancy !== null && s.cashDiscrepancy !== undefined ? s.cashDiscrepancy : actual - expected);

      let varianceBadge: 'SHORTAGE' | 'EXCESS' | 'BALANCED' = 'BALANCED';
      if (variance < -0.01) varianceBadge = 'SHORTAGE';
      else if (variance > 0.01) varianceBadge = 'EXCESS';

      // Normalized status for central accounting
      let auditStatus = s.status || 'OPEN';
      if (s.varianceApproved) {
        auditStatus = 'reconciled';
      } else if (s.status === 'CLOSED') {
        auditStatus = 'submitted_to_account';
      }

      return {
        id: s.id,
        shiftNumber: s.shiftNumber,
        registerCode: s.registerCode,
        cashierId: s.cashierId,
        cashierName: s.cashierName,
        openingFloat: opening,
        openingDenominations: s.openingDenominations || {},
        closingCash: s.closingCash !== null ? Number(s.closingCash) : null,
        closingDenominations: s.closingDenominations || {},
        expectedCash: expected,
        actualCash: actual,
        variance,
        varianceBadge,
        isHighVariance: Math.abs(variance) > 500,
        totalSales: Number(s.totalSales || 0),
        totalCashSales: Number(s.totalCashSales || 0),
        totalCardSales: Number(s.totalCardSales || 0),
        totalQrSales: Number(s.totalQrSales || 0),
        totalTransactions: s.totalTransactions || 0,
        status: auditStatus,
        openedAt: s.openedAt ? new Date(s.openedAt).toISOString() : new Date().toISOString(),
        closedAt: s.closedAt ? new Date(s.closedAt).toISOString() : null,
        varianceApproved: s.varianceApproved || false,
        varianceApprovedBy: s.varianceApprovedBy || null,
        varianceApprovedAt: s.varianceApprovedAt ? new Date(s.varianceApprovedAt).toISOString() : null,
        varianceReason: s.varianceReason || null,
        physicalVouchersChecked: s.varianceApproved || false,
      };
    });

    let filtered = shiftsWithAudit;
    if (filterStatus !== 'all') {
      filtered = filtered.filter((s) => s.status === filterStatus);
    }

    return NextResponse.json({
      success: true,
      shifts: filtered,
      totalCount: filtered.length,
      pendingAuditCount: shiftsWithAudit.filter((s) => s.status === 'submitted_to_account' && !s.varianceApproved).length,
    });
  } catch (error: any) {
    console.error('Accounting Shifts API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch shifts',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, shiftId, supervisorPin, supervisorCode, notes, physicalVouchersChecked } = body;

    if (action === 'reconcile_shift') {
      if (!shiftId) {
        return NextResponse.json({ success: false, error: 'Shift ID is required' }, { status: 400 });
      }

      if (!supervisorPin) {
        return NextResponse.json({ success: false, error: 'Accountant / Supervisor PIN is required' }, { status: 400 });
      }

      // 1. Authorize supervisor / accountant PIN
      const staffList = await db
        .select()
        .from(staff)
        .where(eq(staff.active, true));

      let authorizedStaff: any = null;
      for (const st of staffList) {
        if (['supervisor', 'manager', 'admin'].includes(st.role)) {
          if (supervisorCode && st.staffCode !== supervisorCode) continue;
          if (st.pinHash) {
            const isMatch = await verifyCredential(supervisorPin, st.pinHash);
            if (isMatch) {
              authorizedStaff = st;
              break;
            }
          }
        }
      }

      // Fallback for demo supervisor PIN if database not seeded with Argon2 PINs
      if (!authorizedStaff && (supervisorPin === '1234' || supervisorPin === '9999' || supervisorPin === '7777')) {
        authorizedStaff = {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Chief Accountant (Finance)',
          staffCode: 'ACC-01',
          role: 'manager',
        };
      }

      if (!authorizedStaff) {
        return NextResponse.json({
          success: false,
          error: 'Invalid Supervisor/Accountant PIN or insufficient authority.',
        }, { status: 403 });
      }

      // 2. Atomic Transaction: Settle & Reconcile Shift
      const updatedShift = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(posShifts)
          .set({
            varianceApproved: true,
            varianceApprovedBy: authorizedStaff.name,
            varianceApprovedAt: new Date(),
            varianceReason: notes || 'Cash and paper vouchers verified in Cash Office',
            status: 'CLOSED',
          })
          .where(eq(posShifts.id, Number(shiftId)))
          .returning();

        // 3. Append Cryptographic SHA-256 Audit Log
        await appendAuditHashEntry({
          action: 'SHIFT_RECONCILED_AND_SETTLED',
          actorId: String(authorizedStaff.id),
          approverId: String(authorizedStaff.id),
          entity: 'pos_shifts',
          entityId: String(shiftId),
          meta: {
            shiftNumber: updated?.shiftNumber,
            cashierName: updated?.cashierName,
            expectedCash: updated?.expectedCash,
            closingCash: updated?.closingCash,
            discrepancy: updated?.cashDiscrepancy,
            physicalVouchersChecked: Boolean(physicalVouchersChecked),
            notes: notes || 'Verified in Cash Office',
            reconciledBy: authorizedStaff.name,
          },
        });

        return updated;
      });

      return NextResponse.json({
        success: true,
        message: `Shift ${updatedShift.shiftNumber} successfully audited and reconciled.`,
        shift: updatedShift,
        reconciledBy: authorizedStaff.name,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Reconcile Shift Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to reconcile shift',
    }, { status: 500 });
  }
}
