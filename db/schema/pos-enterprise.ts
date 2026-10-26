import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  numeric,
  date,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

// Enums with isolated postgres names to prevent naming collisions
export const staffRole = pgEnum('pos_staff_role', [
  'cashier',
  'senior_cashier',
  'supervisor',
  'store_manager',
  'manager',
  'inventory_manager',
  'sales_manager',
  'accountant',
  'auditor',
  'admin',
]);
export const shiftStatus = pgEnum('pos_shift_status', ['open', 'closed']);
export const dayStatus = pgEnum('pos_day_status', ['open', 'closed']);

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    staffCode: text('staff_code').notNull().unique(), // e.g., "CSH01", "SUP01", "ADM01"
    email: text('email'),
    phone: text('phone'),
    role: staffRole('role').notNull().default('cashier'),
    status: text('status').notNull().default('active'), // active, suspended, terminated
    photoUrl: text('photo_url'),
    branchId: text('branch_id').notNull().default('MAIN'),
    defaultShift: text('default_shift').notNull().default('morning'),
    emergencyContact: text('emergency_contact'),
    notes: text('notes'),
    joinDate: date('join_date'),

    // 1. Master Authentication (Password)
    passwordHash: text('password_hash').notNull(),
    mustChangePassword: boolean('must_change_password').notNull().default(true),

    // 2. Fast Counter PIN (Screen Unlock, Supervisor Override)
    pinHash: text('pin_hash'), // Nullable: non-terminal staff don't require PIN
    mustChangePin: boolean('must_change_pin').notNull().default(false),
    pinChangedAt: timestamp('pin_changed_at', { withTimezone: true }).defaultNow(),

    // 3. Password Lockout Domain (e.g. 5 failures -> 15 min lockout)
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),

    // 4. PIN Lockout Domain (e.g. 3 failures -> 10 min lockout)
    failedPinAttempts: integer('failed_pin_attempts').notNull().default(0),
    pinLockedUntil: timestamp('pin_locked_until', { withTimezone: true }),

    // 5. Activity telemetry
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: text('last_login_ip'),
    lastTerminalCode: text('last_terminal_code'),

    // 6. Privileged 2FA
    totpEnabled: boolean('totp_enabled').notNull().default(false),
    totpSecret: text('totp_secret'),

    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    staffCodeIdx: uniqueIndex('staff_staff_code_idx').on(t.staffCode),
    activeRoleIdx: index('staff_active_role_idx').on(t.active, t.role),
  })
);

export type Staff = InferSelectModel<typeof staff>;
export type NewStaff = InferInsertModel<typeof staff>;

// Registered POS devices. Staff can only log in from a known terminal.
export const terminals = pgTable('terminals', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code'),
  name: text('name').notNull(),
  tokenHash: text('token_hash'), // sha256 of device token
  branchId: text('branch_id'),
  status: text('status').notNull().default('approved'), // approved, pending_approval, revoked
  isLocked: boolean('is_locked').notNull().default(false),
  active: boolean('active').notNull().default(true),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  ipAddress: text('ip_address'),
  macAddress: text('mac_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Terminal = InferSelectModel<typeof terminals>;

export const businessDays = pgTable('business_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessDate: date('business_date').notNull().unique(),
  status: dayStatus('status').notNull().default('open'),
  closedBy: uuid('closed_by').references(() => staff.id),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  zReport: jsonb('z_report'), // immutable snapshot at EOD
});

export type BusinessDay = InferSelectModel<typeof businessDays>;

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessDayId: uuid('business_day_id').references(() => businessDays.id),
  terminalId: uuid('terminal_id').notNull().references(() => terminals.id),
  cashierId: uuid('cashier_id').notNull().references(() => staff.id),
  openedBySupervisorId: uuid('opened_by_supervisor_id').references(() => staff.id),
  closedBySupervisorId: uuid('closed_by_supervisor_id').references(() => staff.id),
  status: text('status').notNull().default('open'), // open, paused, submitted_to_account, closed
  reasonPaused: text('reason_paused'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  openingCount: jsonb('opening_count').notNull(), // { "1000": 2, "500": 5, ... }
  openingTotal: numeric('opening_total', { precision: 14, scale: 2, mode: 'number' }).notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closingCount: jsonb('closing_count'),
  closingTotal: numeric('closing_total', { precision: 14, scale: 2, mode: 'number' }),
  handoverSlip: jsonb('handover_slip'),
  expectedCash: numeric('expected_cash', { precision: 14, scale: 2, mode: 'number' }),
  variance: numeric('variance', { precision: 14, scale: 2, mode: 'number' }),
  varianceApprovedBy: uuid('variance_approved_by').references(() => staff.id),
});

export type Shift = InferSelectModel<typeof shifts>;

// Standard retail transactions record synced for central accounts
export const posTransactions = pgTable('pos_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftId: uuid('shift_id'),
  cashierId: uuid('cashier_id'),
  cashierName: text('cashier_name'),
  terminalCode: text('terminal_code').notNull().default('REG-01'),
  invoiceNumber: text('invoice_number').notNull().unique(),
  totalAmount: numeric('total_amount', { precision: 14, scale: 2, mode: 'number' }).notNull(),
  paymentMethod: text('payment_method').notNull(),
  paymentBreakdown: jsonb('payment_breakdown').notNull(),
  items: jsonb('items').notNull(),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PosTransaction = InferSelectModel<typeof posTransactions>;

// Tamper-evident audit trail: each row hashes the previous row.
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => staff.id),
  approverId: uuid('approver_id').references(() => staff.id),
  terminalId: uuid('terminal_id').references(() => terminals.id),
  action: text('action').notNull(), // LOGIN_OK, LOGIN_FAIL, PIN_VERIFY_OK, PIN_VERIFY_FAIL, SHIFT_OPEN...
  entity: text('entity'),
  entityId: text('entity_id'),
  meta: jsonb('meta'),
  prevHash: text('prev_hash'),
  hash: text('hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = InferSelectModel<typeof auditLog>;

// 1. PIN History (Argon2id hashes only, no plain text)
export const pinHistory = pgTable('pin_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  pinHash: text('pin_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 2. PIN Reset Requests (Maker-Checker Flow)
export const pinResetRequests = pgTable('pin_reset_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  requestedById: uuid('requested_by_id').references(() => staff.id),
  approvedById: uuid('approved_by_id').references(() => staff.id),
  tempPinHash: text('temp_pin_hash'),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('approved'), // pending, approved, used, expired
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 3. Staff Terminals (Device Binding & Shift Times)
export const staffTerminals = pgTable('staff_terminals', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  terminalId: uuid('terminal_id').notNull().references(() => terminals.id, { onDelete: 'cascade' }),
  allowedDays: jsonb('allowed_days').$type<string[]>().default(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']),
  allowedStartTime: text('allowed_start_time').default('09:00'),
  allowedEndTime: text('allowed_end_time').default('20:00'),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 4. Staff Limits
export const staffLimits = pgTable('staff_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().unique().references(() => staff.id, { onDelete: 'cascade' }),
  maxLineDiscountPct: numeric('max_line_discount_pct', { precision: 5, scale: 2, mode: 'number' }).default(10.0),
  maxInvoiceDiscountAmount: numeric('max_invoice_discount_amount', { precision: 14, scale: 2, mode: 'number' }).default(1000.0),
  maxRefundAmount: numeric('max_refund_amount', { precision: 14, scale: 2, mode: 'number' }).default(5000.0),
  maxVoidAmount: numeric('max_void_amount', { precision: 14, scale: 2, mode: 'number' }).default(5000.0),
  canOverridePrice: boolean('can_override_price').notNull().default(false),
  canNoSaleOpen: boolean('can_no_sale_open').notNull().default(false),
  maxCashPayout: numeric('max_cash_payout', { precision: 14, scale: 2, mode: 'number' }).default(2000.0),
  canCreditSale: boolean('can_credit_sale').notNull().default(false),
  returnWindowDays: integer('return_window_days').default(7),
  updatedById: uuid('updated_by_id').references(() => staff.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 5. Limit Overrides (Time-bound elevations)
export const limitOverrides = pgTable('limit_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  grantedById: uuid('granted_by_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  permissionKey: text('permission_key').notNull(),
  overrideValue: text('override_value').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('active'), // active, expired, revoked
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 6. Staff Sessions
export const staffSessions = pgTable('staff_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  terminalId: uuid('terminal_id').references(() => terminals.id),
  terminalCode: text('terminal_code'),
  sessionTokenHash: text('session_token_hash').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  isRevoked: boolean('is_revoked').notNull().default(false),
  revokedReason: text('revoked_reason'),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 7. Anomaly Rules & Alerts
export const anomalyRules = pgTable('anomaly_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleCode: text('rule_code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  thresholdValue: numeric('threshold_value', { precision: 14, scale: 2, mode: 'number' }).notNull(),
  severity: text('severity').notNull().default('medium'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const anomalyAlerts = pgTable('anomaly_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleCode: text('rule_code').notNull(),
  staffId: uuid('staff_id').references(() => staff.id),
  shiftId: integer('shift_id'),
  severity: text('severity').notNull().default('medium'),
  title: text('title').notNull(),
  description: text('description'),
  details: jsonb('details'),
  status: text('status').notNull().default('new'), // new, investigating, resolved, false_positive
  assignedToId: uuid('assigned_to_id').references(() => staff.id),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

// 8. Staff Targets
export const staffTargets = pgTable('staff_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  periodType: text('period_type').notNull().default('monthly'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  salesTarget: numeric('sales_target', { precision: 14, scale: 2, mode: 'number' }).notNull().default(500000.0),
  accuracyTarget: numeric('accuracy_target', { precision: 5, scale: 2, mode: 'number' }).notNull().default(99.5),
  achievedSales: numeric('achieved_sales', { precision: 14, scale: 2, mode: 'number' }).default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 9. Staff Audit Log
export const staffAuditLog = pgTable('staff_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),
  actorName: text('actor_name'),
  actorRole: text('actor_role'),
  action: text('action').notNull(),
  targetId: text('target_id'),
  targetType: text('target_type'),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

