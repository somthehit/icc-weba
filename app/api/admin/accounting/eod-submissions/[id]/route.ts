import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  posEodSubmissions,
  posShifts,
  payrollDiscrepancies,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NEPALI_DENOMINATIONS } from '@/components/pos/BodFloatInputModal';

function calculateDenominationTotal(denoms: Record<string, number> = {}): number {
  return NEPALI_DENOMINATIONS.reduce((sum, d) => {
    const qty = Number(denoms[d.value.toString()]) || 0;
    return sum + d.value * Math.max(0, qty);
  }, 0);
}

// GET: Single Submission details with linked payroll discrepancy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [sub] = await db
      .select()
      .from(posEodSubmissions)
      .where(eq(posEodSubmissions.id, id))
      .limit(1);

    if (!sub) {
      return NextResponse.json({ success: false, error: 'EOD submission not found.' }, { status: 404 });
    }

    // Fetch linked payroll discrepancy if any
    const [linkedDiscrepancy] = await db
      .select()
      .from(payrollDiscrepancies)
      .where(eq(payrollDiscrepancies.eodSubmissionId, sub.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      submission: sub,
      linkedDiscrepancy: linkedDiscrepancy || null,
    });
  } catch (error: any) {
    console.error('Failed to get EOD submission details:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Accountant Actions (confirm_receipt, save_draft, return_clarification, finalize)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      action,
      accountantName = 'Central Cash Accountant',
      accountantId,
      accountantDenominations = {},
      verifiedCardAmount,
      cardBatchNumber = '',
      verifiedQrAmount,
      qrSettlementRef = '',
      verifiedBankAmount,
      bankAdviceRef = '',
      verifiedCreditAmount,
      accountantRemarks = '',
      clarificationReason = '',
    } = body;

    const [sub] = await db
      .select()
      .from(posEodSubmissions)
      .where(eq(posEodSubmissions.id, id))
      .limit(1);

    if (!sub) {
      return NextResponse.json({ success: false, error: 'EOD submission not found.' }, { status: 404 });
    }

    // -----------------------------------------------------------------
    // ACTION 1: CONFIRM PAPER FORM RECEIPT
    // -----------------------------------------------------------------
    if (action === 'confirm_receipt') {
      const [updated] = await db
        .update(posEodSubmissions)
        .set({
          status: 'PAPER_FORM_RECEIVED',
          paperReceivedAt: new Date(),
          paperReceivedById: accountantId ? String(accountantId) : null,
          paperReceivedByName: accountantName,
          updatedAt: new Date(),
        })
        .where(eq(posEodSubmissions.id, sub.id))
        .returning();

      return NextResponse.json({
        success: true,
        message: `Paper EOD form for ${sub.eodReference} confirmed as received by ${accountantName}.`,
        submission: updated,
      });
    }

    // -----------------------------------------------------------------
    // ACTION 2: RETURN FOR CLARIFICATION
    // -----------------------------------------------------------------
    if (action === 'return_clarification') {
      if (!clarificationReason?.trim()) {
        return NextResponse.json(
          { success: false, error: 'Reason for requesting clarification is strictly required.' },
          { status: 400 }
        );
      }

      const currentHistory = Array.isArray(sub.amendmentHistory) ? sub.amendmentHistory : [];
      const newHistory = [
        ...currentHistory,
        {
          timestamp: new Date().toISOString(),
          action: 'RETURNED_FOR_CLARIFICATION',
          accountantName,
          reason: clarificationReason,
        },
      ];

      const [updated] = await db
        .update(posEodSubmissions)
        .set({
          status: 'RETURNED_FOR_CLARIFICATION',
          clarificationReason: clarificationReason.trim(),
          clarificationRequestedAt: new Date(),
          amendmentHistory: newHistory,
          updatedAt: new Date(),
        })
        .where(eq(posEodSubmissions.id, sub.id))
        .returning();

      return NextResponse.json({
        success: true,
        message: `EOD submission ${sub.eodReference} returned to Cashier for clarification.`,
        submission: updated,
      });
    }

    // -----------------------------------------------------------------
    // CALCULATE ACTUALS & VARIANCES
    // -----------------------------------------------------------------
    const actualCash = calculateDenominationTotal(accountantDenominations);
    const expectedCash = Number(sub.expectedClosingCash || 0);
    // Positive = Overage, Negative = Shortage
    const cashVariance = Number((actualCash - expectedCash).toFixed(2));

    const expectedCard = Number(sub.cardSales || 0);
    const actualCard = verifiedCardAmount !== undefined && verifiedCardAmount !== null
      ? Number(verifiedCardAmount)
      : expectedCard;
    const cardVariance = Number((actualCard - expectedCard).toFixed(2));

    const expectedQr = Number(sub.qrSales || 0);
    const actualQr = verifiedQrAmount !== undefined && verifiedQrAmount !== null
      ? Number(verifiedQrAmount)
      : expectedQr;
    const qrVariance = Number((actualQr - expectedQr).toFixed(2));

    const expectedBank = Number(sub.bankTransferSales || 0);
    const actualBank = verifiedBankAmount !== undefined && verifiedBankAmount !== null
      ? Number(verifiedBankAmount)
      : expectedBank;
    const bankVariance = Number((actualBank - expectedBank).toFixed(2));

    const expectedCredit = Number(sub.creditSales || 0);
    const actualCredit = verifiedCreditAmount !== undefined && verifiedCreditAmount !== null
      ? Number(verifiedCreditAmount)
      : expectedCredit;

    const totalVariance = Number((cashVariance + cardVariance + qrVariance + bankVariance).toFixed(2));

    // Determine discrepancy type
    let discrepancyType = 'NONE';
    const hasCashVariance = Math.abs(cashVariance) >= 0.01;
    const hasPaymentDiff = Math.abs(cardVariance) >= 0.01 || Math.abs(qrVariance) >= 0.01 || Math.abs(bankVariance) >= 0.01;

    if (hasCashVariance && hasPaymentDiff) {
      discrepancyType = 'MULTIPLE';
    } else if (hasCashVariance) {
      discrepancyType = cashVariance > 0 ? 'OVERAGE' : 'SHORTAGE';
    } else if (hasPaymentDiff) {
      discrepancyType = 'PAYMENT_SETTLEMENT_DIFFERENCE';
    }

    // -----------------------------------------------------------------
    // ACTION 3: SAVE RECONCILIATION DRAFT
    // -----------------------------------------------------------------
    if (action === 'save_draft') {
      const [updated] = await db
        .update(posEodSubmissions)
        .set({
          status: 'RECONCILIATION_IN_PROGRESS',
          accountantDenominations,
          actualClosingCash: String(actualCash.toFixed(2)),
          verifiedCardAmount: String(actualCard.toFixed(2)),
          cardBatchNumber,
          verifiedQrAmount: String(actualQr.toFixed(2)),
          qrSettlementRef,
          verifiedBankAmount: String(actualBank.toFixed(2)),
          bankAdviceRef,
          verifiedCreditAmount: String(actualCredit.toFixed(2)),
          cashVariance: String(cashVariance.toFixed(2)),
          cardVariance: String(cardVariance.toFixed(2)),
          qrVariance: String(qrVariance.toFixed(2)),
          bankVariance: String(bankVariance.toFixed(2)),
          totalVariance: String(totalVariance.toFixed(2)),
          discrepancyType,
          accountantRemarks,
          reconciledById: accountantId ? String(accountantId) : null,
          reconciledByName: accountantName,
          reconciledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(posEodSubmissions.id, sub.id))
        .returning();

      return NextResponse.json({
        success: true,
        message: 'Reconciliation draft saved successfully.',
        submission: updated,
      });
    }

    // -----------------------------------------------------------------
    // ACTION 4: FINALIZE EOD RECONCILIATION
    // -----------------------------------------------------------------
    if (action === 'finalize') {
      if (sub.status === 'FINALIZED') {
        return NextResponse.json(
          { success: false, error: 'This EOD record has already been finalized.' },
          { status: 400 }
        );
      }

      const result = await db.transaction(async (tx) => {
        // 1. Update EOD Submission to FINALIZED
        const [finalizedSub] = await tx
          .update(posEodSubmissions)
          .set({
            status: 'FINALIZED',
            accountantDenominations,
            actualClosingCash: String(actualCash.toFixed(2)),
            verifiedCardAmount: String(actualCard.toFixed(2)),
            cardBatchNumber,
            verifiedQrAmount: String(actualQr.toFixed(2)),
            qrSettlementRef,
            verifiedBankAmount: String(actualBank.toFixed(2)),
            bankAdviceRef,
            verifiedCreditAmount: String(actualCredit.toFixed(2)),
            cashVariance: String(cashVariance.toFixed(2)),
            cardVariance: String(cardVariance.toFixed(2)),
            qrVariance: String(qrVariance.toFixed(2)),
            bankVariance: String(bankVariance.toFixed(2)),
            totalVariance: String(totalVariance.toFixed(2)),
            discrepancyType,
            accountantRemarks,
            finalizedById: accountantId ? String(accountantId) : null,
            finalizedByName: accountantName,
            finalizedAt: new Date(),
            reconciledById: accountantId ? String(accountantId) : null,
            reconciledByName: accountantName,
            reconciledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(posEodSubmissions.id, sub.id))
          .returning();

        // 2. If discrepancy exists, create linked Payroll Discrepancy record
        // STRICT GUARDRAIL: Marked initially as PENDING_REVIEW; NO automated payroll deductions!
        let createdDiscrepancy = null;
        if (discrepancyType !== 'NONE') {
          const discrepancyNumber = `PAY-DISC-${sub.eodReference.replace(/^EOD-/, '')}`;

          // Check if already created
          const [existingDisc] = await tx
            .select()
            .from(payrollDiscrepancies)
            .where(eq(payrollDiscrepancies.discrepancyNumber, discrepancyNumber))
            .limit(1);

          const discType =
            hasCashVariance && hasPaymentDiff
              ? 'OTHER'
              : hasCashVariance
              ? cashVariance > 0
                ? 'OVERAGE'
                : 'SHORTAGE'
              : 'PAYMENT_SETTLEMENT_DIFFERENCE';

          const primaryDiff = Math.abs(cashVariance) >= 0.01 ? cashVariance : totalVariance;
          const primaryExpected = Math.abs(cashVariance) >= 0.01 ? expectedCash : Number(sub.totalSales || 0);
          const primaryActual = Math.abs(cashVariance) >= 0.01 ? actualCash : (primaryExpected + primaryDiff);

          const valuesToSet = {
            discrepancyNumber,
            eodReference: sub.eodReference,
            eodSubmissionId: sub.id,
            shiftId: sub.shiftId,
            cashierEmployeeId: sub.cashierId ? String(sub.cashierId) : null,
            cashierCode: sub.cashierCode,
            cashierName: sub.cashierName,
            branch: sub.branch,
            registerCode: sub.registerCode,
            businessDate: sub.businessDate,
            discrepancyType: discType,
            expectedAmount: String(primaryExpected.toFixed(2)),
            actualAmount: String(primaryActual.toFixed(2)),
            differenceAmount: String(primaryDiff.toFixed(2)),
            paymentMethod: hasCashVariance ? 'CASH' : 'CARD',
            accountantRemarks:
              accountantRemarks ||
              `Discrepancy recorded during Accountant EOD count. Cash Variance: NPR ${cashVariance.toFixed(2)}, Card Variance: NPR ${cardVariance.toFixed(2)}, QR Variance: NPR ${qrVariance.toFixed(2)}.`,
            cashierExplanation: sub.cashierNotes || 'None submitted at handover.',
            reviewerAndApprovalStatus: 'PENDING_REVIEW',
            resolutionStatus: 'PENDING',
            payrollPeriodReference: `PAYROLL-${sub.businessDate.slice(0, 7)}`,
            reviewedById: null,
            reviewedByName: null,
            reviewedAt: null,
            payrollAdjustmentApproved: false, // GUARDRAIL: False by default!
            payrollAdjustmentAmount: '0.00',
            updatedAt: new Date(),
          };

          if (existingDisc) {
            const [upd] = await tx
              .update(payrollDiscrepancies)
              .set(valuesToSet)
              .where(eq(payrollDiscrepancies.id, existingDisc.id))
              .returning();
            createdDiscrepancy = upd;
          } else {
            const [ins] = await tx
              .insert(payrollDiscrepancies)
              .values(valuesToSet)
              .returning();
            createdDiscrepancy = ins;
          }
        }

        // 3. Mark POS Shift as CLOSED
        if (sub.shiftId) {
          await tx
            .update(posShifts)
            .set({
              status: 'CLOSED',
              closingCash: String(actualCash.toFixed(2)),
              closingDenominations: accountantDenominations,
              cashDiscrepancy: String(cashVariance.toFixed(2)),
              closedAt: new Date(),
            })
            .where(eq(posShifts.id, sub.shiftId));
        }

        return { finalizedSub, createdDiscrepancy };
      });

      return NextResponse.json({
        success: true,
        message: `EOD ${sub.eodReference} has been FINALIZED successfully.${
          result.createdDiscrepancy
            ? ` Linked Payroll Discrepancy ${result.createdDiscrepancy.discrepancyNumber} created (Status: PENDING_REVIEW).`
            : ' Balanced register (no discrepancy recorded).'
        }`,
        submission: result.finalizedSub,
        discrepancy: result.createdDiscrepancy,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to execute accountant action on EOD submission:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
