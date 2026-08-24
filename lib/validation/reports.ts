// lib/validation/reports.ts
//
// What `GET /api/reports` accepts, plus the two rules every money figure it
// returns depends on: which order statuses count as revenue, and which roles may
// see which report.
//
// Both live here rather than inside the route so the answer to "is a cancelled
// order revenue?" has exactly one home. The dashboard used to answer it by
// hardcoding `+18.4%`.

import { z } from 'zod';

import { ORDER_STATUSES } from './commerce';
import type { UserRole } from '@/lib/auth/middleware';

export const REPORT_TYPES = [
  'sales-series',
  'top-products',
  'top-categories',
  'profit-loss',
  'vat-summary',
  'inventory-valuation',
  'accounts-payable',
  'status-breakdown',
  'service-revenue',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

/**
 * Orders that count towards revenue.
 *
 * `pending` is included: a COD order awaiting confirmation is a booked sale, and
 * excluding it would make today's figures collapse every evening and refill
 * overnight. The three below are not sales and never become sales.
 */
export const REVENUE_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'dispatched',
  'out_for_delivery',
  'delivered',
] as const;

/** Money that came in and went back out, or never arrived. Never revenue. */
export const NON_REVENUE_STATUSES = ['cancelled', 'returned', 'refunded'] as const;

/**
 * Compile-time proof the two lists above partition `ORDER_STATUSES`.
 *
 * Add a status to the enum without classifying it here and this line stops
 * compiling — which is the point. The alternative is a new status silently
 * dropping out of every revenue figure with nothing to notice it.
 */
type Unclassified = Exclude<
  (typeof ORDER_STATUSES)[number],
  (typeof REVENUE_STATUSES)[number] | (typeof NON_REVENUE_STATUSES)[number]
>;
const statusesAreExhaustive: Unclassified extends never ? true : Unclassified = true;
void statusesAreExhaustive;

/**
 * Who may read what.
 *
 * All staff reach the admin console, but "how are sales going" and "what is the
 * shop's net profit and what do we owe suppliers" are different questions. The
 * operational reports are open to every staff role; the financial ones follow the
 * same split as the accounting write routes — `admin` for the P&L and the VAT
 * return, `admin` plus `inventory_manager` for stock value and payables, since
 * those are the people who record bills in the first place.
 */
export const REPORT_ROLES: Record<ReportType, UserRole[]> = {
  'sales-series': ['admin', 'sales', 'inventory_manager', 'service_technician'],
  'top-products': ['admin', 'sales', 'inventory_manager'],
  'top-categories': ['admin', 'sales', 'inventory_manager'],
  'status-breakdown': ['admin', 'sales', 'inventory_manager', 'service_technician'],
  'service-revenue': ['admin', 'service_technician'],
  'inventory-valuation': ['admin', 'inventory_manager'],
  'accounts-payable': ['admin', 'inventory_manager'],
  'profit-loss': ['admin'],
  'vat-summary': ['admin'],
};

/**
 * A calendar date, rejected if it is not one.
 *
 * The regex alone accepts `2026-02-30`, which Postgres answers with a
 * `DateTimeParseError` from somewhere deep inside the query — the seed script hit
 * exactly that. Better to say so here.
 */
const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    );
  }, 'That is not a real date');

export const REPORT_BUCKETS = ['day', 'week', 'month'] as const;
export type ReportBucket = (typeof REPORT_BUCKETS)[number];

export const REPORT_SORTS = ['revenue', 'margin', 'units'] as const;

export const reportQuerySchema = z
  .object({
    type: z.enum(REPORT_TYPES),
    // Both optional: each report picks a window that suits it (30 days for a
    // sparkline, 12 months for a P&L) and states in the response which one it
    // used, so a caller never has to guess what "revenue" was measured over.
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    bucket: z.enum(REPORT_BUCKETS).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    sort: z.enum(REPORT_SORTS).default('revenue'),
  })
  // ISO dates sort lexicographically, so this needs no parsing.
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'from must not be after to',
    path: ['from'],
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;
