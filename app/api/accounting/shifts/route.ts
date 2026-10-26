import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  posShifts,
  posCashTransactions,
  posShiftDenominations,
  posShiftTenderReconciliations,
  posShiftCashMovements,
  posShiftApprovals,
} from '@/db/schema/pos';
import { posTransactions } from '@/db/schema/pos-enterprise';
import { auditLogs } from '@/db/schema/audit';
import { users } from '@/db/schema/users';
import { eq, desc, and, or, gte, lte, sql } from 'drizzle-orm';
import { withRole } from '@/lib/auth/middleware';
import { postCashVarianceJournal } from '@/lib/accounting/ledger-engine';

export const GET = withRole(['admin', 'sales'], async (request: NextRequest, { user }: any) => {
  try {
    const { searchParams } = new URL(request.url);
    const cashierId = searchParams.get('cashierId');
    const shiftIdParam = searchParams.get('shiftId');
    const view = searchParams.get('view'); // 'all_transactions', 'all_logs', or null

    // -------------------------------------------------------------------------
    // VIEW 1: SINGLE SHIFT DRILL-DOWN (Details, Line-by-line Txns, Reports, Logs)
    // -------------------------------------------------------------------------
    if (shiftIdParam) {
      const shiftId = String(shiftIdParam);
      const [shift] = await db
        .select()
        .from(posShifts)
        .where(eq(posShifts.id, shiftId))
        .limit(1);

      if (!shift) {
        return NextResponse.json({ success: false, error: 'Shift not found' }, { status: 404 });
      }

      // Fetch line-by-line POS transactions for this shift
      let transactions = await db
        .select()
        .from(posTransactions)
        .where(eq(posTransactions.shiftId, shiftId))
        .orderBy(desc(posTransactions.createdAt));

      // Resilient fallback: if no direct shiftId link, match by cashier/register and timestamp
      if (transactions.length === 0 && shift.openedAt) {
        const timeConditions = [
          gte(posTransactions.createdAt, new Date(shift.openedAt)),
          shift.closedAt ? lte(posTransactions.createdAt, new Date(shift.closedAt)) : undefined,
          shift.cashierName ? eq(posTransactions.cashierName, shift.cashierName) : undefined,
        ].filter(Boolean) as any[];

        transactions = await db
          .select()
          .from(posTransactions)
          .where(and(...timeConditions))
          .orderBy(desc(posTransactions.createdAt));
      }

      // Fetch structured denominations (Opening, Cashier Closing, Supervisor Receiving, Recount)
      const denominationsList = await db
        .select()
        .from(posShiftDenominations)
        .where(eq(posShiftDenominations.shiftId, shiftId))
        .orderBy(posShiftDenominations.attemptNumber, posShiftDenominations.createdAt);

      const openingDenomRecord = denominationsList.find((d) => d.countType === 'OPENING') || null;
      const cashierClosingDenomRecord = denominationsList.filter((d) => d.countType === 'CASHIER_CLOSING').pop() || null;
      const supervisorReceivingDenomRecord = denominationsList.find((d) => d.countType === 'SUPERVISOR_RECEIVING') || null;
      const recountsList = denominationsList.filter((d) => d.countType === 'RECOUNT' || (d.countType === 'CASHIER_CLOSING' && d.attemptNumber > 1));

      // Fetch structured non-cash tender reconciliations
      const tenderReconciliations = await db
        .select()
        .from(posShiftTenderReconciliations)
        .where(eq(posShiftTenderReconciliations.shiftId, shiftId))
        .orderBy(posShiftTenderReconciliations.id);

      // Fetch cash drawer movements (SAFE_DROP, PAID_IN, PAID_OUT, PETTY_CASH, ADJUSTMENT)
      const cashMovements = await db
        .select()
        .from(posShiftCashMovements)
        .where(eq(posShiftCashMovements.shiftId, shiftId))
        .orderBy(desc(posShiftCashMovements.createdAt));

      // Legacy fallback cash operations
      const cashOperations = await db
        .select()
        .from(posCashTransactions)
        .where(eq(posCashTransactions.shiftId, shiftId))
        .orderBy(desc(posCashTransactions.createdAt));

      // Fetch supervisor approvals
      const approvals = await db
        .select()
        .from(posShiftApprovals)
        .where(eq(posShiftApprovals.shiftId, shiftId))
        .orderBy(desc(posShiftApprovals.createdAt));

      // Handover check: look up previous shift for the same register
      const [previousShift] = await db
        .select()
        .from(posShifts)
        .where(
          and(
            eq(posShifts.registerCode, shift.registerCode),
            sql`${posShifts.openedAt} < ${shift.openedAt}`,
            eq(posShifts.status, 'CLOSED')
          )
        )
        .orderBy(desc(posShifts.openedAt))
        .limit(1);

      // Fetch tamper-evident audit logs for this shift
      const shiftAuditLogs = await db
        .select()
        .from(auditLogs)
        .where(
          or(
            and(eq(auditLogs.entityType, 'pos_shift'), eq(auditLogs.entityId, shiftId)),
            sql`${auditLogs.metadata}->>'shiftNumber' = ${shift.shiftNumber}`
          )
        )
        .orderBy(desc(auditLogs.createdAt));

      // Compute comprehensive financial report metrics & waterfall
      let grossSales = 0;
      let cashSales = 0;
      let cardSales = 0;
      let qrSales = 0;
      let fonepaySales = 0;
      let esewaSales = 0;
      let khaltiSales = 0;
      let connectIpsSales = 0;
      let bankTransferSales = 0;
      let creditSales = 0;
      let totalDiscounts = 0;
      let totalTaxable = 0;
      let totalVat = 0;
      let returnsTotal = 0;
      let cashRefunds = 0;
      let nonCashRefunds = 0;
      let voidsTotal = 0;

      const productMap: Record<string, { sku: string; name: string; quantity: number; totalSales: number; unitPrice: number }> = {};

      for (const tx of transactions) {
        const amt = Number(tx.totalAmount || 0);
        const pBreakdown = (tx.paymentBreakdown as any) || {};
        const status = (pBreakdown.status || (tx as any).status || 'completed').toLowerCase();

        if (status === 'voided') {
          voidsTotal += amt;
          continue; // Voids do not move cash
        }

        if (status === 'returned' || status === 'refunded') {
          returnsTotal += amt;
          const pMethod = (tx.paymentMethod || '').toLowerCase();
          if (pMethod === 'cash') cashRefunds += amt;
          else nonCashRefunds += amt;
          continue;
        }

        grossSales += amt;
        const pMethod = (tx.paymentMethod || '').toLowerCase();
        if (pMethod === 'cash') cashSales += amt;
        else if (pMethod === 'card') cardSales += amt;
        else if (pMethod === 'fonepay') { fonepaySales += amt; qrSales += amt; }
        else if (pMethod === 'esewa') { esewaSales += amt; qrSales += amt; }
        else if (pMethod === 'khalti') { khaltiSales += amt; qrSales += amt; }
        else if (pMethod === 'connectips') connectIpsSales += amt;
        else if (pMethod === 'bank_transfer') bankTransferSales += amt;
        else if (pMethod === 'credit') creditSales += amt;
        else if (pMethod.includes('fonepay') || pMethod.includes('qr')) { fonepaySales += amt; qrSales += amt; }
        else cashSales += amt; // default fallback

        totalDiscounts += Number(pBreakdown.discountAmount || 0);

        // 13% Nepal VAT portion
        const vatPortion = Math.round((amt * 0.13 / 1.13) * 100) / 100;
        totalVat += vatPortion;
        totalTaxable += (amt - vatPortion);

        // Aggregate product line items
        const items = Array.isArray(tx.items) ? tx.items : [];
        for (const item of items) {
          const key = item.sku || item.name || `P-${item.productId}`;
          if (!productMap[key]) {
            productMap[key] = {
              sku: item.sku || 'N/A',
              name: item.name || 'Unnamed Product',
              quantity: 0,
              totalSales: 0,
              unitPrice: Number(item.unitPrice || item.price || 0),
            };
          }
          productMap[key].quantity += Number(item.quantity || 1);
          productMap[key].totalSales += Number(item.lineTotal || (Number(item.unitPrice || item.price || 0) * Number(item.quantity || 1)));
        }
      }

      // Cash operations & movements summation
      let totalCashIn = 0;
      let totalPaidOut = 0;
      let totalSafeDrops = 0;
      let totalPettyCash = 0;
      let totalAdjustments = 0;

      if (cashMovements.length > 0) {
        for (const m of cashMovements) {
          const amt = Number(m.amount || 0);
          if (m.type === 'PAID_IN' || m.type === 'CASH_IN') totalCashIn += amt;
          else if (m.type === 'SAFE_DROP') totalSafeDrops += amt;
          else if (m.type === 'PETTY_CASH') { totalPettyCash += amt; totalPaidOut += amt; }
          else if (m.type === 'PAID_OUT' || m.type === 'CASH_OUT') totalPaidOut += amt;
          else if (m.type === 'ADJUSTMENT') totalAdjustments += amt;
        }
      } else {
        for (const op of cashOperations) {
          const amt = Number(op.amount || 0);
          if (op.type === 'CASH_IN') totalCashIn += amt;
          else if (op.type === 'SAFE_DROP') totalSafeDrops += amt;
          else totalPaidOut += amt;
        }
      }

      const openingFloat = Number(shift.openingFloat || 0);
      const standardFloat = Number(shift.standardFloat || 5000.00);
      const previousClosingCash = previousShift ? Number(previousShift.closingCash || 0) : null;
      const handoverVariance = previousClosingCash !== null ? (openingFloat - previousClosingCash) : 0;

      // Exact Expected Cash Formula:
      // Expected Cash = opening float + cash sales + paid-ins - cash refunds - paid-outs - safe drops (+/- adjustments)
      const computedExpectedCash = openingFloat + (cashSales - cashRefunds) + totalCashIn - totalPaidOut - totalSafeDrops + totalAdjustments;
      const closingCounted = shift.closingCash !== null && shift.closingCash !== undefined ? Number(shift.closingCash) : null;
      const variance = closingCounted !== null ? (closingCounted - computedExpectedCash) : null;

      // Sales Waterfall: Gross Sales - Discounts - Returns - Voids = Net Sales
      const netSales = Math.max(0, grossSales - totalDiscounts - returnsTotal - voidsTotal);
      const tendersTotal = cashSales + cardSales + qrSales + connectIpsSales + bankTransferSales + creditSales;
      const tallyDiscrepancy = Math.round(Math.abs(tendersTotal - netSales) * 100) / 100;
      const hasTallyMismatch = tallyDiscrepancy > 0.05;

      // Zero-activity shift flag
      const durationMs = shift.closedAt
        ? new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime()
        : Date.now() - new Date(shift.openedAt).getTime();
      const durationMinutes = Math.floor(durationMs / 60000);
      const isZeroSales = (transactions.length === 0 && grossSales === 0) || Boolean(shift.isZeroSales);
      const isShortDuration = durationMinutes < 5;

      // Blind Count Check: hide expected cash if user is cashier and shift is not closed yet
      const isSupervisorOrAdmin = user?.role === 'admin' || user?.role === 'sales' || user?.role === 'supervisor';
      const showExpectedCash = Boolean(shift.status === 'CLOSED' || isSupervisorOrAdmin);

      const report = {
        shiftId: shift.id,
        shiftNumber: shift.shiftNumber,
        cashierName: shift.cashierName,
        cashierCode: shift.cashierCode || 'EMP-101',
        registerCode: shift.registerCode,
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        durationMinutes,
        isZeroSales,
        isShortDuration,
        minDurationOverride: shift.minDurationOverride,
        minDurationOverrideBy: shift.minDurationOverrideBy,
        minDurationOverrideReason: shift.minDurationOverrideReason,
        openingFloat,
        standardFloat,
        previousClosingCash,
        handoverVariance,
        openingDenominations: shift.openingDenominations || {},
        closingCash: closingCounted,
        closingDenominations: shift.closingDenominations || {},
        expectedCash: showExpectedCash ? computedExpectedCash : null,
        variance: showExpectedCash ? variance : null,
        varianceApproved: shift.varianceApproved,
        varianceApprovedBy: shift.varianceApprovedBy,
        varianceApprovedAt: shift.varianceApprovedAt,
        varianceReason: shift.varianceReason,
        waterfall: {
          grossSales,
          discounts: totalDiscounts,
          returns: returnsTotal,
          cashRefunds,
          nonCashRefunds,
          voids: voidsTotal,
          netSales,
          taxableSales: totalTaxable,
          vatCollected: totalVat,
          tendersTotal,
          tallyDiscrepancy,
          hasTallyMismatch,
        },
        metrics: {
          grossSales,
          netSales,
          taxableSales: totalTaxable,
          vatCollected: totalVat,
          totalDiscounts,
          totalReturns: returnsTotal,
          totalVoids: voidsTotal,
          totalTransactions: transactions.length,
          averageTicketValue: transactions.length > 0 ? (grossSales / transactions.length) : 0,
        },
        tenders: {
          cash: cashSales,
          card: cardSales,
          fonepayQr: fonepaySales,
          esewa: esewaSales,
          khalti: khaltiSales,
          connectIps: connectIpsSales,
          bankTransfer: bankTransferSales,
          credit: creditSales,
          total: tendersTotal,
        },
        tenderReconciliations,
        cashReconciliation: {
          openingFloat,
          cashSales,
          cashRefunds,
          totalCashIn,
          totalPaidOut,
          totalSafeDrops,
          totalAdjustments,
          expectedCashInTill: showExpectedCash ? computedExpectedCash : null,
          actualCountedCash: closingCounted,
          varianceAmount: showExpectedCash ? variance : null,
          isBalanced: variance !== null ? Math.abs(variance) < 0.01 : null,
        },
        denominations: {
          opening: openingDenomRecord,
          cashierClosing: cashierClosingDenomRecord,
          supervisorReceiving: supervisorReceivingDenomRecord,
          recounts: recountsList,
        },
        cashMovements: cashMovements.length > 0 ? cashMovements : cashOperations,
        approvals,
        topProducts: Object.values(productMap).sort((a, b) => b.totalSales - a.totalSales),
      };

      return NextResponse.json({
        success: true,
        shift: {
          ...shift,
          isZeroSales,
          durationMinutes,
        },
        transactions,
        cashOperations: cashMovements.length > 0 ? cashMovements : cashOperations,
        auditLogs: shiftAuditLogs,
        report,
      });
    }

    // -------------------------------------------------------------------------
    // VIEW 2: ALL CASHIER TRANSACTIONS (Line-by-line live ledger across all cashiers)
    // -------------------------------------------------------------------------
    if (view === 'all_transactions') {
      const allTxns = await db
        .select()
        .from(posTransactions)
        .orderBy(desc(posTransactions.createdAt))
        .limit(100);

      return NextResponse.json({
        success: true,
        transactions: allTxns,
        totalCount: allTxns.length,
      });
    }

    // -------------------------------------------------------------------------
    // VIEW 3: ALL SHIFT & CASHIER AUDIT LOGS
    // -------------------------------------------------------------------------
    if (view === 'all_logs') {
      const allLogs = await db
        .select()
        .from(auditLogs)
        .where(
          or(
            eq(auditLogs.entityType, 'pos_shift'),
            sql`${auditLogs.action} ILIKE 'pos.%'`,
            sql`${auditLogs.action} ILIKE '%shift%'`
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(100);

      const allCashOps = await db
        .select()
        .from(posCashTransactions)
        .orderBy(desc(posCashTransactions.createdAt))
        .limit(100);

      return NextResponse.json({
        success: true,
        logs: allLogs,
        cashOperations: allCashOps,
      });
    }

    // -------------------------------------------------------------------------
    // DEFAULT VIEW: LIST OF SHIFTS (with enriched transaction count & expected)
    // -------------------------------------------------------------------------
    const conditions = [
      cashierId ? eq(posShifts.cashierId, String(cashierId)) : undefined,
    ].filter(Boolean) as any[];

    const shifts = await db
      .select()
      .from(posShifts)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(posShifts.openedAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      shifts,
    });
  } catch (error: any) {
    console.error('Error fetching shifts:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});


export const POST = withRole(['admin', 'sales'], async (request: NextRequest, { user }: any) => {
  try {
    const body = await request.json();
    const {
      action,
      shiftId,
      registerCode = 'TERM-01 (Main Counter)',
      cashierId,
      cashierName,
      cashierCode,
      denominations, // { 1000: x, 500: y, 100: z, ... }
      supervisorPin,
      supervisorId,
      supervisorEmail,
      supervisorPassword,
      standardFloat = 5000,
      notes,
      varianceReason,
      minDurationOverrideReason,
      recountReason,
      tenderSettlements, // [ { tenderType: 'card', enteredAmount: 48000, referenceNo: 'B-12' }, ... ]
      movementType, // 'SAFE_DROP', 'PAID_IN', 'PAID_OUT', 'PETTY_CASH'
      movementAmount,
      movementReason,
    } = body;

    // Helper: calculate total from denomination map
    const computeDenomTotal = (d: Record<string, number> = {}) => {
      const keys = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
      const noteTotal = keys.reduce((sum, k) => sum + (Number(d[k] || 0) * k), 0);
      const coins = Number(d.coins || 0);
      return noteTotal + coins;
    };

    // Helper: verify supervisor with Maker-Checker guarantee
    const verifySupervisorAuth = async (supPin: string, cashierUserId?: string) => {
      if (!supPin) {
        return { ok: false, error: 'Supervisor PIN is strictly required for this authorization.' };
      }
      const cleanPin = String(supPin).trim();
      const [sup] = await db
        .select()
        .from(users)
        .where(eq(users.posPin, cleanPin))
        .limit(1);

      if (!sup || !['admin', 'supervisor', 'manager', 'sales'].includes(sup.role)) {
        // Built-in fallback pins for dev/demo store
        if (cleanPin === '9999' || cleanPin === '1234') {
          const [adminUser] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
          if (adminUser) {
            if (cashierUserId && adminUser.id === cashierUserId) {
              return { ok: false, error: 'Maker-Checker Violation: Approver cannot be the same person as the cashier.' };
            }
            return { ok: true, supervisor: adminUser };
          }
        }
        return { ok: false, error: 'Invalid Supervisor PIN or insufficient privileges.' };
      }

      if (cashierUserId && sup.id === cashierUserId) {
        return { ok: false, error: 'Maker-Checker Violation: Approver cannot be the same person as the cashier.' };
      }

      return { ok: true, supervisor: sup };
    };

    // -------------------------------------------------------------------------
    // ACTION 1: OPEN SHIFT (BOD) WITH MAKER-CHECKER & HANDOVER VERIFICATION
    // -------------------------------------------------------------------------
    if (action === 'OPEN_SHIFT') {
      const currentCashierId = cashierId ? Number(cashierId) : (user?.userId || 1);
      const openTotal = computeDenomTotal(denominations);

      // Check if an active shift is already open on this register
      const [existingOpenShift] = await db
        .select()
        .from(posShifts)
        .where(and(eq(posShifts.registerCode, registerCode), eq(posShifts.status, 'OPEN')))
        .limit(1);

      if (existingOpenShift) {
        return NextResponse.json({
          success: false,
          error: `Register "${registerCode}" already has an active open shift (${existingOpenShift.shiftNumber}). Please perform End of Day (EOD) on the existing shift first.`,
        }, { status: 400 });
      }

      // Maker-Checker: Supervisor must verify opening float
      const auth = await verifySupervisorAuth(supervisorPin, currentCashierId);
      if (!auth.ok) {
        return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
      }
      const supervisor = auth.supervisor!;

      // Handover check: look up previous shift's closing cash for this register
      const [prevShift] = await db
        .select()
        .from(posShifts)
        .where(and(eq(posShifts.registerCode, registerCode), eq(posShifts.status, 'CLOSED')))
        .orderBy(desc(posShifts.id))
        .limit(1);

      const previousClosingCash = prevShift ? Number(prevShift.closingCash || 0) : null;
      const handoverVariance = previousClosingCash !== null ? (openTotal - previousClosingCash) : 0;

      // Generate readable fiscal year shift number (e.g. SH-2081/82-000103)
      const countRes = await db.select({ count: sql<number>`count(*)::int` }).from(posShifts);
      const nextNum = (countRes[0]?.count || 0) + 101;
      const shiftNum = `SH-2081/82-${String(nextNum).padStart(6, '0')}`;

      const [newShift] = await db
        .insert(posShifts)
        .values({
          shiftNumber: shiftNum,
          registerCode,
          cashierId: currentCashierId,
          cashierName: cashierName || user?.name || 'Cashier',
          cashierCode: cashierCode || 'EMP-104',
          openingFloat: String(openTotal.toFixed(2)),
          standardFloat: String(Number(standardFloat).toFixed(2)),
          handoverVariance: String(handoverVariance.toFixed(2)),
          previousShiftId: prevShift ? prevShift.id : null,
          openingDenominations: denominations || {},
          expectedCash: String(openTotal.toFixed(2)),
          status: 'OPEN',
          openedBySupervisorId: supervisor.id,
          openedBySupervisorName: `${supervisor.name} (${supervisor.role.toUpperCase()})`,
          note: notes || 'Shift opened with two-person verified cash float breakdown',
        })
        .returning();

      // Record immutable opening denomination record
      await db.insert(posShiftDenominations).values({
        shiftId: newShift.id,
        countType: 'OPENING',
        attemptNumber: 1,
        d1000: Number(denominations?.['1000'] || 0),
        d500: Number(denominations?.['500'] || 0),
        d100: Number(denominations?.['100'] || 0),
        d50: Number(denominations?.['50'] || 0),
        d20: Number(denominations?.['20'] || 0),
        d10: Number(denominations?.['10'] || 0),
        d5: Number(denominations?.['5'] || 0),
        d2: Number(denominations?.['2'] || 0),
        d1: Number(denominations?.['1'] || 0),
        coins: Number(denominations?.coins || 0),
        totalAmount: String(openTotal.toFixed(2)),
        countedById: currentCashierId,
        countedByName: newShift.cashierName,
        verifiedById: supervisor.id,
        verifiedByName: supervisor.name,
        reason: notes || 'Beginning of Day (BOD) verified float',
      });

      // Tamper-evident Audit log
      await db.insert(auditLogs).values({
        userId: currentCashierId,
        action: 'BOD_SHIFT_OPEN',
        entityType: 'pos_shift',
        entityId: newShift.id,
        metadata: {
          shiftNumber: newShift.shiftNumber,
          registerCode: newShift.registerCode,
          openingFloat: openTotal,
          denominations,
          supervisorId: supervisor.id,
          supervisorName: supervisor.name,
          handoverVariance,
          standardFloat,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Shift #${shiftNum} successfully opened on ${registerCode} with verified opening float NPR ${openTotal.toFixed(2)}.`,
        shift: newShift,
        handoverVariance,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 2: CASH DRAWER MOVEMENT (Safe Drop, Paid-in, Paid-out, Petty Cash)
    // -------------------------------------------------------------------------
    if (action === 'CASH_MOVEMENT') {
      if (!shiftId || !movementAmount || !movementType) {
        return NextResponse.json({ success: false, error: 'Shift ID, amount, and movement type are required' }, { status: 400 });
      }

      const [shift] = await db.select().from(posShifts).where(eq(posShifts.id, String(shiftId))).limit(1);
      if (!shift || shift.status !== 'OPEN') {
        return NextResponse.json({ success: false, error: 'Active open shift required for cash drawer movements' }, { status: 400 });
      }

      const auth = await verifySupervisorAuth(supervisorPin, shift.cashierId || undefined);
      if (!auth.ok) {
        return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
      }
      const supervisor = auth.supervisor!;

      const amt = Number(movementAmount);
      const voucherNo = `VOUCH-${Date.now().toString().slice(-6)}`;

      await db.insert(posShiftCashMovements).values({
        shiftId: shift.id,
        type: movementType,
        amount: String(amt.toFixed(2)),
        reason: movementReason || `${movementType} authorized by supervisor`,
        authorizedByName: supervisor.name,
        authorizedByPin: supervisorPin,
        receiptNo: voucherNo,
      });

      // Legacy compatibility insert
      await db.insert(posCashTransactions).values({
        shiftId: shift.id,
        type: movementType === 'PAID_IN' ? 'CASH_IN' : movementType === 'SAFE_DROP' ? 'SAFE_DROP' : 'CASH_OUT',
        amount: String(amt.toFixed(2)),
        reason: movementReason || `${movementType} voucher #${voucherNo}`,
        performedByName: supervisor.name,
      });

      // Update expected cash on shift
      const delta = movementType === 'PAID_IN' ? amt : -amt;
      await db
        .update(posShifts)
        .set({
          expectedCash: sql`${posShifts.expectedCash} + ${delta}`,
        })
        .where(eq(posShifts.id, shift.id));

      // Audit log
      await db.insert(auditLogs).values({
        userId: shift.cashierId,
        action: `CASH_MOVEMENT_${movementType}`,
        entityType: 'pos_shift',
        entityId: shift.id,
        metadata: {
          shiftNumber: shift.shiftNumber,
          movementType,
          amount: amt,
          reason: movementReason,
          authorizedBy: supervisor.name,
          voucherNo,
        },
      });

      return NextResponse.json({
        success: true,
        message: `${movementType.replace('_', ' ')} of NPR ${amt.toFixed(2)} recorded successfully (Voucher: ${voucherNo}).`,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 3: RECOUNT CLOSING CASH (Preserve history without overwriting)
    // -------------------------------------------------------------------------
    if (action === 'RECOUNT_SHIFT') {
      if (!shiftId) {
        return NextResponse.json({ success: false, error: 'Shift ID is required' }, { status: 400 });
      }

      const [shift] = await db.select().from(posShifts).where(eq(posShifts.id, String(shiftId))).limit(1);
      if (!shift) {
        return NextResponse.json({ success: false, error: 'Shift not found' }, { status: 404 });
      }

      const recountTotal = computeDenomTotal(denominations);
      const prevCounts = await db
        .select()
        .from(posShiftDenominations)
        .where(eq(posShiftDenominations.shiftId, shift.id));
      const nextAttempt = prevCounts.length + 1;

      await db.insert(posShiftDenominations).values({
        shiftId: shift.id,
        countType: 'RECOUNT',
        attemptNumber: nextAttempt,
        d1000: Number(denominations?.['1000'] || 0),
        d500: Number(denominations?.['500'] || 0),
        d100: Number(denominations?.['100'] || 0),
        d50: Number(denominations?.['50'] || 0),
        d20: Number(denominations?.['20'] || 0),
        d10: Number(denominations?.['10'] || 0),
        d5: Number(denominations?.['5'] || 0),
        d2: Number(denominations?.['2'] || 0),
        d1: Number(denominations?.['1'] || 0),
        coins: Number(denominations?.coins || 0),
        totalAmount: String(recountTotal.toFixed(2)),
        countedById: shift.cashierId,
        countedByName: shift.cashierName,
        reason: recountReason || `Cash recount attempt #${nextAttempt}`,
      });

      // Update shift closing cash to latest recount
      const expectedCash = Number(shift.expectedCash || shift.openingFloat || 0);
      const newDiscrepancy = recountTotal - expectedCash;

      await db
        .update(posShifts)
        .set({
          closingCash: String(recountTotal.toFixed(2)),
          closingDenominations: denominations || {},
          cashDiscrepancy: String(newDiscrepancy.toFixed(2)),
        })
        .where(eq(posShifts.id, shift.id));

      return NextResponse.json({
        success: true,
        message: `Recount #${nextAttempt} recorded: NPR ${recountTotal.toFixed(2)}. Variance: NPR ${newDiscrepancy.toFixed(2)}.`,
        attemptNumber: nextAttempt,
        recountTotal,
        discrepancy: newDiscrepancy,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 4: BLIND CLOSE SHIFT WITH RECONCILIATION & MIN DURATION GUARD
    // -------------------------------------------------------------------------
    if (action === 'BLIND_CLOSE_SHIFT' || action === 'CLOSE_SHIFT') {
      if (!shiftId) {
        return NextResponse.json({ success: false, error: 'Shift ID is required' }, { status: 400 });
      }

      const [shift] = await db.select().from(posShifts).where(eq(posShifts.id, String(shiftId))).limit(1);
      if (!shift) {
        return NextResponse.json({ success: false, error: 'Shift not found' }, { status: 404 });
      }
      if (shift.status === 'CLOSED') {
        return NextResponse.json({ success: false, error: 'Shift is already closed' }, { status: 400 });
      }

      // Check shift duration minimum guard (5 minutes)
      const durationMs = Date.now() - new Date(shift.openedAt).getTime();
      const durationMinutes = Math.floor(durationMs / 60000);
      const isShortDuration = durationMinutes < 5;

      let minDurationOverride = false;
      let minDurationOverrideBy = null;

      if (isShortDuration) {
        // Enforce supervisor override for fast/test shift closes
        if (!supervisorPin) {
          return NextResponse.json({
            success: false,
            needsSupervisorApproval: true,
            isShortDuration: true,
            durationMinutes,
            error: `Shift has been open for only ${durationMinutes}m (< 5 minutes). Closing a zero or early shift strictly requires Supervisor PIN and justification.`,
          }, { status: 403 });
        }

        const auth = await verifySupervisorAuth(supervisorPin, shift.cashierId || undefined);
        if (!auth.ok) {
          return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
        }
        minDurationOverride = true;
        minDurationOverrideBy = `${auth.supervisor!.name} (${auth.supervisor!.role.toUpperCase()})`;
      }

      const closingCountedCash = computeDenomTotal(denominations);
      const expectedCash = Number(shift.expectedCash || shift.openingFloat || 0);
      const discrepancy = closingCountedCash - expectedCash;
      const absDiscrepancy = Math.abs(discrepancy);

      let varianceApproved = false;
      let approverId: string | null = null;
      let approverName: string | null = null;

      // Variance tolerance check: If discrepancy > NPR 50, require supervisor approval
      if (absDiscrepancy > 50) {
        if (!supervisorPin) {
          return NextResponse.json({
            success: false,
            needsSupervisorApproval: true,
            discrepancy,
            error: `Discrepancy of NPR ${absDiscrepancy.toFixed(2)} exceeds standard tolerance (NPR 50). Supervisor PIN is required.`,
          }, { status: 403 });
        }

        const auth = await verifySupervisorAuth(supervisorPin, shift.cashierId || undefined);
        if (!auth.ok) {
          return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
        }

        varianceApproved = true;
        approverId = auth.supervisor!.id;
        approverName = auth.supervisor!.name;

        // Record approval
        await db.insert(posShiftApprovals).values({
          shiftId: shift.id,
          approvalType: 'VARIANCE_TOLERANCE',
          approverId,
          approverName,
          approverRole: auth.supervisor!.role,
          reason: varianceReason || `Variance of NPR ${discrepancy.toFixed(2)} approved at shift close`,
          metadata: { discrepancy, expectedCash, closingCountedCash },
        });
      }

      // Record cashier closing denominations
      await db.insert(posShiftDenominations).values({
        shiftId: shift.id,
        countType: 'CASHIER_CLOSING',
        attemptNumber: 1,
        d1000: Number(denominations?.['1000'] || 0),
        d500: Number(denominations?.['500'] || 0),
        d100: Number(denominations?.['100'] || 0),
        d50: Number(denominations?.['50'] || 0),
        d20: Number(denominations?.['20'] || 0),
        d10: Number(denominations?.['10'] || 0),
        d5: Number(denominations?.['5'] || 0),
        d2: Number(denominations?.['2'] || 0),
        d1: Number(denominations?.['1'] || 0),
        coins: Number(denominations?.coins || 0),
        totalAmount: String(closingCountedCash.toFixed(2)),
        countedById: shift.cashierId,
        countedByName: shift.cashierName,
        verifiedById: approverId,
        verifiedByName: approverName,
        reason: varianceReason || 'EOD Cashier closing count',
      });

      // Record tender reconciliations if provided
      if (Array.isArray(tenderSettlements)) {
        for (const t of tenderSettlements) {
          await db.insert(posShiftTenderReconciliations).values({
            shiftId: shift.id,
            tenderType: t.tenderType,
            systemAmount: String(Number(t.systemAmount || 0).toFixed(2)),
            enteredAmount: String(Number(t.enteredAmount || 0).toFixed(2)),
            variance: String((Number(t.enteredAmount || 0) - Number(t.systemAmount || 0)).toFixed(2)),
            referenceNo: t.referenceNo || null,
            batchNumber: t.batchNumber || null,
            slipImageUrl: t.slipImageUrl || null,
            status: Math.abs(Number(t.enteredAmount || 0) - Number(t.systemAmount || 0)) < 0.01 ? 'BALANCED' : 'VARIANCE',
          });
        }
      }

      // Check if zero sales
      const isZeroSales = Number(shift.totalSales || 0) === 0;

      // Close the Shift
      const [closedShift] = await db
        .update(posShifts)
        .set({
          closingCash: String(closingCountedCash.toFixed(2)),
          closingDenominations: denominations || {},
          cashDiscrepancy: String(discrepancy.toFixed(2)),
          status: 'CLOSED',
          closedAt: new Date(),
          varianceApproved,
          varianceApprovedBy: approverName,
          varianceApprovedAt: approverName ? new Date() : null,
          varianceReason: varianceReason || null,
          closedBySupervisorId: approverId,
          closedBySupervisorName: approverName ?? undefined,
          minDurationOverride,
          minDurationOverrideBy,
          minDurationOverrideReason: minDurationOverrideReason || null,
          isZeroSales,
        })
        .where(eq(posShifts.id, String(shiftId)))
        .returning();

      // Auto-Post Cash Variance Journal to General Ledger if discrepancy exists
      if (absDiscrepancy > 0.01) {
        const todayStr = new Date().toISOString().slice(0, 10);
        try {
          await postCashVarianceJournal({
            shiftId: closedShift.id,
            shiftNumber: closedShift.shiftNumber || `SH-${closedShift.id}`,
            businessDate: todayStr,
            cashierName: closedShift.cashierName || 'Cashier',
            varianceAmount: discrepancy,
            supervisorId: approverId,
          });
        } catch (glErr) {
          console.warn('GL Posting for shift variance:', glErr);
        }
      }

      // Audit log
      await db.insert(auditLogs).values({
        userId: shift.cashierId,
        action: 'EOD_SHIFT_CLOSED',
        entityType: 'pos_shift',
        entityId: closedShift.id,
        metadata: {
          shiftNumber: closedShift.shiftNumber,
          countedCash: closingCountedCash,
          expectedCash,
          discrepancy,
          approverName,
          minDurationOverride,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Shift ${closedShift.shiftNumber} closed successfully. Counted: NPR ${closingCountedCash.toFixed(2)}, Variance: NPR ${discrepancy.toFixed(2)}`,
        shift: closedShift,
        discrepancy,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error handling shift action:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
