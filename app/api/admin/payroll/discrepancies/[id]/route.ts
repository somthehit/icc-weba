import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { payrollDiscrepancies } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      action,
      reviewerName = 'Payroll Officer',
      reviewerId,
      investigationNotes,
      cashierExplanation,
      reviewerAndApprovalStatus,
      resolutionStatus,
      payrollAdjustmentApproved,
      payrollAdjustmentAmount,
    } = body;

    const [disc] = await db
      .select()
      .from(payrollDiscrepancies)
      .where(eq(payrollDiscrepancies.id, id))
      .limit(1);

    if (!disc) {
      return NextResponse.json({ success: false, error: 'Payroll discrepancy record not found.' }, { status: 404 });
    }

    if (action === 'update_investigation') {
      const [updated] = await db
        .update(payrollDiscrepancies)
        .set({
          investigationNotes: investigationNotes ?? disc.investigationNotes,
          cashierExplanation: cashierExplanation ?? disc.cashierExplanation,
          reviewerAndApprovalStatus: reviewerAndApprovalStatus ?? 'UNDER_INVESTIGATION',
          reviewedById: reviewerId ? String(reviewerId) : disc.reviewedById,
          reviewedByName: reviewerName,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payrollDiscrepancies.id, disc.id))
        .returning();

      return NextResponse.json({
        success: true,
        message: 'Investigation notes updated.',
        discrepancy: updated,
      });
    }

    if (action === 'resolve') {
      // GUARDRAIL: Strict verification before approving payroll adjustment
      const isApproved = Boolean(payrollAdjustmentApproved);
      const adjAmount = isApproved ? Number(payrollAdjustmentAmount || 0) : 0;

      const [updated] = await db
        .update(payrollDiscrepancies)
        .set({
          reviewerAndApprovalStatus:
            reviewerAndApprovalStatus || (isApproved ? 'APPROVED_FOR_PAYROLL_ADJUSTMENT' : 'RESOLVED_NO_DEDUCTION'),
          resolutionStatus: resolutionStatus || 'RESOLVED',
          investigationNotes: investigationNotes ?? disc.investigationNotes,
          payrollAdjustmentApproved: isApproved,
          payrollAdjustmentAmount: String(adjAmount.toFixed(2)),
          reviewedById: reviewerId ? String(reviewerId) : null,
          reviewedByName: reviewerName,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payrollDiscrepancies.id, disc.id))
        .returning();

      return NextResponse.json({
        success: true,
        message: `Discrepancy ${disc.discrepancyNumber} marked as ${updated.resolutionStatus} (${updated.reviewerAndApprovalStatus}).`,
        discrepancy: updated,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to update payroll discrepancy:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
