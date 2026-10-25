import { createHash } from 'crypto';
import { db } from '@/db';
import { auditLog } from '@/db/schema/pos-enterprise';
import { desc } from 'drizzle-orm';

/**
 * Generates an immutable SHA-256 hash for a new audit log record,
 * chaining it to the previous record's hash to ensure tamper-evidence.
 */
export async function appendAuditHashEntry(params: {
  action: string;
  actorId?: string | null;
  approverId?: string | null;
  terminalId?: string | null;
  entity?: string | null;
  entityId?: string | null;
  meta?: any;
}) {
  try {
    // 1. Fetch latest audit row to get prevHash
    const [latest] = await db
      .select({ hash: auditLog.hash })
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(1);

    const prevHash = latest?.hash || 'GENESIS_HASH_ICC_ERP_2082_ROOT';
    const timestamp = new Date().toISOString();
    const metaString = JSON.stringify(params.meta || {});

    // Compute SHA-256
    const payload = `${prevHash}|${params.actorId || 'SYSTEM'}|${params.action}|${params.entity || ''}|${params.entityId || ''}|${timestamp}|${metaString}`;
    const hash = createHash('sha256').update(payload).digest('hex');

    const [inserted] = await db
      .insert(auditLog)
      .values({
        action: params.action,
        actorId: params.actorId || null,
        approverId: params.approverId || null,
        terminalId: params.terminalId || null,
        entity: params.entity || null,
        entityId: params.entityId || null,
        meta: params.meta || null,
        prevHash,
        hash,
        createdAt: new Date(),
      })
      .returning();

    return inserted;
  } catch (error) {
    console.error('Failed to append hash-chained audit log:', error);
    return null;
  }
}
