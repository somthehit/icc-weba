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

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withRole<RouteContext>(['admin', 'sales'], async (request: NextRequest, _auth, context) => {
  try {
    const { id } = await context.params;
    const accountId = Number(id);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const parsed = parseQuery(request.url, querySchema);
    if (!parsed.ok) return parsed.response;

    const { from, to } = parsed.data;

    // 1. Calculate opening balance before 'from' date if 'from' is specified
    let openingDebit = 0;
    let openingCredit = 0;

    if (from) {
      const [preRows] = await db
        .select({
          debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
          credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
        })
        .from(journalLines)
        .leftJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
        .where(
          and(
            eq(journalLines.accountId, accountId),
            sql`${journalEntries.entryDate} < ${from}`,
          ),
        );

      openingDebit = Number(preRows?.debit ?? 0);
      openingCredit = Number(preRows?.credit ?? 0);
    }

    const isCreditNature = ['liability', 'equity', 'revenue'].includes(account.type);
    const openingBalance = isCreditNature
      ? openingCredit - openingDebit
      : openingDebit - openingCredit;

    // 2. Fetch journal lines within the selected date window
    const conditions = [
      eq(journalLines.accountId, accountId),
      from ? sql`${journalEntries.entryDate} >= ${from}` : undefined,
      to ? sql`${journalEntries.entryDate} <= ${to}` : undefined,
    ].filter(Boolean);

    const rows = await db
      .select({
        id: journalLines.id,
        journalEntryId: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        entryDate: journalEntries.entryDate,
        entryDescription: journalEntries.description,
        lineDescription: journalLines.description,
        sourceType: journalEntries.sourceType,
        attachmentUrl: journalEntries.attachmentUrl,
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
      .from(journalLines)
      .leftJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
      .where(and(...conditions))
      .orderBy(asc(journalEntries.entryDate), asc(journalEntries.id), asc(journalLines.id));

    // 3. Compute running balance for each line
    let currentBalance = openingBalance;
    const transactions = rows.map((row) => {
      const d = Number(row.debit ?? 0);
      const c = Number(row.credit ?? 0);
      if (isCreditNature) {
        currentBalance += c - d;
      } else {
        currentBalance += d - c;
      }

      return {
        id: row.id,
        journalEntryId: row.journalEntryId,
        entryNumber: row.entryNumber,
        entryDate: row.entryDate,
        description: row.lineDescription || row.entryDescription,
        sourceType: row.sourceType,
        attachmentUrl: row.attachmentUrl,
        debit: d,
        credit: c,
        runningBalance: currentBalance,
      };
    });

    const totalPeriodDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalPeriodCredit = transactions.reduce((sum, t) => sum + t.credit, 0);
    const closingBalance = currentBalance;

    return NextResponse.json({
      account,
      openingBalance,
      closingBalance,
      totalPeriodDebit,
      totalPeriodCredit,
      transactions,
    });
  } catch (error) {
    console.error('Error loading account ledger:', error);
    return NextResponse.json({ error: 'Failed to load account ledger' }, { status: 500 });
  }
});
