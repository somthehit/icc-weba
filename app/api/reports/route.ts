import { NextResponse } from 'next/server';

import { withAuth, type UserRole } from '@/lib/auth/middleware';
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
import { parseQuery } from '@/lib/validation/parse';
import { REPORT_ROLES, reportQuerySchema, type ReportType } from '@/lib/validation/reports';

/**
 * Server-computed figures for the admin console.
 *
 * One route with a `?type=` switch rather than nine sibling files: every report
 * shares the same guard, the same query schema and the same date-window
 * handling, and the dashboard asks for several of them on one page load.
 *
 * `withAuth` rather than `withRole` because the roles differ per report — a
 * service technician may read the service and sales figures but not the shop's
 * P&L. `REPORT_ROLES` in `lib/validation/reports.ts` holds that table; the check
 * happens below, after `?type=` is known.
 *
 * Nothing here computes anything. The aggregation is in `lib/reports/aggregate.ts`
 * so it can be called directly from a server component later without going back
 * out through HTTP.
 */
export const GET = withAuth(async (request, { user }) => {
  const query = parseQuery(request.url, reportQuerySchema);
  if (!query.ok) return query.response;

  const type = query.data.type as ReportType;
  const allowed: UserRole[] = REPORT_ROLES[type];

  if (!allowed.includes(user.role as UserRole)) {
    // Deliberately the same 403 as any other refusal — which reports exist is
    // not sensitive, but confirming "this one exists and you specifically may
    // not see it" tells a curious `sales` account where the money screens are.
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    switch (type) {
      case 'sales-series':
        return NextResponse.json(await salesSeries(query.data));
      case 'top-products':
        return NextResponse.json(await topProducts(query.data));
      case 'top-categories':
        return NextResponse.json(await topCategories(query.data));
      case 'profit-loss':
        return NextResponse.json(await profitLoss(query.data));
      case 'vat-summary':
        return NextResponse.json(await vatSummary(query.data));
      case 'inventory-valuation':
        return NextResponse.json(await inventoryValuation());
      case 'accounts-payable':
        return NextResponse.json(await accountsPayable(query.data));
      case 'status-breakdown':
        return NextResponse.json(await statusBreakdown(query.data));
      case 'service-revenue':
        return NextResponse.json(await serviceRevenue(query.data));
    }
  } catch (error) {
    console.error(`Error building report "${type}":`, error);
    return NextResponse.json({ error: 'Failed to build report' }, { status: 500 });
  }
});
