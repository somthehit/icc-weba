// db/schema/accounting-enterprise.ts
// Enterprise Nepal Double-Entry Accounting, Fiscal Periods, Bank Reconciliations, Z-Reports, and Supplier Payments

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { accounts, journalEntries, journalLines, suppliers, purchaseBills } from './accounting';
import { orders } from './orders';
import { posShifts } from './pos';

// =============================================================================
// 1. FISCAL PERIODS (Nepal Fiscal Year 2082/83, Shrawan to Ashadh)
// =============================================================================
export const fiscalPeriods = pgTable(
  'fiscal_periods',
  {
    id: serial('id').primaryKey(),
    fiscalYear: varchar('fiscal_year', { length: 20 }).notNull(), // e.g. "2082/83"
    periodNumber: integer('period_number').notNull(), // 1 (Shrawan) to 12 (Ashadh)
    monthNameBs: varchar('month_name_bs', { length: 30 }).notNull(), // Shrawan, Bhadra, etc.
    startDateAd: date('start_date_ad', { mode: 'string' }).notNull(),
    endDateAd: date('end_date_ad', { mode: 'string' }).notNull(),
    isLocked: boolean('is_locked').notNull().default(false),
    lockedAt: timestamp('locked_at'),
    lockedById: integer('locked_by_id').references(() => users.id, { onDelete: 'set null' }),
    lockedByName: varchar('locked_by_name', { length: 150 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    fyPeriodIdx: uniqueIndex('fiscal_periods_fy_period_idx').on(t.fiscalYear, t.periodNumber),
    isLockedIdx: index('fiscal_periods_is_locked_idx').on(t.isLocked),
  })
);

// =============================================================================
// 2. BANK & DIGITAL WALLET ACCOUNTS (Nabil, Global IME, eSewa, Khalti, Fonepay)
// =============================================================================
export type BankAccountType = 'bank' | 'esewa' | 'khalti' | 'fonepay' | 'connect_ips' | 'vault' | 'cod_clearing';

export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: serial('id').primaryKey(),
    accountName: varchar('account_name', { length: 150 }).notNull(), // e.g. "Nabil Bank Operating A/C"
    accountNumber: varchar('account_number', { length: 60 }).notNull(),
    maskedAccountNumber: varchar('masked_account_number', { length: 60 }),
    bankName: varchar('bank_name', { length: 100 }).notNull(),
    provider: varchar('provider', { length: 80 }), // e.g. "Nabil Bank", "eSewa", "NIMB Bank", "Khalti", "Fonepay"
    branch: varchar('branch', { length: 100 }),
    currency: varchar('currency', { length: 10 }).notNull().default('NPR'),
    accountType: varchar('account_type', { length: 30 })
      .$type<BankAccountType>()
      .notNull()
      .default('bank'),
    chartAccountId: integer('chart_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    openingBalance: numeric('opening_balance', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    currentBalance: numeric('current_balance', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    accNumberIdx: uniqueIndex('bank_accounts_number_idx').on(t.accountNumber),
    typeIdx: index('bank_accounts_type_idx').on(t.accountType),
  })
);

// =============================================================================
// 3. STATEMENT IMPORTS & BATCH AUDITING
// =============================================================================
export const statementImports = pgTable(
  'statement_imports',
  {
    id: serial('id').primaryKey(),
    bankAccountId: integer('bank_account_id')
      .notNull()
      .references(() => bankAccounts.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 255 }).notNull(),
    fileHash: varchar('file_hash', { length: 128 }).notNull(), // SHA-256 duplicate file prevention
    importSource: varchar('import_source', { length: 40 }).default('csv'), // 'csv' | 'excel' | 'pdf' | 'api' | 'manual'
    totalRows: integer('total_rows').default(0),
    importedRows: integer('imported_rows').default(0),
    skippedDuplicates: integer('skipped_duplicates').default(0),
    openingBalance: numeric('opening_balance', { precision: 14, scale: 2 }),
    closingBalance: numeric('closing_balance', { precision: 14, scale: 2 }),
    status: varchar('status', { length: 30 }).default('completed'), // 'completed' | 'rolled_back' | 'failed'
    importedById: integer('imported_by_id').references(() => users.id, { onDelete: 'set null' }),
    importedByName: varchar('imported_by_name', { length: 150 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    bankIdx: index('stmt_import_bank_idx').on(t.bankAccountId),
    hashIdx: index('stmt_import_hash_idx').on(t.fileHash),
  })
);

// =============================================================================
// 4. BANK / WALLET STATEMENTS & AUTO-RECONCILIATION
// =============================================================================
export const bankStatements = pgTable(
  'bank_statements',
  {
    id: serial('id').primaryKey(),
    bankAccountId: integer('bank_account_id')
      .notNull()
      .references(() => bankAccounts.id, { onDelete: 'cascade' }),
    importId: integer('import_id').references(() => statementImports.id, { onDelete: 'set null' }),
    statementDate: date('statement_date', { mode: 'string' }).notNull(),
    valueDate: date('value_date', { mode: 'string' }),
    description: varchar('description', { length: 500 }).notNull(),
    referenceNo: varchar('reference_no', { length: 120 }), // Cheque, UTR, Txn ID, Order ID
    debitAmount: numeric('debit_amount', { precision: 14, scale: 2 }).notNull().default('0'), // Deposit (Money in)
    creditAmount: numeric('credit_amount', { precision: 14, scale: 2 }).notNull().default('0'), // Withdrawal (Money out)
    balanceAfter: numeric('balance_after', { precision: 14, scale: 2 }),
    rowFingerprint: varchar('row_fingerprint', { length: 128 }), // SHA-256 row-level duplicate protection
    isReconciled: boolean('is_reconciled').notNull().default(false),
    matchConfidence: numeric('match_confidence', { precision: 5, scale: 2 }),
    matchType: varchar('match_type', { length: 50 }), // 'exact_ref' | 'amount_date' | 'batch_pos' | 'gateway_net' | 'manual' | 'adjustment'
    matchedJournalId: integer('matched_journal_id').references(() => journalEntries.id, {
      onDelete: 'set null',
    }),
    reconciledAt: timestamp('reconciled_at'),
    reconciledById: integer('reconciled_by_id').references(() => users.id, { onDelete: 'set null' }),
    reconciledByName: varchar('reconciled_by_name', { length: 150 }),
    suspenseStatus: varchar('suspense_status', { length: 30 }).default('none'), // 'none' | 'pending' | 'resolved'
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    bankDateIdx: index('bank_statements_bank_date_idx').on(t.bankAccountId, t.statementDate),
    reconciledIdx: index('bank_statements_reconciled_idx').on(t.isReconciled),
    fingerprintIdx: index('stmt_fingerprint_idx').on(t.rowFingerprint),
    importIdIdx: index('stmt_import_id_idx').on(t.importId),
  })
);

// =============================================================================
// 5. RECONCILIATION MATCHES (1-to-many, many-to-one, order/shift links)
// =============================================================================
export const reconciliationMatches = pgTable(
  'reconciliation_matches',
  {
    id: serial('id').primaryKey(),
    statementId: integer('statement_id')
      .notNull()
      .references(() => bankStatements.id, { onDelete: 'cascade' }),
    journalLineId: integer('journal_line_id').references(() => journalLines.id, { onDelete: 'set null' }),
    journalEntryId: integer('journal_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    posShiftId: integer('pos_shift_id').references(() => posShifts.id, { onDelete: 'set null' }),
    matchedAmount: numeric('matched_amount', { precision: 14, scale: 2 }).notNull(),
    matchConfidence: numeric('match_confidence', { precision: 5, scale: 2 }).default('100'),
    matchType: varchar('match_type', { length: 50 }).default('exact_ref'),
    notes: text('notes'),
    createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    stmtIdx: index('recon_match_stmt_idx').on(t.statementId),
    jlIdx: index('recon_match_jl_idx').on(t.journalLineId),
  })
);

// =============================================================================
// 6. AUTO-MATCH RULES ENGINE
// =============================================================================
export const matchRules = pgTable(
  'match_rules',
  {
    id: serial('id').primaryKey(),
    priority: integer('priority').notNull().default(10), // Lower number = higher priority
    name: varchar('name', { length: 120 }).notNull(),
    bankAccountId: integer('bank_account_id').references(() => bankAccounts.id, { onDelete: 'cascade' }),
    matchType: varchar('match_type', { length: 50 }).notNull(), // 'exact_ref' | 'description_pattern' | 'amount_date' | 'gateway_fee'
    pattern: varchar('pattern', { length: 200 }).notNull(), // RegEx or keyword (e.g. "Fonepay*Payout", "ConnectIPS*")
    targetAccountId: integer('target_account_id').references(() => accounts.id, { onDelete: 'restrict' }),
    toleranceAmount: numeric('tolerance_amount', { precision: 10, scale: 2 }).default('0'),
    toleranceDays: integer('tolerance_days').default(3),
    confidenceScore: numeric('confidence_score', { precision: 5, scale: 2 }).default('90'),
    autoApply: boolean('auto_apply').default(true),
    isActive: boolean('is_active').default(true),
    createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  }
);

// =============================================================================
// 7. PERIOD RECONCILIATIONS & MAKER-CHECKER LOCKS
// =============================================================================
export const bankPeriodReconciliations = pgTable(
  'bank_period_reconciliations',
  {
    id: serial('id').primaryKey(),
    bankAccountId: integer('bank_account_id')
      .notNull()
      .references(() => bankAccounts.id, { onDelete: 'cascade' }),
    periodYear: integer('period_year').notNull(),
    periodMonth: integer('period_month').notNull(),
    periodMonthName: varchar('period_month_name', { length: 40 }),
    fiscalYear: varchar('fiscal_year', { length: 20 }).default('2082/83'),
    statementEndingBalance: numeric('statement_ending_balance', { precision: 14, scale: 2 }).notNull(),
    bookEndingBalance: numeric('book_ending_balance', { precision: 14, scale: 2 }).notNull(),
    depositsInTransit: numeric('deposits_in_transit', { precision: 14, scale: 2 }).default('0'),
    outstandingCheques: numeric('outstanding_cheques', { precision: 14, scale: 2 }).default('0'),
    bankChargesAdjustments: numeric('bank_charges_adjustments', { precision: 14, scale: 2 }).default('0'),
    adjustedBookBalance: numeric('adjusted_book_balance', { precision: 14, scale: 2 }).notNull(),
    variance: numeric('variance', { precision: 14, scale: 2 }).default('0'),
    status: varchar('status', { length: 30 }).default('open'), // 'open' | 'prepared' | 'approved_closed'
    preparedById: integer('prepared_by_id').references(() => users.id, { onDelete: 'set null' }),
    preparedByName: varchar('prepared_by_name', { length: 150 }),
    preparedAt: timestamp('prepared_at'),
    approvedById: integer('approved_by_id').references(() => users.id, { onDelete: 'set null' }),
    approvedByName: varchar('approved_by_name', { length: 150 }),
    approvedAt: timestamp('approved_at'),
    lockSignature: varchar('lock_signature', { length: 128 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    accPeriodIdx: uniqueIndex('bpr_acc_period_idx').on(t.bankAccountId, t.periodYear, t.periodMonth),
  })
);

// =============================================================================
// 8. CHEQUE LIFECYCLE MANAGEMENT
// =============================================================================
export const cheques = pgTable(
  'cheques',
  {
    id: serial('id').primaryKey(),
    bankAccountId: integer('bank_account_id')
      .notNull()
      .references(() => bankAccounts.id, { onDelete: 'cascade' }),
    chequeNumber: varchar('cheque_number', { length: 50 }).notNull(),
    chequeType: varchar('cheque_type', { length: 20 }).notNull().default('outward'), // 'inward' | 'outward'
    payeeOrDrawer: varchar('payee_or_drawer', { length: 150 }).notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    issueDate: date('issue_date', { mode: 'string' }).notNull(),
    clearingDate: date('clearing_date', { mode: 'string' }),
    status: varchar('status', { length: 30 }).default('issued'), // 'issued' | 'presented' | 'cleared' | 'bounced' | 'stale'
    bounceReason: varchar('bounce_reason', { length: 200 }),
    relatedJournalId: integer('related_journal_id').references(() => journalEntries.id, { onDelete: 'set null' }),
    relatedSupplierPaymentId: integer('related_supplier_payment_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    numIdx: index('cheques_num_idx').on(t.chequeNumber),
    accStatusIdx: index('cheques_acc_status_idx').on(t.bankAccountId, t.status),
  })
);

// =============================================================================
// 9. RECONCILIATION AUDIT LOG (Tamper-evident)
// =============================================================================
export const reconciliationAuditLogs = pgTable(
  'reconciliation_audit_logs',
  {
    id: serial('id').primaryKey(),
    action: varchar('action', { length: 50 }).notNull(), // 'import' | 'match' | 'unmatch' | 'adjustment' | 'close_period' | 'reopen_period' | 'rollback_import'
    bankAccountId: integer('bank_account_id').references(() => bankAccounts.id, { onDelete: 'set null' }),
    statementId: integer('statement_id').references(() => bankStatements.id, { onDelete: 'set null' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    userName: varchar('user_name', { length: 150 }),
    detailsJson: jsonb('details_json'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    actionIdx: index('recon_audit_action_idx').on(t.action),
    accIdx: index('recon_audit_acc_idx').on(t.bankAccountId),
  })
);

// =============================================================================
// 4. SUPPLIER PAYMENTS & TDS ALLOCATIONS
// =============================================================================
export const supplierPayments = pgTable(
  'supplier_payments',
  {
    id: serial('id').primaryKey(),
    paymentNumber: varchar('payment_number', { length: 60 }).notNull(), // e.g. "SPAY-2026-0001"
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    billId: integer('bill_id').references(() => purchaseBills.id, { onDelete: 'set null' }),
    amountPaid: numeric('amount_paid', { precision: 14, scale: 2 }).notNull(),
    tdsRate: numeric('tds_rate', { precision: 5, scale: 2 }).notNull().default('1.5'), // Nepal TDS 1.5% on contracts/supplies
    tdsAmount: numeric('tds_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    netDisbursed: numeric('net_disbursed', { precision: 14, scale: 2 }).notNull(),
    paymentDate: date('payment_date', { mode: 'string' }).notNull(),
    paymentMethod: varchar('payment_method', { length: 40 }).notNull().default('bank_transfer'),
    bankAccountId: integer('bank_account_id').references(() => bankAccounts.id, {
      onDelete: 'set null',
    }),
    chequeOrRefNo: varchar('cheque_or_ref_no', { length: 80 }),
    journalEntryId: integer('journal_entry_id').references(() => journalEntries.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdByName: varchar('created_by_name', { length: 150 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    paymentNumIdx: uniqueIndex('supplier_payments_num_idx').on(t.paymentNumber),
    supplierIdx: index('supplier_payments_supplier_idx').on(t.supplierId),
    dateIdx: index('supplier_payments_date_idx').on(t.paymentDate),
  })
);

// =============================================================================
// 5. IMMUTABLE Z-REPORTS (CRYPTOGRAPHIC EOD FISCAL LOCKS)
// =============================================================================
export const zReports = pgTable(
  'z_reports',
  {
    id: serial('id').primaryKey(),
    reportNumber: varchar('report_number', { length: 60 }).notNull(), // e.g. "Z-2026-1002"
    businessDate: date('business_date', { mode: 'string' }).notNull(),
    fiscalYear: varchar('fiscal_year', { length: 20 }).notNull().default('2082/83'),
    grossSales: numeric('gross_sales', { precision: 14, scale: 2 }).notNull(),
    discountsTotal: numeric('discounts_total', { precision: 14, scale: 2 }).notNull().default('0'),
    returnsTotal: numeric('returns_total', { precision: 14, scale: 2 }).notNull().default('0'),
    taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 }).notNull(),
    vatAmount: numeric('vat_amount', { precision: 14, scale: 2 }).notNull(),
    netSales: numeric('net_sales', { precision: 14, scale: 2 }).notNull(),
    cashExpected: numeric('cash_expected', { precision: 14, scale: 2 }).notNull(),
    cashCounted: numeric('cash_counted', { precision: 14, scale: 2 }).notNull(),
    cashVariance: numeric('cash_variance', { precision: 14, scale: 2 }).notNull().default('0'),
    paymentSummaryJson: jsonb('payment_summary_json').notNull(),
    shiftsSummaryJson: jsonb('shifts_summary_json').notNull(),
    sha256Hash: varchar('sha256_hash', { length: 100 }).notNull(),
    isLocked: boolean('is_locked').notNull().default(true),
    closedById: integer('closed_by_id').references(() => users.id, { onDelete: 'set null' }),
    closedByName: varchar('closed_by_name', { length: 150 }),
    closedAt: timestamp('closed_at').notNull().defaultNow(),
  },
  (t) => ({
    reportNumIdx: uniqueIndex('z_reports_num_idx').on(t.reportNumber),
    businessDateIdx: uniqueIndex('z_reports_business_date_idx').on(t.businessDate),
  })
);

// =============================================================================
// RELATIONS
// =============================================================================
export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  chartAccount: one(accounts, { fields: [bankAccounts.chartAccountId], references: [accounts.id] }),
  statements: many(bankStatements),
  payments: many(supplierPayments),
}));

export const statementImportsRelations = relations(statementImports, ({ one, many }) => ({
  bankAccount: one(bankAccounts, { fields: [statementImports.bankAccountId], references: [bankAccounts.id] }),
  statements: many(bankStatements),
}));

export const bankStatementsRelations = relations(bankStatements, ({ one, many }) => ({
  bankAccount: one(bankAccounts, {
    fields: [bankStatements.bankAccountId],
    references: [bankAccounts.id],
  }),
  statementImport: one(statementImports, {
    fields: [bankStatements.importId],
    references: [statementImports.id],
  }),
  matchedJournal: one(journalEntries, {
    fields: [bankStatements.matchedJournalId],
    references: [journalEntries.id],
  }),
  matches: many(reconciliationMatches),
}));

export const reconciliationMatchesRelations = relations(reconciliationMatches, ({ one }) => ({
  statement: one(bankStatements, { fields: [reconciliationMatches.statementId], references: [bankStatements.id] }),
  journalLine: one(journalLines, { fields: [reconciliationMatches.journalLineId], references: [journalLines.id] }),
  journalEntry: one(journalEntries, { fields: [reconciliationMatches.journalEntryId], references: [journalEntries.id] }),
  order: one(orders, { fields: [reconciliationMatches.orderId], references: [orders.id] }),
  posShift: one(posShifts, { fields: [reconciliationMatches.posShiftId], references: [posShifts.id] }),
}));

export const supplierPaymentsRelations = relations(supplierPayments, ({ one }) => ({
  supplier: one(suppliers, { fields: [supplierPayments.supplierId], references: [suppliers.id] }),
  bill: one(purchaseBills, { fields: [supplierPayments.billId], references: [purchaseBills.id] }),
  journalEntry: one(journalEntries, {
    fields: [supplierPayments.journalEntryId],
    references: [journalEntries.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [supplierPayments.bankAccountId],
    references: [bankAccounts.id],
  }),
}));
