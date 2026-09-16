import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accounts, journalEntries, journalLines } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import { z } from 'zod';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * A journal line.
 *
 * `journal_lines` carries `CHECK ((debit = 0 AND credit > 0) OR (credit = 0 AND
 * debit > 0))`, so a line must have exactly one non-zero side. A row with both
 * sides zero — which is what a blank line in the multi-line form produces — would
 * violate that constraint at insert, so it is rejected here with a readable
 * message instead of reaching Postgres.
 */
const lineSchema = z
  .object({
    accountId: z.number().int().positive(),
    description: z.string().trim().max(300).optional(),
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
  })
  .refine((line) => (line.debit > 0) !== (line.credit > 0), {
    message: 'Each line needs a value in exactly one of debit or credit',
  });

const journalSchema = z
  .object({
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().trim().min(2).max(300),
    reference: z.string().trim().max(60).optional(),
    attachmentUrl: z.string().trim().max(500).optional().or(z.literal('')),
    lines: z.array(lineSchema).min(2).max(60),
  })
  .superRefine((value, ctx) => {
    const debit = value.lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = value.lines.reduce((sum, line) => sum + line.credit, 0);
    // Tolerance rather than equality: these arrive as JSON floats, so two figures
    // that are equal in rupees can differ in the last bit.
    if (Math.abs(debit - credit) > 0.005) {
      ctx.addIssue({ code: 'custom', message: 'Debits and credits must balance', path: ['lines'] });
    }
    if (debit <= 0) {
      ctx.addIssue({ code: 'custom', message: 'An entry must move a non-zero amount', path: ['lines'] });
    }
  });

export const GET = withRole(['admin'], async (request: NextRequest) => {
  try {
    const parsed = parseQuery(request.url, querySchema);
    if (!parsed.ok) return parsed.response;

    const conditions = [
      parsed.data.from ? sql`${journalEntries.entryDate} >= ${parsed.data.from}` : undefined,
      parsed.data.to ? sql`${journalEntries.entryDate} <= ${parsed.data.to}` : undefined,
    ].filter(Boolean);

    const [accountRows, entries] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.isActive, true)).orderBy(accounts.code),
      db
        .select({
          id: journalEntries.id,
          entryNumber: journalEntries.entryNumber,
          entryDate: journalEntries.entryDate,
          description: journalEntries.description,
          sourceType: journalEntries.sourceType,
          sourceId: journalEntries.sourceId,
          attachmentUrl: journalEntries.attachmentUrl,
          debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
          credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
        })
        .from(journalEntries)
        .leftJoin(journalLines, eq(journalLines.journalEntryId, journalEntries.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(journalEntries.id)
        .orderBy(desc(journalEntries.entryDate), desc(journalEntries.id))
        .limit(200),
    ]);

    const balances = await db
      .select({
        accountId: journalLines.accountId,
        debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .groupBy(journalLines.accountId);

    return NextResponse.json({ accounts: accountRows, entries, balances });
  } catch (error) {
    // Previously unguarded: the three ledger tables did not exist, so this threw
    // 42P01 and Next replied with a bodiless 500 that told the console nothing.
    console.error('Error loading ledger:', error);
    return NextResponse.json({ error: 'Failed to load the accounting ledger' }, { status: 500 });
  }
});

export const POST = withRole(['admin'], async (request: NextRequest, { user }) => {
  try {
    const parsed = await parseJson(request, journalSchema);
    if (!parsed.ok) return parsed.response;

    const { entryDate, description, reference, attachmentUrl, lines } = parsed.data;

    // Every referenced account has to exist and be active, checked before the
    // insert so a bad id produces a named error rather than an FK violation.
    const ids = [...new Set(lines.map((line) => line.accountId))];
    const known = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.isActive, true), inArray(accounts.id, ids)));

    if (known.length !== ids.length) {
      return NextResponse.json(
        { error: 'One or more selected accounts no longer exist.' },
        { status: 400 },
      );
    }

    const entry = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(journalEntries)
        .values({
          entryNumber: `MANUAL-${Date.now()}`,
          entryDate,
          // The reference is folded into the description because `journal_entries`
          // has no reference column; inventing one for this would be a schema
          // change the ledger does not otherwise need.
          description: reference ? `${description} [ref: ${reference}]` : description,
          sourceType: 'manual',
          attachmentUrl: attachmentUrl || null,
          postedBy: user.userId,
        })
        .returning();

      await tx.insert(journalLines).values(
        lines.map((line) => ({
          journalEntryId: created.id,
          accountId: line.accountId,
          description: line.description,
          debit: String(line.debit),
          credit: String(line.credit),
        })),
      );

      return created;
    });

    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (error) {
    console.error('Error posting journal entry:', error);
    return NextResponse.json({ error: 'Failed to post the journal entry' }, { status: 500 });
  }
});
