import { prisma } from '../db';

export interface AuthUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

/**
 * Looks up a user by email for the Credentials provider's `authorize()`
 * callback (lib/auth/config.ts). `passwordHash` is selected only here in
 * the repository layer, and only ever read by `authorize()` to compare
 * locally with `verifyPassword`; it never leaves the server — not in a
 * Server Action return, a Server Component prop, a log line, or an audit
 * snapshot (§8.2, FR-A10).
 */
export async function findUserForLogin(email: string): Promise<AuthUserRecord | null> {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, passwordHash: true },
  });
}
