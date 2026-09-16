import { NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import { accounts, codSettlements, journalEntries, journalLines, users } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';

/**
 * COD driver cash settlement.
 *
 * Banking a driver's collected cash is two facts that must not be able to
 * disagree: the operational record, and the ledger movement. Both are written in
 * one transaction, and `cod_settlements.journal_entry_id` is NOT NULL, so a
 * settlement without a balanced entry is unrepresentable.
 *
 * The entry itself:
 *   DEBIT   deposit account (bank / vault)      + collected
 *   CREDIT  1250 Cash in Transit (Driver)       - collected
 *
 * 1250 is a clearing account. Cash is recognised against it when the driver
 * collects; this settlement clears it back down as the money reaches the bank.
 */

/** The clearing account the credit side always targets. */
const TRANSIT_ACCOUNT_CODE = '1250';

const settlementSchema = z.object({
  driverUserId: z.number().int().positive().optional(),
  driverName: z.string().trim().min(2, 'Name the driver or courier').max(150),
  orderReference: z.string().trim().max(60).optional().or(z.literal('')),
  collectedAmount: z.number().positive('Amount collected must be greater than zero').max(100_000_000),
  depositAccountId: z.number().int().positive(),
  bankReference: z.string().trim().max(80).optional().or(z.literal('')),
  attachmentUrl: z.string().trim().max(500).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  /** Defaults to today; supplied when back-dating a deposit. */
  settledOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = withRole(['admin', 'sales'], async () => {
  try {
    const rows = await db
      .select({
        id: codSettlements.id,
        settlementNumber: codSettlements.settlementNumber,
        driverName: codSettlements.driverName,
        orderReference: codSettlements.orderReference,
        collectedAmount: codSettlements.collectedAmount,
        bankReference: codSettlements.bankReference,
        attachmentUrl: codSettlements.attachmentUrl,
        settledAt: codSettlements.settledAt,
        depositAccountCode: accounts.code,
        depositAccountName: accounts.name,
        entryNumber: journalEntries.entryNumber,
      })
      .from(codSettlements)
      .leftJoin(accounts, eq(accounts.id, codSettlements.depositAccountId))
      .leftJoin(journalEntries, eq(journalEntries.id, codSettlements.journalEntryId))
      .orderBy(desc(codSettlements.settledAt))
      .limit(200);

    const [totals] = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${codSettlements.collectedAmount}), 0)`,
      })
      .from(codSettlements);

    // Drives the "still with drivers" figure: the transit account's net debit is
    // cash recognised but not yet banked.
    const [transit] = await db
      .select({
        outstanding: sql<string>`coalesce(sum(${journalLines.debit}) - sum(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .leftJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(eq(accounts.code, TRANSIT_ACCOUNT_CODE));

    return NextResponse.json({
      settlements: rows,
      totals: { ...totals, outstandingTransit: transit?.outstanding ?? '0' },
    });
  } catch (error) {
    console.error('Error loading COD settlements:', error);
    return NextResponse.json({ error: 'Failed to load COD settlements' }, { status: 500 });
  }
});

export const POST = withRole(['admin'], async (request, { user }) => {
  try {
    const parsed = await parseJson(request, settlementSchema);
    if (!parsed.ok) return parsed.response;

    const {
      driverUserId,
      driverName,
      orderReference,
      collectedAmount,
      depositAccountId,
      bankReference,
      attachmentUrl,
      notes,
      settledOn,
    } = parsed.data;

    const [depositAccount] = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.id, depositAccountId), eq(accounts.isActive, true)))
      .limit(1);

    if (!depositAccount) {
      return NextResponse.json(
        { error: 'That deposit account does not exist or is inactive.' },
        { status: 400 },
      );
    }

    // Depositing into a revenue or liability account would balance arithmetically
    // but be meaningless — cash has to land in an asset.
    if (depositAccount.type !== 'asset') {
      return NextResponse.json(
        { error: `${depositAccount.name} is a ${depositAccount.type} account. Deposit into a bank or cash account.` },
        { status: 400 },
      );
    }

    const [transitAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.code, TRANSIT_ACCOUNT_CODE))
      .limit(1);

    if (!transitAccount) {
      return NextResponse.json(
        { error: `Chart of accounts is missing ${TRANSIT_ACCOUNT_CODE} (Cash in Transit).` },
        { status: 500 },
      );
    }

    if (transitAccount.id === depositAccount.id) {
      return NextResponse.json(
        { error: 'The deposit account cannot be the driver transit account itself.' },
        { status: 400 },
      );
    }

    if (driverUserId) {
      const [driver] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, driverUserId))
        .limit(1);
      if (!driver) {
        return NextResponse.json({ error: 'That staff member no longer exists.' }, { status: 400 });
      }
    }

    const entryDate = settledOn ?? new Date().toISOString().slice(0, 10);
    // Fixed to 2dp: the column is numeric(14,2), and letting a float through would
    // round at the database and break the balance by a paisa.
    const amount = collectedAmount.toFixed(2);

    const result = await db.transaction(async (tx) => {
      const [entry] = await tx
        .insert(journalEntries)
        .values({
          entryNumber: `COD-JE-${Date.now()}`,
          entryDate,
          description: `COD settlement — ${driverName}${orderReference ? ` (${orderReference})` : ''}`,
          sourceType: 'cod_settlement',
          attachmentUrl: attachmentUrl || null,
          postedBy: user.userId,
        })
        .returning();

      await tx.insert(journalLines).values([
        {
          journalEntryId: entry.id,
          accountId: depositAccount.id,
          description: bankReference ? `Deposit ref ${bankReference}` : 'COD cash banked',
          debit: amount,
          credit: '0',
        },
        {
          journalEntryId: entry.id,
          accountId: transitAccount.id,
          description: `Cleared from ${driverName}`,
          debit: '0',
          credit: amount,
        },
      ]);

      const [settlement] = await tx
        .insert(codSettlements)
        .values({
          driverUserId: driverUserId ?? null,
          driverName,
          orderReference: orderReference || null,
          collectedAmount: amount,
          depositAccountId: depositAccount.id,
          bankReference: bankReference || null,
          attachmentUrl: attachmentUrl || null,
          journalEntryId: entry.id,
          notes: notes || null,
          settledBy: user.userId,
        })
        .returning();

      // Backstop: re-read the lines and confirm they balance before committing. The
      // amounts are constructed above so this should never fire, but a settlement
      // that unbalanced the ledger would be expensive to find later.
      const [check] = await tx
        .select({
          debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
          credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
        })
        .from(journalLines)
        .where(eq(journalLines.journalEntryId, entry.id));

      if (Number(check.debit) !== Number(check.credit)) {
        throw new Error(`Unbalanced COD entry: ${check.debit} vs ${check.credit}`);
      }

      return { settlement, entry };
    });

    return NextResponse.json(
      {
        success: true,
        settlement: result.settlement,
        entry: result.entry,
        posted: {
          debit: { code: depositAccount.code, name: depositAccount.name, amount },
          credit: { code: TRANSIT_ACCOUNT_CODE, name: 'Cash in Transit (Driver)', amount },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error posting COD settlement:', error);
    return NextResponse.json({ error: 'Failed to record the settlement' }, { status: 500 });
  }
});
