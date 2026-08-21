// AITJ-M1-02 RED stub. Deliberately incomplete: no rate limiting, no
// credential check — every attempt "succeeds". T4-T8/T12 in
// tests/integration/auth/loginAttempt.test.ts fail against this on
// assertion mismatches, not a missing-export compile error. Corrected in
// the GREEN commit.
export const GENERIC_LOGIN_ERROR = 'Invalid email or password';
export const RATE_LIMIT_ERROR = 'Too many attempts. Try again later.';

export interface LoginAttemptResult {
  ok: boolean;
  error?: string;
}

export async function evaluateLoginAttempt(
  _email: string,
  _password: string,
  _now: Date = new Date(),
): Promise<LoginAttemptResult> {
  return { ok: true };
}
