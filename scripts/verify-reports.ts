// scripts/verify-reports.ts
//
// Runs every aggregate in lib/reports/aggregate.ts against the live database and
// prints the figures, so the raw SQL fragments (generate_series in FROM, the
// order_status array cast, NULLS LAST) are proven to execute rather than assumed
// to. Compare the profit-loss block against the seed's hand reconciliation.
//
//   npx tsx scripts/verify-reports.ts

import 'dotenv/config';

import {
  accountsPayable,
  inventoryValuation,
  profitLoss,
  salesSeries,
  serviceRevenue,
  statusBreakdown,
  topCategories,
  topProducts,
  vatSummary,
} from '@/lib/reports/aggregate';
import type { ReportQuery } from '@/lib/validation/reports';

const npr = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** The seeded history spans 2026-01-01 to 2026-08-24; pin the window to all of it. */
const base: ReportQuery = {
  type: 'profit-loss',
  from: '2026-01-01',
  to: '2026-08-31',
  limit: 10,
  sort: 'revenue',
};

async function main() {
  console.log('\n=== profit-loss (monthly) ===');
  const pl = await profitLoss(base);
  for (const month of pl.months) {
    console.log(
      `${month.period}  n=${String(month.orderCount).padStart(3)}` +
        `  rev=${String(Math.round(month.revenue)).padStart(8)}` +
        `  cogs=${String(Math.round(month.cogs)).padStart(8)}` +
        `  gross=${String(Math.round(month.grossProfit)).padStart(7)}` +
        `  (${month.grossMarginPercent ?? '—'}%)` +
        `  exp=${String(Math.round(month.expenses)).padStart(7)}` +
        `  net=${String(Math.round(month.netProfit)).padStart(7)}`,
    );
  }
  console.log(
    `TOTALS rev=${npr(pl.totals.revenue)} cogs=${npr(pl.totals.cogs)} ` +
      `gross=${npr(pl.totals.grossProfit)} (${pl.totals.grossMarginPercent}%) ` +
      `exp=${npr(pl.totals.expenses)} net=${npr(pl.totals.netProfit)} orders=${pl.totals.orderCount}`,
  );
  console.log(
    `COGS coverage: ${pl.coverage.costed}/${pl.coverage.lineItems} line items costed ` +
      `(${pl.coverage.coveragePercent}%), ${pl.coverage.missingCost} missing`,
  );
  // The arithmetic must close, or the report is not a report.
  const closes =
    Math.abs(pl.totals.revenue - pl.totals.cogs - pl.totals.grossProfit) < 0.01 &&
    Math.abs(pl.totals.grossProfit - pl.totals.expenses - pl.totals.netProfit) < 0.01;
  console.log(`arithmetic closes: ${closes ? 'YES' : 'NO — BUG'}`);

  console.log('\n=== sales-series (monthly, with previous-window delta) ===');
  const series = await salesSeries({ ...base, type: 'sales-series', bucket: 'month' });
  for (const point of series.points) {
    console.log(
      `${point.period}  rev=${String(Math.round(point.revenue)).padStart(8)}` +
        `  orders=${String(point.orderCount).padStart(3)}  aov=${String(point.averageOrderValue).padStart(7)}`,
    );
  }
  console.log(
    `totals rev=${npr(series.totals.revenue)} orders=${series.totals.orderCount} ` +
      `aov=${npr(series.totals.averageOrderValue)}`,
  );
  console.log(
    `previous ${series.previous.window.from}..${series.previous.window.to}: ` +
      `rev=${npr(series.previous.revenue)} orders=${series.previous.orderCount} → ` +
      `delta revenue=${series.change.revenuePercent ?? 'n/a'}% orders=${series.change.orderCountPercent ?? 'n/a'}%`,
  );

  console.log('\n=== sales-series (last 30 days, default window — the sparkline) ===');
  const spark = await salesSeries({ type: 'sales-series', limit: 10, sort: 'revenue' });
  console.log(
    `${spark.window.from}..${spark.window.to}  ${spark.points.length} buckets, ` +
      `${spark.points.filter((p) => p.orderCount === 0).length} of them empty`,
  );
  console.log(`  values: ${spark.points.map((p) => Math.round(p.revenue)).join(', ')}`);

  console.log('\n=== top-products (by margin) ===');
  const byMargin = await topProducts({ ...base, type: 'top-products', sort: 'margin', limit: 5 });
  for (const row of byMargin.rows) {
    console.log(
      `  ${row.name.slice(0, 44).padEnd(44)} units=${String(row.units).padStart(3)} ` +
        `rev=${String(Math.round(row.revenue)).padStart(8)} gross=${String(Math.round(row.grossProfit)).padStart(7)} ` +
        `(${row.marginPercent ?? '—'}%)`,
    );
  }

  console.log('\n=== top-categories (by revenue) ===');
  const cats = await topCategories({ ...base, type: 'top-categories', limit: 10 });
  for (const row of cats.rows) {
    console.log(
      `  ${row.name.padEnd(28)} units=${String(row.units).padStart(4)} ` +
        `rev=${String(Math.round(row.revenue)).padStart(8)} gross=${String(Math.round(row.grossProfit)).padStart(7)} ` +
        `(${row.marginPercent ?? '—'}%)`,
    );
  }

  console.log('\n=== vat-summary ===');
  const vat = await vatSummary({ ...base, type: 'vat-summary' });
  console.log(
    `  collected=${npr(vat.collected)}  paid(expenses)=${npr(vat.paidOnExpenses)}  ` +
      `paid(purchases)=${npr(vat.paidOnPurchases)}  → net payable=${npr(vat.netPayable)}`,
  );

  console.log('\n=== inventory-valuation ===');
  const stock = await inventoryValuation();
  console.log(
    `  ${stock.skus} sellable SKUs, ${npr(stock.units)} units — at cost ${npr(stock.atCost)}, ` +
      `at retail ${npr(stock.atRetail)}, potential margin ${npr(stock.potentialMargin)}`,
  );
  console.log(
    `  missing cost: ${stock.skusMissingCost} SKUs / ${stock.unitsMissingCost} units; ` +
      `out of stock ${stock.outOfStock}; low stock ${stock.lowStock}`,
  );

  console.log('\n=== accounts-payable ===');
  const payable = await accountsPayable({ ...base, type: 'accounts-payable' });
  console.log(
    `  outstanding ${npr(payable.totalOutstanding)} across ${payable.billCount} bills; ` +
      `overdue ${npr(payable.overdueAmount)} across ${payable.overdueCount}`,
  );
  for (const bucket of payable.buckets) {
    console.log(`    ${bucket.label.padEnd(14)} ${bucket.billCount} bills  ${npr(bucket.outstanding)}`);
  }
  for (const bill of payable.bills) {
    console.log(
      `    ${bill.billNumber.padEnd(16)} ${bill.supplierName.padEnd(20)} due=${bill.dueDate ?? '—'} ` +
        `overdue=${bill.daysOverdue ?? '—'}d  outstanding=${npr(bill.outstanding)} [${bill.status}]`,
    );
  }

  console.log('\n=== status-breakdown ===');
  const status = await statusBreakdown({ ...base, type: 'status-breakdown' });
  for (const row of status.orderStatus) {
    console.log(`    ${row.status.padEnd(18)} ${String(row.count).padStart(4)}  ${npr(row.value)}`);
  }
  console.log(
    `  ${status.totals.orders} orders in window: ${status.totals.revenueOrders} count as revenue, ` +
      `${status.totals.nonRevenueOrders} do not`,
  );
  console.log('  payment status:');
  for (const row of status.paymentStatus) {
    console.log(`    ${row.status.padEnd(18)} ${String(row.count).padStart(4)}  ${npr(row.value)}`);
  }

  console.log('\n=== service-revenue ===');
  const service = await serviceRevenue({ ...base, type: 'service-revenue' });
  console.log(
    `  revenue=${npr(service.revenue)} resolved=${service.resolvedCount} ` +
      `unbilled=${service.unbilledCount} avg=${npr(service.averageTicket)}`,
  );
  for (const row of service.byType) {
    console.log(`    ${row.type.padEnd(16)} ${row.count} tickets  ${npr(row.revenue)}`);
  }

  console.log('\nAll nine aggregates executed.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
