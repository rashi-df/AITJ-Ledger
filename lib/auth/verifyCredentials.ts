import { findUserForLogin } from '../repositories/user';
import { dummyBcryptHash } from './dummy';
import { verifyPassword } from './password';

export interface VerifiedUser {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
}

/**
 * The single source of truth for "are these credentials valid" (FR-A1).
 * Always runs a bcrypt compare -- against the real hash if the email is
 * registered, against `dummyBcryptHash` otherwise -- so the bcrypt cost is
 * paid on every attempt and response timing never reveals whether an
 * email exists. Shared by the Credentials provider's `authorize()`
 * (lib/auth/config.ts) and the rate-limited pre-check in
 * lib/auth/loginAttempt.ts, so the two call sites can never disagree
 * about what counts as a valid login.
 */
export async function verifyCredentials(email: string, password: string): Promise<VerifiedUser | null> {
  const user = await findUserForLogin(email);
  const isValid = await verifyPassword(password, user?.passwordHash ?? dummyBcryptHash);
  if (!user || !isValid) {
    return null;
  }
  return { id: user.id, name: user.name, email: user.email, mustChangePassword: user.mustChangePassword };
}
