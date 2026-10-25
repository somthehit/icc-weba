import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  timestamp,
  text,
  jsonb,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const posShifts = pgTable(
  'pos_shifts',
  {
    id: serial('id').primaryKey(),
    shiftNumber: varchar('shift_number', { length: 30 }).notNull(), // e.g. "SHIFT-2026-0042"
    registerCode: varchar('register_code', { length: 30 }).notNull().default('REG-01'),
    cashierId: integer('cashier_id').references(() => users.id, { onDelete: 'set null' }),
    cashierName: varchar('cashier_name', { length: 150 }).notNull(),
    cashierCode: varchar('cashier_code', { length: 50 }).notNull().default('EMP-101'),
    openingFloat: numeric('opening_float', { precision: 12, scale: 2 }).notNull().default('0'),
    openingDenominations: jsonb('opening_denominations').$type<Record<string, number>>(),
    standardFloat: numeric('standard_float', { precision: 12, scale: 2 }).notNull().default('5000.00'),
    handoverVariance: numeric('handover_variance', { precision: 12, scale: 2 }).default('0.00'),
    previousShiftId: integer('previous_shift_id'),
    closingCash: numeric('closing_cash', { precision: 12, scale: 2 }),
    closingDenominations: jsonb('closing_denominations').$type<Record<string, number>>(),
    expectedCash: numeric('expected_cash', { precision: 12, scale: 2 }).notNull().default('0'),
    cashDiscrepancy: numeric('cash_discrepancy', { precision: 12, scale: 2 }),
    totalSales: numeric('total_sales', { precision: 12, scale: 2 }).notNull().default('0'),
    totalCashSales: numeric('total_cash_sales', { precision: 12, scale: 2 }).notNull().default('0'),
    totalCardSales: numeric('total_card_sales', { precision: 12, scale: 2 }).notNull().default('0'),
    totalQrSales: numeric('total_qr_sales', { precision: 12, scale: 2 }).notNull().default('0'),
    totalTransactions: integer('total_transactions').notNull().default(0),
    openedBySupervisorId: integer('opened_by_supervisor_id').references(() => users.id, { onDelete: 'set null' }),
    openedBySupervisorName: varchar('opened_by_supervisor_name', { length: 150 }),
    closedBySupervisorId: integer('closed_by_supervisor_id').references(() => users.id, { onDelete: 'set null' }),
    closedBySupervisorName: varchar('closed_by_supervisor_name', { length: 150 }),
    status: varchar('status', { length: 20 }).notNull().default('OPEN'), // OPEN, CLOSED
    openedAt: timestamp('opened_at').notNull().defaultNow(),
    closedAt: timestamp('closed_at'),
    note: text('note'),
    eodReport: jsonb('eod_report').$type<any>(),
    varianceApproved: boolean('variance_approved').notNull().default(false),
    varianceApprovedBy: varchar('variance_approved_by', { length: 150 }),
    varianceApprovedAt: timestamp('variance_approved_at'),
    varianceReason: text('variance_reason'),
    minDurationOverride: boolean('min_duration_override').notNull().default(false),
    minDurationOverrideBy: varchar('min_duration_override_by', { length: 150 }),
    minDurationOverrideReason: text('min_duration_override_reason'),
    isZeroSales: boolean('is_zero_sales').notNull().default(false),
  },
  (t) => ({
    registerIdx: index('pos_shifts_register_idx').on(t.registerCode),
    cashierIdx: index('pos_shifts_cashier_idx').on(t.cashierId),
    statusIdx: index('pos_shifts_status_idx').on(t.status),
  }),
);

export const posBusinessDays = pgTable(
  'business_days',
  {
    id: serial('id').primaryKey(),
    businessDate: varchar('business_date', { length: 12 }).notNull().unique(), // e.g. "2026-10-01"
    status: varchar('status', { length: 20 }).notNull().default('OPEN'), // OPEN, CLOSED
    openedAt: timestamp('opened_at').notNull().defaultNow(),
    closedAt: timestamp('closed_at'),
    closedBySupervisorId: integer('closed_by_supervisor_id').references(() => users.id, { onDelete: 'set null' }),
    closedBySupervisorName: varchar('closed_by_supervisor_name', { length: 150 }),
    totalGrossSales: numeric('total_gross_sales', { precision: 12, scale: 2 }).notNull().default('0'),
    totalNetSales: numeric('total_net_sales', { precision: 12, scale: 2 }).notNull().default('0'),
    totalCashVariance: numeric('total_cash_variance', { precision: 12, scale: 2 }).notNull().default('0'),
    totalShiftsCount: integer('total_shifts_count').notNull().default(0),
    zReport: jsonb('z_report').$type<any>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  }
);

export const posCashTransactions = pgTable(
  'pos_cash_transactions',
  {
    id: serial('id').primaryKey(),
    shiftId: integer('shift_id').references(() => posShifts.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 20 }).notNull(), // CASH_IN, CASH_OUT, SAFE_DROP
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    reason: varchar('reason', { length: 255 }).notNull(),
    performedByName: varchar('performed_by_name', { length: 150 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    shiftIdx: index('pos_cash_shift_idx').on(t.shiftId),
  }),
);

export const posShiftDenominations = pgTable(
  'pos_shift_denominations',
  {
    id: serial('id').primaryKey(),
    shiftId: integer('shift_id').references(() => posShifts.id, { onDelete: 'cascade' }),
    countType: varchar('count_type', { length: 50 }).notNull(), // 'OPENING', 'CASHIER_CLOSING', 'SUPERVISOR_RECEIVING', 'RECOUNT'
    attemptNumber: integer('attempt_number').notNull().default(1),
    d1000: integer('d1000').notNull().default(0),
    d500: integer('d500').notNull().default(0),
    d100: integer('d100').notNull().default(0),
    d50: integer('d50').notNull().default(0),
    d20: integer('d20').notNull().default(0),
    d10: integer('d10').notNull().default(0),
    d5: integer('d5').notNull().default(0),
    d2: integer('d2').notNull().default(0),
    d1: integer('d1').notNull().default(0),
    coins: integer('coins').notNull().default(0),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    countedById: integer('counted_by_id').references(() => users.id, { onDelete: 'set null' }),
    countedByName: varchar('counted_by_name', { length: 150 }).notNull(),
    verifiedById: integer('verified_by_id').references(() => users.id, { onDelete: 'set null' }),
    verifiedByName: varchar('verified_by_name', { length: 150 }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    shiftCountIdx: index('pos_denom_shift_count_idx').on(t.shiftId, t.countType),
  })
);

export const posShiftTenderReconciliations = pgTable(
  'pos_shift_tender_reconciliations',
  {
    id: serial('id').primaryKey(),
    shiftId: integer('shift_id').references(() => posShifts.id, { onDelete: 'cascade' }),
    tenderType: varchar('tender_type', { length: 50 }).notNull(), // 'card', 'fonepay', 'esewa', 'khalti', 'connectips', 'bank_transfer', 'credit'
    systemAmount: numeric('system_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    enteredAmount: numeric('entered_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    variance: numeric('variance', { precision: 14, scale: 2 }).notNull().default('0.00'),
    referenceNo: varchar('reference_no', { length: 100 }),
    batchNumber: varchar('batch_number', { length: 100 }),
    slipImageUrl: text('slip_image_url'),
    status: varchar('status', { length: 50 }).notNull().default('BALANCED'),
    verifiedById: integer('verified_by_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    shiftTenderIdx: index('pos_tender_shift_idx').on(t.shiftId, t.tenderType),
  })
);

export const posShiftCashMovements = pgTable(
  'pos_shift_cash_movements',
  {
    id: serial('id').primaryKey(),
    shiftId: integer('shift_id').references(() => posShifts.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(), // 'SAFE_DROP', 'PAID_IN', 'PAID_OUT', 'PETTY_CASH', 'ADJUSTMENT'
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    reason: varchar('reason', { length: 255 }).notNull(),
    authorizedByName: varchar('authorized_by_name', { length: 150 }).notNull(),
    authorizedByPin: varchar('authorized_by_pin', { length: 255 }),
    receiptNo: varchar('receipt_no', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    shiftMoveIdx: index('pos_move_shift_idx').on(t.shiftId),
  })
);

export const posShiftApprovals = pgTable(
  'pos_shift_approvals',
  {
    id: serial('id').primaryKey(),
    shiftId: integer('shift_id').references(() => posShifts.id, { onDelete: 'cascade' }),
    approvalType: varchar('approval_type', { length: 50 }).notNull(), // 'BOD_OVERRIDE', 'MIN_DURATION_OVERRIDE', 'VARIANCE_TOLERANCE', 'REOPEN_SHIFT'
    approverId: integer('approver_id').references(() => users.id, { onDelete: 'set null' }),
    approverName: varchar('approver_name', { length: 150 }).notNull(),
    approverRole: varchar('approver_role', { length: 50 }).notNull(),
    reason: text('reason').notNull(),
    metadata: jsonb('metadata').$type<any>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    shiftApprovalIdx: index('pos_approval_shift_idx').on(t.shiftId),
  })
);

