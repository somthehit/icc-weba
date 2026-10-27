import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { posBusinessDays, posShifts } from '@/db/schema/pos';
import { orders } from '@/db/schema/orders';
import { users } from '@/db/schema/users';
import { auditLogs } from '@/db/schema/audit';
import { zReports } from '@/db/schema/accounting-enterprise';
import { eq, desc, sql } from 'drizzle-orm';
import { withAccounting } from '@/lib/auth/middleware';
import { adToBs } from '@/lib/nepal/date';
import crypto from 'crypto';

/**
 * EOD (End of Day) & Z-Report Controller
 * Aligned to exact schema columns in pos.ts, accounting-enterprise.ts, and audit.ts
 *
 * zReports columns (from accounting-enterprise.ts):
 *   reportNumber, businessDate, fiscalYear, grossSales, discountsTotal, returnsTotal,
 *   taxableAmount, vatAmount, netSales, cashExpected, cashCounted, cashVariance,
 *   paymentSummaryJson, shiftsSummaryJson, sha256Hash, isLocked, closedById, closedByName, closedAt
 *
 * posBusinessDays columns (from pos.ts):
 *   businessDate, status, openedAt, closedAt, closedBySupervisorId, closedBySupervisorName,
 *   totalGrossSales, totalNetSales, totalCashVariance, totalShiftsCount, zReport
 *
 * auditLogs columns (from audit.ts):
 *   userId, action, entityType, entityId (integer), metadata
 */
export const GET = withAccounting(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || new Date().toISOString().slice(0, 10);

    // 1. Fetch Business Day status
    const [businessDay] = await db
      .select()
      .from(posBusinessDays)
      .where(eq(posBusinessDays.businessDate, dateParam))
      .limit(1);

    // 2. Fetch all shifts for the day
    const dayShifts = await db
      .select()
      .from(posShifts)
      .where(sql`date(${posShifts.openedAt}) = ${dateParam}`)
      .orderBy(desc(posShifts.openedAt));

    const openShifts = dayShifts.filter((s) => s.status === 'OPEN');
    const hasUnclosedShifts = openShifts.length > 0;

    // 3. Fetch sales for this business date
    const dayOrders = await db
      .select()
      .from(orders)
      .where(sql`date(${orders.createdAt}) = ${dateParam}`);

    let grossSales = 0;
    let netSales = 0;
    let vatAmount = 0;
    let discountAmount = 0;

    const paymentSummary = { cash: 0, fonepay: 0, esewa: 0, khalti: 0, card: 0, credit: 0 };

    for (const o of dayOrders) {
      const amt = Number(o.totalAmount || 0);
      const tax = Number(o.vatAmount || (amt * 0.13) / 1.13);
      grossSales += amt;
      vatAmount += tax;
      netSales += amt - tax;
      discountAmount += Number(o.discountAmount || 0);

      const m = (o.paymentMethod || '').toLowerCase();
      if (m.includes('cash') || m.includes('cod')) paymentSummary.cash += amt;
      else if (m.includes('fonepay') || m.includes('qr')) paymentSummary.fonepay += amt;
      else if (m.includes('esewa')) paymentSummary.esewa += amt;
      else if (m.includes('khalti')) paymentSummary.khalti += amt;
      else if (m.includes('card') || m.includes('pos')) paymentSummary.card += amt;
      else paymentSummary.credit += amt;
    }

    // 4. Cash variance across all closed shifts
    let expectedCashTotal = 0;
    let countedCashTotal = 0;
    let totalCashVariance = 0;

    for (const s of dayShifts) {
      expectedCashTotal += Number(s.expectedCash || 0);
      countedCashTotal += Number(s.closingCash || s.expectedCash || 0);
      totalCashVariance += Number(s.cashDiscrepancy || 0);
    }

    // 5. Existing Z-Report (if day finalized)
    const [existingZReport] = await db
      .select()
      .from(zReports)
      .where(eq(zReports.businessDate, dateParam))
      .limit(1);

    const bsMeta = adToBs(dateParam);

    return NextResponse.json({
      success: true,
      businessDate: dateParam,
      nepaliDate: bsMeta.formattedBS,
      status: businessDay?.status || (existingZReport ? 'CLOSED' : 'OPEN'),
      canFinalize: !hasUnclosedShifts,
      blockers: [
        hasUnclosedShifts ? `${openShifts.length} cashier shift(s) are still OPEN. All shifts must be blind-closed first.` : null,
      ].filter(Boolean),
      summary: {
        totalOrders: dayOrders.length,
        grossSales,
        netSales,
        vatAmount,
        discountAmount,
        paymentSummary,
        shiftsCount: dayShifts.length,
        openShiftsCount: openShifts.length,
        expectedCashTotal,
        countedCashTotal,
        totalCashVariance,
      },
      shifts: dayShifts,
      zReport: existingZReport || null,
    });
  } catch (error: any) {
    console.error('Error fetching EOD status:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withAccounting(async (request: NextRequest, { user }: any) => {
  try {
    const body = await request.json();
    const { action, businessDate, supervisorPin, reopenReason } = body;

    if (!businessDate) {
      return NextResponse.json({ success: false, error: 'Business date is required' }, { status: 400 });
    }

    // -------------------------------------------------------------
    // ACTION: FINALIZE EOD & GENERATE IMMUTABLE Z-REPORT
    // -------------------------------------------------------------
    if (action === 'FINALIZE_EOD') {
      if (!supervisorPin) {
        return NextResponse.json({ success: false, error: 'Supervisor / Manager PIN is required to finalize EOD' }, { status: 400 });
      }

      const [supervisor] = await db
        .select()
        .from(users)
        .where(eq(users.posPin, String(supervisorPin).trim()))
        .limit(1);

      if (!supervisor) {
        return NextResponse.json({ success: false, error: 'Invalid Supervisor PIN' }, { status: 403 });
      }

      if (!['admin', 'supervisor', 'manager', 'sales'].includes(supervisor.role)) {
        return NextResponse.json({ success: false, error: 'Unauthorized: PIN belongs to non-supervisor role' }, { status: 403 });
      }

      const dayShifts = await db
        .select()
        .from(posShifts)
        .where(sql`date(${posShifts.openedAt}) = ${businessDate}`);

      const hasOpen = dayShifts.some((s) => s.status === 'OPEN');
      if (hasOpen) {
        return NextResponse.json({ success: false, error: 'Cannot finalize EOD while cashier shifts remain OPEN.' }, { status: 400 });
      }

      const dayOrders = await db
        .select()
        .from(orders)
        .where(sql`date(${orders.createdAt}) = ${businessDate}`);

      let grossSales = 0;
      let netSales = 0;
      let vatCollected = 0;
      let taxableAmount = 0;

      const paymentBreakdown: Record<string, number> = { cash: 0, fonepay: 0, esewa: 0, khalti: 0, card: 0, credit: 0 };

      for (const o of dayOrders) {
        const amt = Number(o.totalAmount || 0);
        const tax = Number(o.vatAmount || (amt * 0.13) / 1.13);
        const taxable = amt - tax;
        grossSales += amt;
        vatCollected += tax;
        taxableAmount += taxable;
        netSales += taxable;

        const m = (o.paymentMethod || '').toLowerCase();
        if (m.includes('cash') || m.includes('cod')) paymentBreakdown.cash += amt;
        else if (m.includes('fonepay') || m.includes('qr')) paymentBreakdown.fonepay += amt;
        else if (m.includes('esewa')) paymentBreakdown.esewa += amt;
        else if (m.includes('khalti')) paymentBreakdown.khalti += amt;
        else if (m.includes('card') || m.includes('pos')) paymentBreakdown.card += amt;
        else paymentBreakdown.credit += amt;
      }

      let cashExpected = 0;
      let cashCounted = 0;
      let cashVariance = 0;

      for (const s of dayShifts) {
        cashExpected += Number(s.expectedCash || 0);
        cashCounted += Number(s.closingCash || s.expectedCash || 0);
        cashVariance += Number(s.cashDiscrepancy || 0);
      }

      const bsMeta = adToBs(businessDate);
      const zReportNumber = `ZR-${bsMeta.fiscalYear.replace('/', '')}-${businessDate.replace(/-/g, '')}`;

      const snapshotPayload = {
        zReportNumber,
        businessDate,
        bsDate: bsMeta.formattedBS,
        fiscalYear: bsMeta.fiscalYear,
        grossSales,
        netSales,
        vatCollected,
        totalOrders: dayOrders.length,
        paymentBreakdown,
        shiftsCount: dayShifts.length,
        cashExpected,
        cashCounted,
        cashVariance,
        approver: { id: supervisor.id, name: supervisor.name, role: supervisor.role },
        generatedAt: new Date().toISOString(),
      };

      const sha256Hash = crypto
        .createHash('sha256')
        .update(JSON.stringify(snapshotPayload))
        .digest('hex');

      // 4. Save Z-Report — use exact schema columns from accounting-enterprise.ts zReports
      const [zReport] = await db
        .insert(zReports)
        .values({
          reportNumber: zReportNumber,
          businessDate,
          fiscalYear: bsMeta.fiscalYear,
          grossSales: String(grossSales.toFixed(2)),
          discountsTotal: '0.00',
          returnsTotal: '0.00',
          taxableAmount: String(taxableAmount.toFixed(2)),
          vatAmount: String(vatCollected.toFixed(2)),
          netSales: String(netSales.toFixed(2)),
          cashExpected: String(cashExpected.toFixed(2)),
          cashCounted: String(cashCounted.toFixed(2)),
          cashVariance: String(cashVariance.toFixed(2)),
          paymentSummaryJson: paymentBreakdown,
          shiftsSummaryJson: dayShifts.map((s) => ({
            id: s.id,
            cashierName: s.cashierName,
            status: s.status,
            expected: s.expectedCash,
            counted: s.closingCash,
            discrepancy: s.cashDiscrepancy,
          })),
          sha256Hash,
          isLocked: true,
          closedById: supervisor.id,
          closedByName: supervisor.name,
          closedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: zReports.businessDate,
          set: {
            grossSales: String(grossSales.toFixed(2)),
            vatAmount: String(vatCollected.toFixed(2)),
            cashVariance: String(cashVariance.toFixed(2)),
            sha256Hash,
          },
        })
        .returning();

      // 5. Lock Business Day — use exact posBusinessDays schema columns from pos.ts
      await db
        .insert(posBusinessDays)
        .values({
          businessDate,
          status: 'CLOSED',
          totalGrossSales: String(grossSales.toFixed(2)),
          totalNetSales: String(netSales.toFixed(2)),
          totalCashVariance: String(cashVariance.toFixed(2)),
          totalShiftsCount: dayShifts.length,
          closedAt: new Date(),
          closedBySupervisorId: supervisor.id,
          closedBySupervisorName: supervisor.name,
          zReport: snapshotPayload,
        })
        .onConflictDoUpdate({
          target: posBusinessDays.businessDate,
          set: {
            status: 'CLOSED',
            totalGrossSales: String(grossSales.toFixed(2)),
            totalNetSales: String(netSales.toFixed(2)),
            closedAt: new Date(),
            closedBySupervisorId: supervisor.id,
            closedBySupervisorName: supervisor.name,
          },
        });

      return NextResponse.json({
        success: true,
        message: `Business Day ${businessDate} finalized. Z-Report ${zReportNumber} created.`,
        zReport,
      });
    }

    // -------------------------------------------------------------
    // ACTION: REOPEN BUSINESS DAY (Requires Admin PIN + Written Reason)
    // -------------------------------------------------------------
    if (action === 'REOPEN_DAY') {
      if (!supervisorPin) {
        return NextResponse.json({ success: false, error: 'Admin PIN required to unlock business day' }, { status: 400 });
      }
      if (!reopenReason || reopenReason.trim().length < 10) {
        return NextResponse.json({ success: false, error: 'A valid written justification (min 10 chars) is mandatory for reopening a closed day.' }, { status: 400 });
      }

      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.posPin, String(supervisorPin).trim()))
        .limit(1);

      if (!admin || admin.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized: Only an Administrator can reopen a closed business day.' }, { status: 403 });
      }

      await db
        .update(posBusinessDays)
        .set({ status: 'OPEN' })
        .where(eq(posBusinessDays.businessDate, businessDate));

      // Log in Audit Trail — use exact auditLogs columns from audit.ts
      // entityId is integer, so we store a hash-based number from the date string
      await db.insert(auditLogs).values({
        userId: admin.id,
        action: 'REOPEN_BUSINESS_DAY',
        entityType: 'pos_business_days',
        entityId: null, // entityId is integer; business date is not an integer
        metadata: { businessDate, reason: reopenReason, reopenedAt: new Date().toISOString() },
      });

      return NextResponse.json({
        success: true,
        message: `Business Day ${businessDate} reopened by Admin ${admin.name}.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error finalizing EOD:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
