import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  timestamp,
  text,
  jsonb,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { posShifts } from './pos';

export const posEodSubmissions = pgTable(
  'pos_eod_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eodReference: varchar('eod_reference', { length: 50 }).notNull().unique(), // e.g. "EOD-20261028-REG01-0042"
    shiftId: uuid('shift_id').references(() => posShifts.id, { onDelete: 'cascade' }),
    shiftNumber: varchar('shift_number', { length: 30 }).notNull(),
    businessDate: varchar('business_date', { length: 12 }).notNull(), // e.g. "2026-10-28"
    branch: varchar('branch', { length: 100 }).notNull().default('Dhangadhi Main Branch'),
    registerCode: varchar('register_code', { length: 30 }).notNull().default('REG-01'),
    cashierId: uuid('cashier_id'),
    cashierCode: varchar('cashier_code', { length: 50 }).notNull().default('EMP-101'),
    cashierName: varchar('cashier_name', { length: 150 }).notNull(),
    
    // Read-only POS Totals Snapshot (Frozen)
    openingFloat: numeric('opening_float', { precision: 12, scale: 2 }).notNull().default('0.00'),
    totalSales: numeric('total_sales', { precision: 12, scale: 2 }).notNull().default('0.00'),
    cashSales: numeric('total_cash_sales', { precision: 12, scale: 2 }).notNull().default('0.00'),
    cardSales: numeric('total_card_sales', { precision: 12, scale: 2 }).notNull().default('0.00'),
    qrSales: numeric('total_qr_sales', { precision: 12, scale: 2 }).notNull().default('0.00'),
    bankTransferSales: numeric('total_bank_sales', { precision: 12, scale: 2 }).notNull().default('0.00'),
    creditSales: numeric('total_credit_sales', { precision: 12, scale: 2 }).notNull().default('0.00'),
    refundsAmount: numeric('refunds_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    voidsCount: integer('voids_count').notNull().default(0),
    voidsAmount: numeric('voids_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    cashAdditions: numeric('cash_additions', { precision: 12, scale: 2 }).notNull().default('0.00'), // PAID_IN
    cashPayouts: numeric('cash_payouts', { precision: 12, scale: 2 }).notNull().default('0.00'),     // PAID_OUT
    safeDrops: numeric('safe_drops', { precision: 12, scale: 2 }).notNull().default('0.00'),
    expectedClosingCash: numeric('expected_closing_cash', { precision: 12, scale: 2 }).notNull().default('0.00'),
    totalTransactions: integer('total_transactions').notNull().default(0),
    taxableAmount: numeric('taxable_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    vatAmount: numeric('vat_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),

    // Handover Package Details
    envelopeSealNo: varchar('envelope_seal_no', { length: 100 }),
    physicalVouchersCount: integer('physical_vouchers_count').notNull().default(0),
    cashierNotes: text('cashier_notes'),
    cashierDeclaration: text('cashier_declaration'),
    submittedSnapshot: jsonb('submitted_snapshot').notNull(), // Complete frozen JSON of shift snapshot

    // Workflow Status:
    // OPEN -> SUBMITTED_TO_ACCOUNTANT -> PAPER_FORM_RECEIVED -> RECONCILIATION_IN_PROGRESS -> DISCREPANCY_REVIEW -> PENDING_FINAL_APPROVAL -> FINALIZED
    // (or RETURNED_FOR_CLARIFICATION)
    status: varchar('status', { length: 50 }).notNull().default('SUBMITTED_TO_ACCOUNTANT'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),

    // Step 2: Accountant Receipt Confirmation
    paperReceivedAt: timestamp('paper_received_at', { withTimezone: true }),
    paperReceivedById: uuid('paper_received_by_id'),
    paperReceivedByName: varchar('paper_received_by_name', { length: 150 }),

    // Step 3: Accountant Reconciliation (Separate from POS snapshot)
    accountantDenominations: jsonb('accountant_denominations').$type<Record<string, number>>(),
    actualClosingCash: numeric('actual_closing_cash', { precision: 12, scale: 2 }),
    verifiedCardAmount: numeric('verified_card_amount', { precision: 12, scale: 2 }),
    cardBatchNumber: varchar('card_batch_number', { length: 100 }),
    verifiedQrAmount: numeric('verified_qr_amount', { precision: 12, scale: 2 }),
    qrSettlementRef: varchar('qr_settlement_ref', { length: 100 }),
    verifiedBankAmount: numeric('verified_bank_amount', { precision: 12, scale: 2 }),
    bankAdviceRef: varchar('bank_advice_ref', { length: 100 }),
    verifiedCreditAmount: numeric('verified_credit_amount', { precision: 12, scale: 2 }),

    // Calculated Variances (Positive = Overage, Negative = Shortage)
    cashVariance: numeric('cash_variance', { precision: 12, scale: 2 }),
    cardVariance: numeric('card_variance', { precision: 12, scale: 2 }),
    qrVariance: numeric('qr_variance', { precision: 12, scale: 2 }),
    bankVariance: numeric('bank_variance', { precision: 12, scale: 2 }),
    totalVariance: numeric('total_variance', { precision: 12, scale: 2 }),
    discrepancyType: varchar('discrepancy_type', { length: 50 }).default('NONE'), // NONE, SHORTAGE, OVERAGE, PAYMENT_SETTLEMENT_DIFFERENCE, MULTIPLE
    accountantRemarks: text('accountant_remarks'),
    reconciledById: uuid('reconciled_by_id'),
    reconciledByName: varchar('reconciled_by_name', { length: 150 }),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),

    // Clarification Workflow
    clarificationReason: text('clarification_reason'),
    clarificationRequestedAt: timestamp('clarification_requested_at', { withTimezone: true }),

    // Final Approval & Audited Amendments
    finalizedById: uuid('finalized_by_id'),
    finalizedByName: varchar('finalized_by_name', { length: 150 }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    amendmentHistory: jsonb('amendment_history').$type<any[]>().default([]),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    referenceIdx: index('pos_eod_reference_idx').on(t.eodReference),
    shiftIdx: index('pos_eod_shift_idx').on(t.shiftId),
    businessDateIdx: index('pos_eod_business_date_idx').on(t.businessDate),
    statusIdx: index('pos_eod_status_idx').on(t.status),
    cashierIdx: index('pos_eod_cashier_idx').on(t.cashierId),
    registerIdx: index('pos_eod_register_idx').on(t.registerCode),
  })
);

export const payrollDiscrepancies = pgTable(
  'payroll_discrepancies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    discrepancyNumber: varchar('discrepancy_number', { length: 50 }).notNull().unique(), // e.g. "PAY-DISC-20261028-0001"
    eodReference: varchar('eod_reference', { length: 50 }).notNull(),
    eodSubmissionId: uuid('eod_submission_id').references(() => posEodSubmissions.id, { onDelete: 'cascade' }),
    shiftId: uuid('shift_id'),
    cashierEmployeeId: uuid('cashier_employee_id'),
    cashierCode: varchar('cashier_code', { length: 50 }).notNull(),
    cashierName: varchar('cashier_name', { length: 150 }).notNull(),
    branch: varchar('branch', { length: 100 }).notNull().default('Dhangadhi Main Branch'),
    registerCode: varchar('register_code', { length: 30 }).notNull().default('REG-01'),
    businessDate: varchar('business_date', { length: 12 }).notNull(),
    discrepancyType: varchar('discrepancy_type', { length: 50 }).notNull(), // 'SHORTAGE', 'OVERAGE', 'PAYMENT_SETTLEMENT_DIFFERENCE', 'OTHER'
    expectedAmount: numeric('expected_amount', { precision: 12, scale: 2 }).notNull(),
    actualAmount: numeric('actual_amount', { precision: 12, scale: 2 }).notNull(),
    differenceAmount: numeric('difference_amount', { precision: 12, scale: 2 }).notNull(), // positive or negative
    paymentMethod: varchar('payment_method', { length: 50 }).notNull().default('CASH'), // 'CASH', 'CARD', 'QR', 'BANK', 'CREDIT', 'ALL'
    accountantRemarks: text('accountant_remarks'),
    cashierExplanation: text('cashier_explanation'),
    
    // Status & Approval Governance
    // NEVER automatically deducted or added from payroll!
    reviewerAndApprovalStatus: varchar('reviewer_and_approval_status', { length: 50 }).notNull().default('PENDING_REVIEW'),
    // 'PENDING_REVIEW', 'UNDER_INVESTIGATION', 'AUTHORIZED_EXCEPTION', 'APPROVED_FOR_PAYROLL_ADJUSTMENT', 'RESOLVED_NO_DEDUCTION', 'REJECTED'
    resolutionStatus: varchar('resolution_status', { length: 50 }).notNull().default('PENDING'),
    // 'PENDING', 'RESOLVED', 'WAIVED', 'ESCALATED'
    payrollPeriodReference: varchar('payroll_period_reference', { length: 50 }), // e.g. "PAYROLL-2026-10"
    reviewedById: uuid('reviewed_by_id'),
    reviewedByName: varchar('reviewed_by_name', { length: 150 }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    investigationNotes: text('investigation_notes'),

    // Strict guardrails: Explicit manual authorization required before any payroll adjustment
    payrollAdjustmentApproved: boolean('payroll_adjustment_approved').notNull().default(false),
    payrollAdjustmentAmount: numeric('payroll_adjustment_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    discrepancyNumberIdx: index('payroll_disc_number_idx').on(t.discrepancyNumber),
    eodRefIdx: index('payroll_disc_eod_ref_idx').on(t.eodReference),
    cashierIdx: index('payroll_disc_cashier_idx').on(t.cashierEmployeeId),
    approvalStatusIdx: index('payroll_disc_approval_status_idx').on(t.reviewerAndApprovalStatus),
    resolutionStatusIdx: index('payroll_disc_resolution_status_idx').on(t.resolutionStatus),
  })
);
