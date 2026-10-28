import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { posEodSubmissions, payrollDiscrepancies } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const registerParam = searchParams.get('register');
    const cashierParam = searchParams.get('cashier');
    const statusParam = searchParams.get('status');
    const discrepancyParam = searchParams.get('discrepancy');

    // Build conditions
    const conditions: any[] = [];

    if (dateParam && dateParam !== 'ALL') {
      conditions.push(eq(posEodSubmissions.businessDate, dateParam));
    }
    if (registerParam && registerParam !== 'ALL') {
      conditions.push(eq(posEodSubmissions.registerCode, registerParam));
    }
    if (cashierParam && cashierParam !== 'ALL') {
      conditions.push(eq(posEodSubmissions.cashierCode, cashierParam));
    }
    if (statusParam && statusParam !== 'ALL') {
      conditions.push(eq(posEodSubmissions.status, statusParam));
    }
    if (discrepancyParam && discrepancyParam !== 'ALL') {
      conditions.push(eq(posEodSubmissions.discrepancyType, discrepancyParam));
    }

    const submissions = await db
      .select()
      .from(posEodSubmissions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(posEodSubmissions.submittedAt));

    // Calculate workflow dashboard counts
    const allRecords = await db
      .select({
        status: posEodSubmissions.status,
        discrepancyType: posEodSubmissions.discrepancyType,
        expectedClosingCash: posEodSubmissions.expectedClosingCash,
        actualClosingCash: posEodSubmissions.actualClosingCash,
        cashVariance: posEodSubmissions.cashVariance,
      })
      .from(posEodSubmissions);

    let pendingPaperCount = 0;
    let paperReceivedCount = 0;
    let inProgressCount = 0;
    let discrepancyReviewCount = 0;
    let finalizedCount = 0;
    let returnedCount = 0;
    let totalExpectedCash = 0;
    let totalActualCash = 0;
    let totalNetVariance = 0;

    for (const r of allRecords) {
      if (r.status === 'SUBMITTED_TO_ACCOUNTANT') pendingPaperCount++;
      else if (r.status === 'PAPER_FORM_RECEIVED') paperReceivedCount++;
      else if (r.status === 'RECONCILIATION_IN_PROGRESS') inProgressCount++;
      else if (r.status === 'DISCREPANCY_REVIEW' || r.status === 'PENDING_FINAL_APPROVAL') discrepancyReviewCount++;
      else if (r.status === 'FINALIZED') finalizedCount++;
      else if (r.status === 'RETURNED_FOR_CLARIFICATION') returnedCount++;

      totalExpectedCash += Number(r.expectedClosingCash || 0);
      if (r.actualClosingCash !== null && r.actualClosingCash !== undefined) {
        totalActualCash += Number(r.actualClosingCash || 0);
      }
      if (r.cashVariance !== null && r.cashVariance !== undefined) {
        totalNetVariance += Number(r.cashVariance || 0);
      }
    }

    // Fetch linked payroll discrepancies count
    const [discrepancyCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(payrollDiscrepancies);

    return NextResponse.json({
      success: true,
      submissions,
      stats: {
        totalSubmissions: allRecords.length,
        pendingPaperCount,
        paperReceivedCount,
        inProgressCount,
        discrepancyReviewCount,
        finalizedCount,
        returnedCount,
        payrollDiscrepanciesCount: Number(discrepancyCountRow?.count || 0),
        totalExpectedCash: Number(totalExpectedCash.toFixed(2)),
        totalActualCash: Number(totalActualCash.toFixed(2)),
        totalNetVariance: Number(totalNetVariance.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error('Failed to list EOD submissions for accountant:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
