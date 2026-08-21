import type { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../db';

export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

/**
 * Writes one audit entry (§6.1, NFR-2). Every caller passes the same `tx`
 * it used for the mutation this entry documents, so the two commit
 * together or not at all -- never two separate `await`s. `before`/`after`
 * snapshots must never include `passwordHash`, `tokenHash`, or any other
 * secret (§8.2, FR-A10); that is each caller's responsibility, since this
 * repository has no way to know which fields on an arbitrary snapshot are
 * sensitive.
 */
export async function recordAuditLog(
  entry: AuditLogEntry,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  await tx.auditLog.create({ data: entry });
}
