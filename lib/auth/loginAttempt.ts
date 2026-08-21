import { clearFailures, incrementFailure, isBlocked, MAX_LOGIN_ATTEMPTS } from './rateLimit';
import { verifyCredentials } from './verifyCredentials';

export const GENERIC_LOGIN_ERROR = 'Invalid email or password';
export const RATE_LIMIT_ERROR = 'Too many attempts. Try again later.';

export interface LoginAttemptResult {
  ok: boolean;
  error?: string;
}

/**
 * Rate-limit-gated credential check (FR-A11), run ahead of next-auth's
 * `signIn()` in actions/auth/login.ts. Kept independent of next-auth's
 * ambient `signIn()`/`cookies()` (which need a real Next.js request
 * scope -- see AITJ-M1-01's session.test.ts/logout.test.ts for the same
 * constraint) so it can be exercised directly in integration tests
 * against real Postgres.
 *
 * `now` is injected (defaulting to the real clock) purely for
 * deterministic rate-limit-window tests; production callers never pass it.
 */
export async function evaluateLoginAttempt(
  email: string,
  password: string,
  now: Date = new Date(),
): Promise<LoginAttemptResult> {
  if (isBlocked(email, now)) {
    return { ok: false, error: RATE_LIMIT_ERROR };
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    const attempts = incrementFailure(email, now);
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      return { ok: false, error: RATE_LIMIT_ERROR };
    }
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  clearFailures(email);
  return { ok: true };
}
