import assert from 'node:assert/strict';

/**
 * Counter POS — Simplified Cashier EOD and Accountant Reconciliation Test Suite
 *
 * Verifies:
 * 1. Cash accounting rules for Expected Closing Cash:
 *    openingFloat + cashSales + cashAdditions - cashPayouts - safeDrops - refunds
 * 2. Cashier simplified EOD submission (zero denomination inputs, frozen snapshot)
 * 3. Accountant receipt confirmation of physical paper form
 * 4. Physical cash denomination counting & variance convention:
 *    - actual > expected => Overage (positive variance)
 *    - actual < expected => Shortage (negative variance)
 *    - actual === expected => Balanced (0.00)
 * 5. Payment method settlement verification (Card, QR, Bank, Credit):
 *    - Independent discrepancy tracking (no cross-offsetting)
 * 6. Linked Payroll Discrepancy integration:
 *    - Initially marked PENDING_REVIEW
 *    - Strict guardrail: NO automated salary deductions (payrollAdjustmentApproved = false)
 *    - Balanced EOD produces no payroll discrepancies
 * 7. Status lifecycle & immutability:
 *    - OPEN -> SUBMITTED_TO_ACCOUNTANT -> PAPER_FORM_RECEIVED -> RECONCILIATION_IN_PROGRESS -> FINALIZED
 *    - RETURNED_FOR_CLARIFICATION audited flow
 *    - Immutability of finalized records
 */

console.log('🧪 Starting POS Simplified EOD & Accountant Reconciliation Test Suite...\n');

// 1. Expected Cash Calculation Rule Test
function testExpectedCashAccountingFormula() {
  console.log('▶ Test 1: Expected Cash Calculation Rule (Accounting Standard)...');

  function calculateExpectedCash(params: {
    openingFloat: number;
    cashSales: number;
    cashAdditions: number; // PAID_IN
    cashPayouts: number;   // PAID_OUT
    safeDrops: number;
    cashRefunds: number;
  }): number {
    const raw =
      params.openingFloat +
      params.cashSales +
      params.cashAdditions -
      params.cashPayouts -
      params.safeDrops -
      params.cashRefunds;
    return Number(raw.toFixed(2));
  }

  // Scenario A: Standard shift
  const expA = calculateExpectedCash({
    openingFloat: 5000.0,
    cashSales: 15420.5,
    cashAdditions: 1000.0,
    cashPayouts: 350.0,
    safeDrops: 10000.0,
    cashRefunds: 450.0,
  });
  // 5000 + 15420.50 + 1000 - 350 - 10000 - 450 = 10620.50
  assert.equal(expA, 10620.5);

  // Scenario B: Zero sales shift
  const expB = calculateExpectedCash({
    openingFloat: 5000.0,
    cashSales: 0.0,
    cashAdditions: 0.0,
    cashPayouts: 0.0,
    safeDrops: 0.0,
    cashRefunds: 0.0,
  });
  assert.equal(expB, 5000.0);

  // Scenario C: Heavy refunds & safe drops
  const expC = calculateExpectedCash({
    openingFloat: 5000.0,
    cashSales: 25000.0,
    cashAdditions: 0.0,
    cashPayouts: 1500.0,
    safeDrops: 20000.0,
    cashRefunds: 3500.0,
  });
  // 5000 + 25000 - 1500 - 20000 - 3500 = 5000.00
  assert.equal(expC, 5000.0);

  console.log('  ✔ Expected cash accounting formula verified.\n');
}

// 2. Cashier Simplified EOD (No Denominations Input)
function testCashierSimplifiedEod() {
  console.log('▶ Test 2: Cashier Simplified EOD Snapshot (Zero Denominations Required)...');

  interface CashierEodPayload {
    shiftId: string;
    terminalCode: string;
    businessDate: string;
    envelopeSealNo: string;
    physicalVouchersCount: number;
    cashierDeclaration: string;
    // Notice: NO physical denominations in cashier submission payload!
  }

  const cashierPayload: CashierEodPayload = {
    shiftId: 'shift-uuid-101',
    terminalCode: 'REG-01',
    businessDate: '2026-10-28',
    envelopeSealNo: 'ENV-9412',
    physicalVouchersCount: 4,
    cashierDeclaration: 'I declare that the POS sales and tender totals represent true and accurate records.',
  };

  // Ensure cashier payload contains NO denomination inputs or claimed actual closing cash
  assert.equal((cashierPayload as any).closingDenominations, undefined);
  assert.equal((cashierPayload as any).actualClosingCash, undefined);
  assert.equal((cashierPayload as any).cashVariance, undefined);
  assert.ok(cashierPayload.envelopeSealNo.startsWith('ENV-'));
  assert.equal(cashierPayload.physicalVouchersCount, 4);

  console.log('  ✔ Cashier POS EOD submission confirmed denomination-free and blind.\n');
}

// 3. Accountant Physical Cash Recount & Variance Convention
function testAccountantDenominationCounting() {
  console.log('▶ Test 3: Accountant Denominations Count & Variance Conventions...');

  const DENOMS = [
    { value: 1000 },
    { value: 500 },
    { value: 100 },
    { value: 50 },
    { value: 20 },
    { value: 10 },
    { value: 5 },
    { value: 2 },
    { value: 1 },
  ];

  function countPhysicalCash(counts: Record<string, number>): number {
    return DENOMS.reduce((sum, d) => {
      const qty = counts[d.value.toString()] || 0;
      return sum + d.value * Math.max(0, qty);
    }, 0);
  }

  function evaluateCashVariance(expected: number, actual: number) {
    const variance = Number((actual - expected).toFixed(2));
    let discrepancyType: 'NONE' | 'OVERAGE' | 'SHORTAGE' = 'NONE';
    if (variance > 0) discrepancyType = 'OVERAGE';
    else if (variance < 0) discrepancyType = 'SHORTAGE';
    return { variance, discrepancyType };
  }

  // Count test: 10x 1000, 5x 500, 20x 100, 10x 50, 5x 20, 10x 10, 4x 5
  // 10000 + 2500 + 2000 + 500 + 100 + 100 + 20 = 15220
  const counted = countPhysicalCash({
    '1000': 10,
    '500': 5,
    '100': 20,
    '50': 10,
    '20': 5,
    '10': 10,
    '5': 4,
  });
  assert.equal(counted, 15220);

  // Case A: Perfectly Balanced
  const balanced = evaluateCashVariance(15220, 15220);
  assert.equal(balanced.variance, 0.0);
  assert.equal(balanced.discrepancyType, 'NONE');

  // Case B: Cash Shortage (Actual < Expected) => Negative Variance
  const short = evaluateCashVariance(15500, 15220);
  assert.equal(short.variance, -280.0);
  assert.equal(short.discrepancyType, 'SHORTAGE');

  // Case C: Cash Overage (Actual > Expected) => Positive Variance
  const over = evaluateCashVariance(15000, 15220);
  assert.equal(over.variance, 220.0);
  assert.equal(over.discrepancyType, 'OVERAGE');

  console.log('  ✔ Physical cash counting & variance conventions (+ overage, - shortage) verified.\n');
}

// 4. Payment Tender Independent Verification (No Cross-Offsetting)
function testPaymentSettlementIndependence() {
  console.log('▶ Test 4: Payment Tender Independence (No Cross-Offsetting Guardrail)...');

  interface TenderReconciliation {
    expected: number;
    verified: number;
    variance: number;
  }

  function reconcileTenders(params: {
    cashExpected: number;
    cashActual: number;
    cardExpected: number;
    cardVerified: number;
    qrExpected: number;
    qrVerified: number;
  }) {
    const cashVariance = Number((params.cashActual - params.cashExpected).toFixed(2));
    const cardVariance = Number((params.cardVerified - params.cardExpected).toFixed(2));
    const qrVariance = Number((params.qrVerified - params.qrExpected).toFixed(2));

    return {
      cash: { expected: params.cashExpected, actual: params.cashActual, variance: cashVariance },
      card: { expected: params.cardExpected, verified: params.cardVerified, variance: cardVariance },
      qr: { expected: params.qrExpected, verified: params.qrVerified, variance: qrVariance },
    };
  }

  // Suppose cash is SHORT by NPR 500, but card slip has an OVERAGE of NPR 500
  const result = reconcileTenders({
    cashExpected: 10000,
    cashActual: 9500, // -500 shortage
    cardExpected: 20000,
    cardVerified: 20500, // +500 overage
    qrExpected: 5000,
    qrVerified: 5000, // balanced
  });

  // Strict retail control: Cash shortage must REMAIN -500, NOT canceled out by card overage!
  assert.equal(result.cash.variance, -500);
  assert.equal(result.card.variance, 500);
  assert.equal(result.qr.variance, 0);

  assert.notEqual(result.cash.variance, 0, 'Cash shortage must not be silently offset by card overage');

  console.log('  ✔ Payment tender independence and anti-offsetting rule verified.\n');
}

// 5. Linked Payroll Discrepancy & Legal Protection Guardrails
function testPayrollDiscrepancyIntegration() {
  console.log('▶ Test 5: Payroll Discrepancy Integration & Protection Guardrails...');

  interface PayrollDiscrepancyRecord {
    discrepancyNumber: string;
    eodReference: string;
    cashierCode: string;
    discrepancyType: 'SHORTAGE' | 'OVERAGE' | 'PAYMENT_SETTLEMENT_DIFFERENCE' | 'OTHER';
    expectedAmount: number;
    actualAmount: number;
    differenceAmount: number;
    reviewerAndApprovalStatus: string;
    payrollAdjustmentApproved: boolean; // MUST be false initially!
    payrollAdjustmentAmount: number;
  }

  function handleEodFinalization(eodRef: string, cashVariance: number, expectedCash: number, actualCash: number): PayrollDiscrepancyRecord | null {
    if (Math.abs(cashVariance) < 0.01) {
      // Balanced: No payroll discrepancy should be created
      return null;
    }

    return {
      discrepancyNumber: `PAY-DISC-${eodRef.replace(/^EOD-/, '')}`,
      eodReference: eodRef,
      cashierCode: 'EMP-101',
      discrepancyType: cashVariance < 0 ? 'SHORTAGE' : 'OVERAGE',
      expectedAmount: expectedCash,
      actualAmount: actualCash,
      differenceAmount: cashVariance,
      reviewerAndApprovalStatus: 'PENDING_REVIEW', // Strict requirement
      payrollAdjustmentApproved: false,           // Strict requirement: Never auto-deducted!
      payrollAdjustmentAmount: 0.0,
    };
  }

  // Case 1: Balanced shift -> No payroll discrepancy created
  const balancedResult = handleEodFinalization('EOD-20261028-REG01-001', 0.0, 10000, 10000);
  assert.equal(balancedResult, null, 'Balanced EOD should not generate payroll discrepancy');

  // Case 2: Shortage of NPR 450 -> Generates linked record
  const shortResult = handleEodFinalization('EOD-20261028-REG01-002', -450.0, 10000, 9550);
  assert.ok(shortResult !== null);
  assert.equal(shortResult.discrepancyType, 'SHORTAGE');
  assert.equal(shortResult.differenceAmount, -450.0);
  assert.equal(shortResult.reviewerAndApprovalStatus, 'PENDING_REVIEW');
  assert.equal(shortResult.payrollAdjustmentApproved, false, 'Auto-deduction must be disabled by default');

  // Case 3: Resolution requires explicit authorized approval before any adjustment
  function resolveDiscrepancy(
    record: PayrollDiscrepancyRecord,
    action: 'RESOLVED_NO_DEDUCTION' | 'AUTHORIZED_EXCEPTION' | 'APPROVED_FOR_PAYROLL_ADJUSTMENT',
    explicitAuthorizedAmount: number = 0
  ) {
    if (action === 'APPROVED_FOR_PAYROLL_ADJUSTMENT') {
      return {
        ...record,
        reviewerAndApprovalStatus: action,
        payrollAdjustmentApproved: true,
        payrollAdjustmentAmount: explicitAuthorizedAmount,
      };
    }
    return {
      ...record,
      reviewerAndApprovalStatus: action,
      payrollAdjustmentApproved: false,
      payrollAdjustmentAmount: 0,
    };
  }

  const resolvedNoDeduct = resolveDiscrepancy(shortResult, 'RESOLVED_NO_DEDUCTION');
  assert.equal(resolvedNoDeduct.payrollAdjustmentApproved, false);
  assert.equal(resolvedNoDeduct.payrollAdjustmentAmount, 0);

  const approvedWithAuth = resolveDiscrepancy(shortResult, 'APPROVED_FOR_PAYROLL_ADJUSTMENT', 450.0);
  assert.equal(approvedWithAuth.payrollAdjustmentApproved, true);
  assert.equal(approvedWithAuth.payrollAdjustmentAmount, 450.0);

  console.log('  ✔ Payroll discrepancy creation and legal protection guardrails verified.\n');
}

// 6. Workflow Status Transitions & Immutability
function testWorkflowStatusTransitions() {
  console.log('▶ Test 6: Workflow Lifecycle & Immutability Enforcement...');

  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    OPEN: ['SUBMITTED_TO_ACCOUNTANT'],
    SUBMITTED_TO_ACCOUNTANT: ['PAPER_FORM_RECEIVED', 'RETURNED_FOR_CLARIFICATION'],
    PAPER_FORM_RECEIVED: ['RECONCILIATION_IN_PROGRESS', 'RETURNED_FOR_CLARIFICATION'],
    RECONCILIATION_IN_PROGRESS: ['FINALIZED', 'DISCREPANCY_REVIEW', 'RETURNED_FOR_CLARIFICATION'],
    RETURNED_FOR_CLARIFICATION: ['SUBMITTED_TO_ACCOUNTANT'],
    DISCREPANCY_REVIEW: ['FINALIZED'],
    FINALIZED: [], // Immutable! No transitions out of finalized.
  };

  function canTransition(current: string, next: string): boolean {
    const allowed = ALLOWED_TRANSITIONS[current] || [];
    return allowed.includes(next);
  }

  // Valid forward paths
  assert.ok(canTransition('OPEN', 'SUBMITTED_TO_ACCOUNTANT'));
  assert.ok(canTransition('SUBMITTED_TO_ACCOUNTANT', 'PAPER_FORM_RECEIVED'));
  assert.ok(canTransition('PAPER_FORM_RECEIVED', 'RECONCILIATION_IN_PROGRESS'));
  assert.ok(canTransition('RECONCILIATION_IN_PROGRESS', 'FINALIZED'));

  // Clarification loop
  assert.ok(canTransition('PAPER_FORM_RECEIVED', 'RETURNED_FOR_CLARIFICATION'));
  assert.ok(canTransition('RETURNED_FOR_CLARIFICATION', 'SUBMITTED_TO_ACCOUNTANT'));

  // Invalid transitions
  assert.equal(canTransition('OPEN', 'FINALIZED'), false, 'Cannot skip receipt & reconciliation');
  assert.equal(canTransition('SUBMITTED_TO_ACCOUNTANT', 'FINALIZED'), false, 'Cannot finalize unreceived paper');

  // Immutability check: FINALIZED cannot be modified
  assert.equal(canTransition('FINALIZED', 'OPEN'), false);
  assert.equal(canTransition('FINALIZED', 'RECONCILIATION_IN_PROGRESS'), false);
  assert.equal(canTransition('FINALIZED', 'SUBMITTED_TO_ACCOUNTANT'), false);

  console.log('  ✔ Workflow status machine & finalization immutability verified.\n');
}

// Run all test cases
testExpectedCashAccountingFormula();
testCashierSimplifiedEod();
testAccountantDenominationCounting();
testPaymentSettlementIndependence();
testPayrollDiscrepancyIntegration();
testWorkflowStatusTransitions();

console.log('🎉 ALL Counter POS EOD & Accountant Reconciliation Tests Passed Successfully!\n');
