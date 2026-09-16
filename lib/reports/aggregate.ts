// lib/reports/aggregate.ts
//
// Every figure the admin console shows, computed in Postgres.
//
// The console it replaces did not query for any of this. The revenue trend was a
// literal `[185000, 210000, 195000, 260000, 230000, 315000, ...]`, the growth
// badge was a hardcoded `+18.4%`, and service revenue was the string
// `NPR 18,500`. Nothing here invents a number: if the shop had no sales in a
// month, the month comes back as zero, and the UI is expected to say so.
//
// Two rules run through all of it:
//
//   1. Aggregate in SQL. `sum`, `count` and `date_trunc` over an index beat
//      fetching ten thousand order rows to reduce them in a browser, and the
//      dashboard is the one screen that loads on every admin visit.
//   2. Never read a missing cost as zero. `products.cost_price` is nullable, so
//      a P&L that coalesces it silently reports the full sale price as profit.
//      Everything that touches COGS also returns how many line items had no cost,
//      for the UI to disclose.

import { and, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import {
  categories,
  expenses,
  orderItems,
  orders,
  products,
  purchaseBills,
  serviceTickets,
} from '@/db/schema';
import {
  NON_REVENUE_STATUSES,
  REVENUE_STATUSES,
  type ReportBucket,
  type ReportQuery,
} from '@/lib/validation/reports';

/** Rupee strings from `numeric` columns; `null` when a `sum` matched no rows. */
const money = (value: string | number | null | undefined): number => Number(value ?? 0);
const whole = (value: string | number | null | undefined): number => Math.trunc(Number(value ?? 0));

/** Percentage change, or `null` when the baseline is zero — not `Infinity`. */
function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

/** `2026-08-24`, in local terms — `toISOString()` would shift the day in Kailali. */
function isoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

function daysAgo(days: number, from = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() - days);
  return isoDate(date);
}

function monthsAgo(months: number, from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth() - months, 1);
  return isoDate(date);
}

/**
 * The window a report ran over, echoed in every response.
 *
 * A revenue figure without its date range is not checkable, and the caller did
 * not necessarily supply one — each report has its own sensible default.
 */
export interface DateWindow {
  from: string;
  to: string;
}

function windowFor(query: ReportQuery, fallbackFrom: string): DateWindow {
  return { from: query.from ?? fallbackFrom, to: query.to ?? isoDate(new Date()) };
}

/**
 * `created_at` within the window, as a half-open interval.
 *
 * `to` is exclusive at midnight the following day rather than `<= to`: the column
 * is a timestamp, and `<= '2026-08-24'` compares against 00:00:00, which drops
 * everything sold on the last day of the range.
 */
function createdWithin(win: DateWindow): SQL {
  return and(
    gte(orders.createdAt, sql`${win.from}::date`),
    lte(orders.createdAt, sql`${win.to}::date + interval '1 day' - interval '1 microsecond'`),
  ) as SQL;
}

/** Sales only. Cancelled, returned and refunded orders are not revenue. */
function revenueScope(win: DateWindow): SQL {
  return and(createdWithin(win), inArray(orders.status, [...REVENUE_STATUSES])) as SQL;
}

/**
 * How much of the sold volume can be costed.
 *
 * Reported beside every gross-profit figure. "Cost missing on 12 of 143 line
 * items" is a caption the shop can act on; a P&L that quietly treats those twelve
 * as pure profit is not.
 */
export interface CogsCoverage {
  lineItems: number;
  costed: number;
  missingCost: number;
  /** 0-100, rounded to one decimal. 100 means the gross-profit figure is exact. */
  coveragePercent: number;
}

async function cogsCoverage(win: DateWindow): Promise<CogsCoverage> {
  const [row] = await db
    .select({
      lineItems: sql<number>`count(*)::int`,
      missing: sql<number>`count(*) FILTER (WHERE ${orderItems.unitCostSnapshot} IS NULL)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(revenueScope(win));

  const lineItems = whole(row?.lineItems);
  const missingCost = whole(row?.missing);

  return {
    lineItems,
    costed: lineItems - missingCost,
    missingCost,
    coveragePercent:
      lineItems === 0 ? 100 : Number((((lineItems - missingCost) / lineItems) * 100).toFixed(1)),
  };
}

/* -------------------------------------------------------------- sales series */

export interface SalesPoint {
  period: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface SalesSeriesReport {
  window: DateWindow;
  bucket: ReportBucket;
  points: SalesPoint[];
  totals: { revenue: number; orderCount: number; averageOrderValue: number };
  /** Same-length preceding window, which is what makes the trend badge honest. */
  previous: { window: DateWindow; revenue: number; orderCount: number };
  change: { revenuePercent: number | null; orderCountPercent: number | null };
}

/**
 * Revenue, order count and AOV over time — the query behind the dashboard
 * sparkline and its trend badge.
 *
 * `generate_series` fills the gaps, so a day with no sales is a zero rather than
 * a missing point: a sparkline drawn from present days only compresses a quiet
 * week into a straight line and reads as steady trading.
 */
export async function salesSeries(query: ReportQuery): Promise<SalesSeriesReport> {
  const bucket = query.bucket ?? 'day';
  const win = windowFor(query, bucket === 'day' ? daysAgo(29) : monthsAgo(11));

  const step = sql.raw(`'1 ${bucket}'::interval`);
  const truncated = sql.raw(`'${bucket}'`);

  const rows = await db
    .select({
      period: sql<string>`to_char(series.bucket, 'YYYY-MM-DD')`,
      revenue: sql<string>`coalesce(sum(o.total_amount), 0)`,
      orderCount: sql<number>`count(o.id)::int`,
    })
    .from(
      sql`generate_series(
            date_trunc(${truncated}, ${win.from}::timestamp),
            date_trunc(${truncated}, ${win.to}::timestamp),
            ${step}
          ) AS series(bucket)`,
    )
    .leftJoin(
      sql`${orders} AS o`,
      sql`date_trunc(${truncated}, o.created_at) = series.bucket
          AND o.created_at >= ${win.from}::date
          AND o.created_at < ${win.to}::date + interval '1 day'
          AND o.status = ANY(${sql.raw(`ARRAY['${REVENUE_STATUSES.join("','")}']::order_status[]`)})`,
    )
    .groupBy(sql`series.bucket`)
    .orderBy(sql`series.bucket`);

  const points: SalesPoint[] = rows.map((row) => {
    const revenue = money(row.revenue);
    const orderCount = whole(row.orderCount);
    return {
      period: row.period,
      revenue,
      orderCount,
      averageOrderValue: orderCount === 0 ? 0 : Math.round(revenue / orderCount),
    };
  });

  const revenue = points.reduce((sum, point) => sum + point.revenue, 0);
  const orderCount = points.reduce((sum, point) => sum + point.orderCount, 0);

  // The window immediately before this one, of identical length, so "+18.4%"
  // compares like with like instead of a month against a fortnight.
  const spanDays =
    Math.round(
      (new Date(win.to).getTime() - new Date(win.from).getTime()) / (24 * 60 * 60 * 1000),
    ) + 1;
  const prevWindow: DateWindow = {
    from: daysAgo(spanDays, new Date(win.from)),
    to: daysAgo(1, new Date(win.from)),
  };

  const [prev] = await db
    .select({
      revenue: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(revenueScope(prevWindow));

  const prevRevenue = money(prev?.revenue);
  const prevOrders = whole(prev?.orderCount);

  return {
    window: win,
    bucket,
    points,
    totals: {
      revenue,
      orderCount,
      averageOrderValue: orderCount === 0 ? 0 : Math.round(revenue / orderCount),
    },
    previous: { window: prevWindow, revenue: prevRevenue, orderCount: prevOrders },
    change: {
      revenuePercent: delta(revenue, prevRevenue),
      orderCountPercent: delta(orderCount, prevOrders),
    },
  };
}

/* --------------------------------------------------------- products & ranges */

export interface RankedRow {
  id: number | null;
  name: string;
  units: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  /** `null`, not 0, when no line carried a cost — an unknown margin, not a zero one. */
  marginPercent: number | null;
  lineItems: number;
  missingCost: number;
}

export interface RankedReport {
  window: DateWindow;
  sort: ReportQuery['sort'];
  rows: RankedRow[];
  coverage: CogsCoverage;
}

function rankRows(
  raw: Array<{
    id: number | null;
    name: string | null;
    units: number;
    revenue: string;
    cogs: string;
    lineItems: number;
    missingCost: number;
  }>,
  sort: ReportQuery['sort'],
): RankedRow[] {
  const rows = raw.map((row) => {
    const revenue = money(row.revenue);
    const cogs = money(row.cogs);
    const missingCost = whole(row.missingCost);
    const grossProfit = revenue - cogs;

    return {
      id: row.id,
      name: row.name ?? 'Deleted product',
      units: whole(row.units),
      revenue,
      cogs,
      grossProfit,
      // Withheld entirely when any line is uncosted: a margin computed from a
      // partial COGS overstates itself, and rounding it to a number invites the
      // UI to rank on it.
      marginPercent:
        missingCost > 0 || revenue === 0
          ? null
          : Number(((grossProfit / revenue) * 100).toFixed(1)),
      lineItems: whole(row.lineItems),
      missingCost,
    };
  });

  const key =
    sort === 'units'
      ? (row: RankedRow) => row.units
      : sort === 'margin'
        ? (row: RankedRow) => row.grossProfit
        : (row: RankedRow) => row.revenue;

  return rows.sort((a, b) => key(b) - key(a));
}

/**
 * Units, revenue and margin per product.
 *
 * Sorting by `margin` ranks on gross profit in rupees rather than percent, so a
 * single 60%-margin cable does not outrank a month of laptop sales.
 */
export async function topProducts(query: ReportQuery): Promise<RankedReport> {
  const win = windowFor(query, daysAgo(29));

  const raw = await db
    .select({
      id: orderItems.productId,
      // The snapshot, not `products.name`: it is what the customer bought, and it
      // survives the product being renamed or deleted.
      name: sql<string>`max(${orderItems.productNameSnapshot})`,
      units: sql<number>`sum(${orderItems.quantity})::int`,
      revenue: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
      cogs: sql<string>`coalesce(sum(${orderItems.unitCostSnapshot} * ${orderItems.quantity}), 0)`,
      lineItems: sql<number>`count(*)::int`,
      missingCost: sql<number>`count(*) FILTER (WHERE ${orderItems.unitCostSnapshot} IS NULL)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(revenueScope(win))
    .groupBy(orderItems.productId)
    .limit(query.limit * 3);

  return {
    window: win,
    sort: query.sort,
    rows: rankRows(raw, query.sort).slice(0, query.limit),
    coverage: await cogsCoverage(win),
  };
}

/** The same figures grouped by category, for the revenue-mix breakdown. */
export async function topCategories(query: ReportQuery): Promise<RankedReport> {
  const win = windowFor(query, daysAgo(29));

  const raw = await db
    .select({
      id: categories.id,
      // Products deleted since, or never categorised, still sold something.
      name: sql<string>`coalesce(max(${categories.name}), 'Uncategorised')`,
      units: sql<number>`sum(${orderItems.quantity})::int`,
      revenue: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
      cogs: sql<string>`coalesce(sum(${orderItems.unitCostSnapshot} * ${orderItems.quantity}), 0)`,
      lineItems: sql<number>`count(*)::int`,
      missingCost: sql<number>`count(*) FILTER (WHERE ${orderItems.unitCostSnapshot} IS NULL)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(revenueScope(win))
    .groupBy(categories.id)
    .limit(query.limit * 3);

  return {
    window: win,
    sort: query.sort,
    rows: rankRows(raw, query.sort).slice(0, query.limit),
    coverage: await cogsCoverage(win),
  };
}

/* ---------------------------------------------------------------- profit&loss */

export interface ProfitLossMonth {
  period: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number | null;
  expenses: number;
  netProfit: number;
  orderCount: number;
  missingCost: number;
}

export interface ProfitLossReport {
  window: DateWindow;
  months: ProfitLossMonth[];
  totals: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPercent: number | null;
    expenses: number;
    netProfit: number;
    orderCount: number;
  };
  coverage: CogsCoverage;
}

/**
 * Revenue − COGS = gross profit − expenses = net profit, by month.
 *
 * Three independent aggregates stitched together by month key rather than one
 * join: joining orders to their items and to expenses in a single query
 * multiplies each order's total by its line count. That mistake reports a shop
 * with three-line orders as three times more profitable than it is.
 */
export async function profitLoss(query: ReportQuery): Promise<ProfitLossReport> {
  const win = windowFor(query, monthsAgo(11));

  const revenueRows = await db
    .select({
      period: sql<string>`to_char(date_trunc('month', ${orders.createdAt}), 'YYYY-MM')`,
      revenue: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(revenueScope(win))
    .groupBy(sql`date_trunc('month', ${orders.createdAt})`);

  const cogsRows = await db
    .select({
      period: sql<string>`to_char(date_trunc('month', ${orders.createdAt}), 'YYYY-MM')`,
      cogs: sql<string>`coalesce(sum(${orderItems.unitCostSnapshot} * ${orderItems.quantity}), 0)`,
      missingCost: sql<number>`count(*) FILTER (WHERE ${orderItems.unitCostSnapshot} IS NULL)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(revenueScope(win))
    .groupBy(sql`date_trunc('month', ${orders.createdAt})`);

  const expenseRows = await db
    .select({
      period: sql<string>`to_char(date_trunc('month', ${expenses.expenseDate}), 'YYYY-MM')`,
      // `amount` is VAT-inclusive and so is revenue, so the two are comparable
      // without unpicking either.
      total: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.expenseDate, win.from),
        lte(expenses.expenseDate, win.to),
      ),
    )
    .groupBy(sql`date_trunc('month', ${expenses.expenseDate})`);

  const byPeriod = new Map<string, ProfitLossMonth>();
  const blank = (period: string): ProfitLossMonth => ({
    period,
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMarginPercent: null,
    expenses: 0,
    netProfit: 0,
    orderCount: 0,
    missingCost: 0,
  });

  // Every month in the window, so a month of pure expenses and no sales still
  // appears — that is precisely the month worth seeing.
  const cursor = new Date(`${win.from}T00:00:00`);
  const last = new Date(`${win.to}T00:00:00`);
  while (cursor <= last) {
    const period = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    if (!byPeriod.has(period)) byPeriod.set(period, blank(period));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const row of revenueRows) {
    const month = byPeriod.get(row.period) ?? blank(row.period);
    month.revenue = money(row.revenue);
    month.orderCount = whole(row.orderCount);
    byPeriod.set(row.period, month);
  }
  for (const row of cogsRows) {
    const month = byPeriod.get(row.period) ?? blank(row.period);
    month.cogs = money(row.cogs);
    month.missingCost = whole(row.missingCost);
    byPeriod.set(row.period, month);
  }
  for (const row of expenseRows) {
    const month = byPeriod.get(row.period) ?? blank(row.period);
    month.expenses = money(row.total);
    byPeriod.set(row.period, month);
  }

  const months = [...byPeriod.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((month) => {
      const grossProfit = month.revenue - month.cogs;
      return {
        ...month,
        grossProfit,
        grossMarginPercent:
          month.revenue === 0 || month.missingCost > 0
            ? null
            : Number(((grossProfit / month.revenue) * 100).toFixed(1)),
        netProfit: grossProfit - month.expenses,
      };
    });

  const sum = (pick: (month: ProfitLossMonth) => number) =>
    months.reduce((total, month) => total + pick(month), 0);

  const revenue = sum((m) => m.revenue);
  const cogs = sum((m) => m.cogs);
  const grossProfit = revenue - cogs;
  const expenseTotal = sum((m) => m.expenses);
  const coverage = await cogsCoverage(win);

  return {
    window: win,
    months,
    totals: {
      revenue,
      cogs,
      grossProfit,
      grossMarginPercent:
        revenue === 0 || coverage.missingCost > 0
          ? null
          : Number(((grossProfit / revenue) * 100).toFixed(1)),
      expenses: expenseTotal,
      netProfit: grossProfit - expenseTotal,
      orderCount: sum((m) => m.orderCount),
    },
    coverage,
  };
}

/* ------------------------------------------------------------------- VAT */

export interface VatSummaryReport {
  window: DateWindow;
  collected: number;
  paidOnExpenses: number;
  paidOnPurchases: number;
  paidTotal: number;
  /** Positive means owed to the IRD; negative is a credit carried forward. */
  netPayable: number;
  orderCount: number;
}

/**
 * Output VAT against input VAT — the figure that actually gets filed.
 *
 * Collected comes from `orders.vat_amount`, which the pricing module carves out
 * of a VAT-inclusive price rather than adding on top. Paid comes from the two
 * places money leaves: expenses and supplier bills.
 */
export async function vatSummary(query: ReportQuery): Promise<VatSummaryReport> {
  const win = windowFor(query, monthsAgo(2));

  const [sales] = await db
    .select({
      collected: sql<string>`coalesce(sum(${orders.vatAmount}), 0)`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(revenueScope(win));

  const [expenseVat] = await db
    .select({ paid: sql<string>`coalesce(sum(${expenses.vatAmount}), 0)` })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, win.from), lte(expenses.expenseDate, win.to)));

  // Bills count from their bill date, not when they were paid: VAT is claimable
  // on the invoice, which is what makes an unpaid bill's input VAT claimable now.
  const [purchaseVat] = await db
    .select({ paid: sql<string>`coalesce(sum(${purchaseBills.vatAmount}), 0)` })
    .from(purchaseBills)
    .where(and(gte(purchaseBills.billDate, win.from), lte(purchaseBills.billDate, win.to)));

  const collected = money(sales?.collected);
  const paidOnExpenses = money(expenseVat?.paid);
  const paidOnPurchases = money(purchaseVat?.paid);

  return {
    window: win,
    collected,
    paidOnExpenses,
    paidOnPurchases,
    paidTotal: paidOnExpenses + paidOnPurchases,
    netPayable: collected - (paidOnExpenses + paidOnPurchases),
    orderCount: whole(sales?.orderCount),
  };
}

/* -------------------------------------------------------- inventory & payable */

export interface InventoryValuationReport {
  /** No window — this is stock as it stands now, not over a period. */
  asOf: string;
  units: number;
  skus: number;
  atCost: number;
  atRetail: number;
  potentialMargin: number;
  skusMissingCost: number;
  unitsMissingCost: number;
  outOfStock: number;
  lowStock: number;
}

/**
 * What the shelves are worth, at cost and at retail.
 *
 * Only sellable stock counts: a draft or deactivated product cannot be sold, so
 * including it inflates the figure with inventory the storefront will not offer.
 */
export async function inventoryValuation(): Promise<InventoryValuationReport> {
  const sellable = and(eq(products.isActive, true), eq(products.status, 'active')) as SQL;

  const [row] = await db
    .select({
      units: sql<number>`coalesce(sum(${products.stockQuantity}), 0)::int`,
      skus: sql<number>`count(*)::int`,
      atCost: sql<string>`coalesce(sum(${products.costPrice} * ${products.stockQuantity}), 0)`,
      atRetail: sql<string>`coalesce(sum(${products.basePrice} * ${products.stockQuantity}), 0)`,
      skusMissingCost: sql<number>`count(*) FILTER (WHERE ${products.costPrice} IS NULL AND ${products.stockQuantity} > 0)::int`,
      unitsMissingCost: sql<number>`coalesce(sum(${products.stockQuantity}) FILTER (WHERE ${products.costPrice} IS NULL), 0)::int`,
      outOfStock: sql<number>`count(*) FILTER (WHERE ${products.stockQuantity} <= 0)::int`,
      lowStock: sql<number>`count(*) FILTER (WHERE ${products.stockQuantity} > 0 AND ${products.stockQuantity} <= ${products.lowStockThreshold})::int`,
    })
    .from(products)
    .where(sellable);

  const atCost = money(row?.atCost);
  const atRetail = money(row?.atRetail);

  return {
    asOf: isoDate(new Date()),
    units: whole(row?.units),
    skus: whole(row?.skus),
    atCost,
    atRetail,
    // Retail less cost on stock still held — what the shelves would earn if they
    // cleared at list price. Understated by exactly the SKUs counted below.
    potentialMargin: atRetail - atCost,
    skusMissingCost: whole(row?.skusMissingCost),
    unitsMissingCost: whole(row?.unitsMissingCost),
    outOfStock: whole(row?.outOfStock),
    lowStock: whole(row?.lowStock),
  };
}

export interface PayableBucket {
  label: string;
  billCount: number;
  outstanding: number;
}

export interface PayableBill {
  id: number;
  billNumber: string;
  supplierId: number;
  supplierName: string;
  billDate: string;
  dueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  outstanding: number;
  status: string;
  /** Negative means not due yet; `null` when the bill carries no due date. */
  daysOverdue: number | null;
}

export interface AccountsPayableReport {
  asOf: string;
  totalOutstanding: number;
  billCount: number;
  overdueAmount: number;
  overdueCount: number;
  buckets: PayableBucket[];
  bills: PayableBill[];
}

/**
 * Unpaid and part-paid supplier bills, aged against their due date.
 *
 * Outstanding is `total_amount - amount_paid` rather than the `status` column:
 * status is a denormalisation kept for indexing, and if the two ever disagree the
 * arithmetic is the one to trust.
 */
export async function accountsPayable(query: ReportQuery): Promise<AccountsPayableReport> {
  const outstanding = sql<string>`${purchaseBills.totalAmount} - ${purchaseBills.amountPaid}`;

  const rows = await db
    .select({
      id: purchaseBills.id,
      billNumber: purchaseBills.billNumber,
      supplierId: purchaseBills.supplierId,
      supplierName: sql<string>`coalesce(s.name, 'Unknown supplier')`,
      billDate: purchaseBills.billDate,
      dueDate: purchaseBills.dueDate,
      totalAmount: purchaseBills.totalAmount,
      amountPaid: purchaseBills.amountPaid,
      outstanding,
      status: purchaseBills.status,
      daysOverdue: sql<number | null>`CASE
        WHEN ${purchaseBills.dueDate} IS NULL THEN NULL
        ELSE (CURRENT_DATE - ${purchaseBills.dueDate})::int
      END`,
    })
    .from(purchaseBills)
    .leftJoin(sql`suppliers AS s`, sql`s.id = ${purchaseBills.supplierId}`)
    .where(sql`${purchaseBills.totalAmount} - ${purchaseBills.amountPaid} > 0`)
    // Oldest debt first; bills with no due date sort last rather than first,
    // which is what `NULLS LAST` buys over Postgres's default for DESC.
    .orderBy(sql`${purchaseBills.dueDate} ASC NULLS LAST`)
    .limit(200);

  const bills: PayableBill[] = rows.map((row) => ({
    id: row.id,
    billNumber: row.billNumber,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    billDate: row.billDate,
    dueDate: row.dueDate,
    totalAmount: money(row.totalAmount),
    amountPaid: money(row.amountPaid),
    outstanding: money(row.outstanding),
    status: row.status,
    daysOverdue: row.daysOverdue === null ? null : whole(row.daysOverdue),
  }));

  const bucketFor = (bill: PayableBill): string => {
    if (bill.daysOverdue === null) return 'No due date';
    if (bill.daysOverdue <= 0) return 'Not yet due';
    if (bill.daysOverdue <= 30) return '1-30 days';
    if (bill.daysOverdue <= 60) return '31-60 days';
    return '60+ days';
  };

  const order = ['Not yet due', '1-30 days', '31-60 days', '60+ days', 'No due date'];
  const tally = new Map<string, PayableBucket>(
    order.map((label) => [label, { label, billCount: 0, outstanding: 0 }]),
  );

  for (const bill of bills) {
    const bucket = tally.get(bucketFor(bill));
    if (!bucket) continue;
    bucket.billCount += 1;
    bucket.outstanding += bill.outstanding;
  }

  const overdue = bills.filter((bill) => (bill.daysOverdue ?? 0) > 0);

  return {
    asOf: isoDate(new Date()),
    totalOutstanding: bills.reduce((sum, bill) => sum + bill.outstanding, 0),
    billCount: bills.length,
    overdueAmount: overdue.reduce((sum, bill) => sum + bill.outstanding, 0),
    overdueCount: overdue.length,
    buckets: [...tally.values()].filter((bucket) => bucket.billCount > 0),
    bills,
  };
}

/* ---------------------------------------------------- status & service revenue */

export interface StatusBreakdownReport {
  window: DateWindow;
  orderStatus: Array<{ status: string; count: number; value: number }>;
  paymentStatus: Array<{ status: string; count: number; value: number }>;
  totals: { orders: number; revenueOrders: number; nonRevenueOrders: number };
}

/** Order and payment status counts — the operational "what is in flight" view. */
export async function statusBreakdown(query: ReportQuery): Promise<StatusBreakdownReport> {
  const win = windowFor(query, daysAgo(29));
  const scope = createdWithin(win);

  const byOrderStatus = await db
    .select({
      status: orders.status,
      count: sql<number>`count(*)::int`,
      value: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
    })
    .from(orders)
    .where(scope)
    .groupBy(orders.status);

  const byPaymentStatus = await db
    .select({
      status: orders.paymentStatus,
      count: sql<number>`count(*)::int`,
      value: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
    })
    .from(orders)
    .where(scope)
    .groupBy(orders.paymentStatus);

  const orderStatus = byOrderStatus.map((row) => ({
    status: row.status,
    count: whole(row.count),
    value: money(row.value),
  }));

  const nonRevenue = new Set<string>(NON_REVENUE_STATUSES);
  const counted = orderStatus.reduce((sum, row) => sum + row.count, 0);
  const excluded = orderStatus
    .filter((row) => nonRevenue.has(row.status))
    .reduce((sum, row) => sum + row.count, 0);

  return {
    window: win,
    orderStatus,
    paymentStatus: byPaymentStatus.map((row) => ({
      status: row.status,
      count: whole(row.count),
      value: money(row.value),
    })),
    totals: {
      orders: counted,
      revenueOrders: counted - excluded,
      nonRevenueOrders: excluded,
    },
  };
}

export interface ServiceRevenueReport {
  window: DateWindow;
  revenue: number;
  resolvedCount: number;
  /** Resolved jobs with nothing billed — warranty work, or someone forgot. */
  unbilledCount: number;
  averageTicket: number;
  byType: Array<{ type: string; count: number; revenue: number }>;
}

/**
 * Repair and installation income, from `service_tickets.charged_amount`.
 *
 * The console showed a flat `NPR 18,500` here against a table that had no money
 * column at all. It has one now (migration 0006); this reads it. Counted on
 * `resolved_at` because that is when the work was billable, and only for tickets
 * that actually reached `resolved` or `closed`.
 */
export async function serviceRevenue(query: ReportQuery): Promise<ServiceRevenueReport> {
  const win = windowFor(query, daysAgo(29));

  const scope = and(
    inArray(serviceTickets.status, ['resolved', 'closed']),
    gte(serviceTickets.resolvedAt, sql`${win.from}::date`),
    lte(
      serviceTickets.resolvedAt,
      sql`${win.to}::date + interval '1 day' - interval '1 microsecond'`,
    ),
  ) as SQL;

  const [totals] = await db
    .select({
      revenue: sql<string>`coalesce(sum(${serviceTickets.chargedAmount}), 0)`,
      resolvedCount: sql<number>`count(*)::int`,
      unbilledCount: sql<number>`count(*) FILTER (WHERE ${serviceTickets.chargedAmount} IS NULL)::int`,
    })
    .from(serviceTickets)
    .where(scope);

  const byType = await db
    .select({
      type: serviceTickets.type,
      count: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${serviceTickets.chargedAmount}), 0)`,
    })
    .from(serviceTickets)
    .where(scope)
    .groupBy(serviceTickets.type);

  const revenue = money(totals?.revenue);
  const resolvedCount = whole(totals?.resolvedCount);
  const unbilledCount = whole(totals?.unbilledCount);
  const billed = resolvedCount - unbilledCount;

  return {
    window: win,
    revenue,
    resolvedCount,
    unbilledCount,
    // Averaged over billed jobs only — dividing by free warranty repairs too
    // would report a lower price than the shop has ever charged.
    averageTicket: billed === 0 ? 0 : Math.round(revenue / billed),
    byType: byType.map((row) => ({
      type: row.type,
      count: whole(row.count),
      revenue: money(row.revenue),
    })),
  };
}
