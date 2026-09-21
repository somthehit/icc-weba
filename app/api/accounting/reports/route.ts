import { and, asc, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/db';
import { accounts, journalEntries, journalLines } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { parseQuery } from '@/lib/validation/parse';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = withRole(['admin', 'sales'], async (request: NextRequest) => {
  try {
    const parsed = parseQuery(request.url, querySchema);
    if (!parsed.ok) return parsed.response;

    const { from, to } = parsed.data;

    const dateConditions = [
      from ? sql`${journalEntries.entryDate} >= ${from}` : undefined,
      to ? sql`${journalEntries.entryDate} <= ${to}` : undefined,
    ].filter(Boolean);

    // Fetch all active accounts
    const allAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.isActive, true))
      .orderBy(asc(accounts.code));

    // Calculate aggregated debits and credits per account for the selected period
    const accountTotals = await db
      .select({
        accountId: journalLines.accountId,
        totalDebit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        totalCredit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .leftJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
      .where(dateConditions.length ? and(...dateConditions) : undefined)
      .groupBy(journalLines.accountId);

    const totalsMap = new Map(
      accountTotals.map((t) => [
        t.accountId,
        {
          debit: Number(t.totalDebit),
          credit: Number(t.totalCredit),
        },
      ]),
    );

    // 1. Build Trial Balance rows
    let totalTrialDebit = 0;
    let totalTrialCredit = 0;

    const trialBalanceRows = allAccounts.map((acc) => {
      const totals = totalsMap.get(acc.id) ?? { debit: 0, credit: 0 };
      const rawNet = totals.debit - totals.credit;

      let netDebit = 0;
      let netCredit = 0;

      if (rawNet > 0) {
        netDebit = rawNet;
      } else if (rawNet < 0) {
        netCredit = Math.abs(rawNet);
      }

      totalTrialDebit += netDebit;
      totalTrialCredit += netCredit;

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        grossDebit: totals.debit,
        grossCredit: totals.credit,
        netDebit,
        netCredit,
      };
    });

    const isTrialBalanced = Math.abs(totalTrialDebit - totalTrialCredit) < 0.01;

    // 2. Build Profit & Loss Statement (Revenue vs Expenses & COGS)
    const revenueRows: Array<{ id: number; code: string; name: string; amount: number }> = [];
    const cogsRows: Array<{ id: number; code: string; name: string; amount: number }> = [];
    const expenseRows: Array<{ id: number; code: string; name: string; amount: number }> = [];

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalOperatingExpenses = 0;

    allAccounts.forEach((acc) => {
      const totals = totalsMap.get(acc.id) ?? { debit: 0, credit: 0 };
      if (acc.type === 'revenue') {
        // Revenue is credit-natured
        const amount = totals.credit - totals.debit;
        if (amount !== 0) {
          revenueRows.push({ id: acc.id, code: acc.code, name: acc.name, amount });
          totalRevenue += amount;
        }
      } else if (acc.type === 'expense') {
        // Expense is debit-natured
        const amount = totals.debit - totals.credit;
        if (acc.code.startsWith('50') || acc.name.toLowerCase().includes('cost of goods') || acc.name.toLowerCase().includes('cogs')) {
          cogsRows.push({ id: acc.id, code: acc.code, name: acc.name, amount });
          totalCogs += amount;
        } else {
          expenseRows.push({ id: acc.id, code: acc.code, name: acc.name, amount });
          totalOperatingExpenses += amount;
        }
      }
    });

    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalOperatingExpenses;
    const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return NextResponse.json({
      period: { from: from ?? null, to: to ?? null },
      trialBalance: {
        rows: trialBalanceRows,
        totalDebit: totalTrialDebit,
        totalCredit: totalTrialCredit,
        difference: Math.abs(totalTrialDebit - totalTrialCredit),
        isBalanced: isTrialBalanced,
      },
      profitAndLoss: {
        revenue: { rows: revenueRows, total: totalRevenue },
        cogs: { rows: cogsRows, total: totalCogs },
        grossProfit,
        operatingExpenses: { rows: expenseRows, total: totalOperatingExpenses },
        netProfit,
        netMarginPercent: Number(netMarginPercent.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('Error generating financial reports:', error);
    return NextResponse.json({ error: 'Failed to generate financial reports' }, { status: 500 });
  }
});
