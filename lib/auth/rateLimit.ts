// FR-A11: 5 failed login attempts per email per 15-minute window trigger a
// rate-limit block. In-memory `Map`, per the ticket's own v1 note (can
// migrate to Redis in v1.1 if clustering is needed) -- correct for this
// app's single-instance deployment.
const WINDOW_MS = 15 * 60 * 1000;
export const MAX_LOGIN_ATTEMPTS = 5;

interface RateLimitEntry {
  count: number;
  firstFailureAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Defence in depth: callers (lib/auth/loginAttempt.ts) already normalize
// email via lib/validation/auth.ts's `emailSchema` before this module ever
// sees it, but the rate-limit key itself must never depend on that -- a
// caller that forgets to normalize must not silently split one email's
// counter across two keys (E6).
function key(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Records a failed login attempt and returns the new count for this
 * window. A window is reset (count restarts at 1) once `now` is 15+
 * minutes past the window's first failure.
 */
export function incrementFailure(email: string, now: Date = new Date()): number {
  const k = key(email);
  const nowMs = now.getTime();
  const existing = store.get(k);

  if (existing && nowMs - existing.firstFailureAt < WINDOW_MS) {
    existing.count += 1;
    return existing.count;
  }

  store.set(k, { count: 1, firstFailureAt: nowMs });
  return 1;
}

/**
 * True once this email has reached `MAX_LOGIN_ATTEMPTS` failures within
 * the current 15-minute window. A stale entry (window elapsed) is treated
 * as not blocked and removed.
 */
export function isBlocked(email: string, now: Date = new Date()): boolean {
  const k = key(email);
  const entry = store.get(k);
  if (!entry) {
    return false;
  }

  const nowMs = now.getTime();
  if (nowMs - entry.firstFailureAt >= WINDOW_MS) {
    store.delete(k);
    return false;
  }

  return entry.count >= MAX_LOGIN_ATTEMPTS;
}

/** Clears the failure counter for an email -- called on a successful login. */
export function clearFailures(email: string): void {
  store.delete(key(email));
}
