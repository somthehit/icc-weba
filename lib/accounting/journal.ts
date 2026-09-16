import { and, eq } from 'drizzle-orm';
import { accounts, journalEntries, journalLines } from '@/db/schema';
import type { DbClient } from '@/lib/pricing/quote';

export type JournalLineInput = { accountId: number; description?: string; debit?: number; credit?: number };

export async function postJournal(client: DbClient, input: {
  entryNumber: string; entryDate: string; description: string; sourceType?: string; sourceId?: number; postedBy?: number; lines: JournalLineInput[];
}) {
  const debit = input.lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
  const credit = input.lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);
  if (Math.abs(debit - credit) > 0.005 || debit <= 0) throw new Error('Journal entry must balance debits and credits');
  const [existing] = await client.select({ id: journalEntries.id }).from(journalEntries).where(eq(journalEntries.entryNumber, input.entryNumber)).limit(1);
  if (existing) return existing;
  const [entry] = await client.insert(journalEntries).values(input).returning({ id: journalEntries.id });
  await client.insert(journalLines).values(input.lines.map((line) => ({ journalEntryId: entry.id, accountId: line.accountId, description: line.description, debit: String(line.debit ?? 0), credit: String(line.credit ?? 0) })));
  return entry;
}
