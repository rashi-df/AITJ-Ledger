import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { recordAuditLog } from './auditLog';

export interface AuthUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  mustChangePassword: boolean;
}

/**
 * Looks up a user by email for the Credentials provider's `authorize()`
 * callback (lib/auth/config.ts). `passwordHash` is selected only here in
 * the repository layer, and only ever read by `authorize()` to compare
 * locally with `verifyPassword`; it never leaves the server — not in a
 * Server Action return, a Server Component prop, a log line, or an audit
 * snapshot (§8.2, FR-A10). `mustChangePassword` is selected alongside it so
 * `authorize()` can carry it into the JWT (AITJ-M1-04, FR-A5) -- it is not a
 * secret and is safe to serialize to the session.
 */
export async function findUserForLogin(email: string): Promise<AuthUserRecord | null> {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, passwordHash: true, mustChangePassword: true },
  });
}

// AITJ-M1-04 (FR-A5). Fields needed for the forced-password-change Server
// Action's safety check (AC9) -- deliberately excludes `passwordHash`.
export interface ForcedPasswordChangeUser {
  id: string;
  mustChangePassword: boolean;
}

/**
 * Re-reads the acting user's `mustChangePassword` flag from inside the same
 * transaction the password update commits in, so the action's safety check
 * (never allow this flow to run for an account that isn't actually in the
 * forced-change state) can never race against a concurrent change.
 */
export async function findUserForForcedPasswordChange(
  userId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<ForcedPasswordChangeUser | null> {
  return tx.user.findUnique({
    where: { id: userId },
    select: { id: true, mustChangePassword: true },
  });
}

/**
 * Sets a new password hash and clears `mustChangePassword` in one write.
 * Always called from within the same `prisma.$transaction` as the audit
 * entry it belongs with (NFR-2) -- never on its own.
 */
export async function setPasswordAndClearMustChangeFlag(
  userId: string,
  passwordHash: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
}

/**
 * Owns the forced-password-change transaction end to end (§8.2): re-reads
 * `mustChangePassword` inside the transaction so the AC9 safety check can't
 * race a concurrent change, writes the new hash, and records the audit
 * entry -- all-or-nothing (NFR-2). The action layer never touches Prisma
 * directly; it only calls this function and branches on the result.
 */
export async function applyForcedPasswordChange(
  userId: string,
  passwordHash: string,
): Promise<{ ok: true } | { ok: false }> {
  return prisma.$transaction(async (tx) => {
    const user = await findUserForForcedPasswordChange(userId, tx);
    if (!user || !user.mustChangePassword) {
      return { ok: false as const };
    }

    await setPasswordAndClearMustChangeFlag(userId, passwordHash, tx);

    // Never includes passwordHash -- only the flag transition (FR-A10).
    await recordAuditLog(
      {
        entityType: 'User',
        entityId: userId,
        action: 'UPDATE',
        actorId: userId,
        before: { mustChangePassword: true },
        after: { mustChangePassword: false },
      },
      tx,
    );

    return { ok: true as const };
  });
}
