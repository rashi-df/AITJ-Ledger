import { prisma } from '../db';

export interface AuthUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

/**
 * Looks up a user by email for the Credentials provider's `authorize()`
 * callback (lib/auth/config.ts). `passwordHash` is selected here — and
 * only here — so it can be compared locally with `verifyPassword`; the
 * caller never forwards it any further (§8.2, FR-A10).
 */
export async function findUserForLogin(email: string): Promise<AuthUserRecord | null> {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, passwordHash: true },
  });
}
