'use server';

import { redirect } from 'next/navigation';
import { evaluateLoginAttempt } from '../../lib/auth/loginAttempt';
import { signIn } from '../../lib/auth/config';
import { isValidRedirect } from '../../lib/auth/redirectValidation';
import { loginSchema } from '../../lib/validation/auth';

const DEFAULT_POST_LOGIN_DESTINATION = '/dashboard';

export interface LoginActionResult {
  error?: string;
}

/**
 * Server Action behind the login form (FR-A1, FR-A11). Not wrapped in
 * `authedAction` -- establishing a session is exactly what this action
 * does, so there is no prior session to assert (§8.2; see this ticket's
 * Definition of Done, which marks that step N/A here).
 *
 * `evaluateLoginAttempt` is the single source of truth for "is this
 * attempt allowed, and are the credentials valid" (rate limiting, the
 * generic error message, and the constant-time dummy-hash comparison all
 * live there, shared with next-auth's own `authorize()` via
 * lib/auth/verifyCredentials.ts). Once it says the attempt is valid, this
 * action calls next-auth's `signIn()` purely to establish the session
 * cookie -- that re-runs `authorize()` once more via next-auth's own
 * flow, which is what actually has access to the request-scoped
 * `cookies()` API `evaluateLoginAttempt` deliberately avoids depending on
 * (see lib/auth/loginAttempt.ts).
 */
export async function loginAction(input: {
  email: string;
  password: string;
  redirectTo?: string;
}): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid email or password' };
  }

  const { email, password } = parsed.data;

  const attempt = await evaluateLoginAttempt(email, password);
  if (!attempt.ok) {
    return { error: attempt.error };
  }

  await signIn('credentials', { email, password, redirect: false });

  // FR-A2 (AC6/AC7): the `redirect` query param carries the destination
  // the user was trying to reach before middleware.ts sent them here.
  // Re-validated with the same `isValidRedirect` the middleware uses --
  // never trust a value that only round-tripped through the client --
  // and falls back to the dashboard both when it's missing (E8) and when
  // it fails validation, which also covers the `/login` loop-prevention
  // case (E9): `/login` is never on `isValidRedirect`'s allowlist.
  const destination =
    input.redirectTo && isValidRedirect(input.redirectTo)
      ? input.redirectTo
      : DEFAULT_POST_LOGIN_DESTINATION;
  redirect(destination);
}
