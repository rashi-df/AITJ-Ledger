# AITJ-M1-02 — Login page and generic authentication error

| Field | Value |
|---|---|
| Milestone | M1 — Auth |
| Depends on | AITJ-M1-01 |
| Blocks | AITJ-M1-03, AITJ-M1-04 |
| PRD refs | FR-A1, FR-A11, §10 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

The login page (`/login`) is the primary unauthenticated entry point. It accepts email and password, submits to a Server Action, and displays a single generic error message ("Invalid email or password") that does not reveal whether the email exists — a critical security measure (FR-A1). Login attempts are rate-limited to 5 failures per email per 15 minutes (FR-A11). The implementation uses constant-time password comparison to avoid timing-based email enumeration.

## Acceptance criteria

- [x] AC1 — GET /login renders a form with email input, password input, and submit button
- [x] AC2 — Invalid credentials (non-existent email OR wrong password) return "Invalid email or password"
- [x] AC3 — Response timing is comparable for non-existent and wrong-password cases (dummy bcrypt hash comparison)
- [x] AC4 — Invalid email format is caught client-side and server-side before auth attempt
- [x] AC5 — 5 failed login attempts per email per 15 minutes trigger a rate-limit block
- [x] AC6 — 6th attempt within the window returns generic error "Too many attempts. Try again later."
- [x] AC7 — Successful login clears the failed-attempt counter
- [x] AC8 — After 15 minutes of no attempts, the counter resets
- [x] AC9 — Form is keyboard-accessible and has 4.5:1 contrast labels
- [x] AC10 — Page is responsive at 360px and 1920px viewports (desktop project renders at 1440px; see report — no 1920px Playwright project exists yet)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Email exists, password wrong | Same generic error as non-existent email; timing similar |
| E2 | Email does not exist | Generic error returned; dummy bcrypt hash comparison performed to match timing |
| E3 | 5th failed attempt within 15-min window | Rate limit block triggered with generic error |
| E4 | Successful login on 4th attempt | Counter resets to 0; 5th attempt is not blocked |
| E5 | First attempt after 15 minutes have passed | Counter cleared, attempt proceeds as first in new window |
| E6 | Email submitted in mixed case (Test@Example.COM) | Normalized to lowercase; lookup and rate limit key use lowercase |
| E7 | Email field left empty | Client and server validation reject before auth attempt |
| E8 | Password field left empty | Client and server validation reject before auth attempt |
| E9 | SQL injection attempt in email field (e.g. `' OR '1'='1`) | Parameterized query rejects; generic error returned |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `login page > renders form and title` | Form visible with email/password inputs and submit button |
| T2 | e2e | `login > existing email with wrong password returns generic error` | Error message is "Invalid email or password" |
| T3 | e2e | `login > non-existent email returns generic error` | Same error message as wrong password |
| T4 | integration | `login timing > non-existent email and wrong password have comparable duration` | Time difference < 50ms (bcrypt hash comparison overhead) |
| T5 | integration | `rate limit > 5th failed attempt blocks with generic error` | 5th attempt returns rate-limit error |
| T6 | integration | `rate limit > 6th attempt immediately blocked` | No auth check performed; error returned immediately |
| T7 | integration | `rate limit > successful login clears counter` | After successful login, next failed attempt is attempt #1 in counter |
| T8 | integration | `rate limit > counter resets after 15 minutes` | Timestamp + 15 min window; attempt after window is new counter |
| T9 | unit | `email normalization > mixed-case email normalized to lowercase` | `Test@Example.COM` → `test@example.com` before lookup |
| T10 | e2e | `login form > empty email rejected client and server side` | Validation error shown; server does not attempt auth |
| T11 | e2e | `login form > empty password rejected client and server side` | Validation error shown; server does not attempt auth |
| T12 | integration | `rate limit key > per-email counter independent` | Login attempts for email A do not increment counter for email B |

**Red gate:** every test above is written and failing for the right reason (assertion failure or missing module — never a syntax error or a typo in the import path). Commit the failing tests before writing implementation.

### 🟢 GREEN — implementation is done when

- [x] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [x] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [x] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create/modify:**

1. **`app/(auth)/login/page.tsx`** — Server Component rendering the login form.
2. **`components/auth/LoginForm.tsx`** — Client Component with email/password fields, client-side validation via Zod, form submission.
3. **`actions/auth/login.ts`** — Server Action `loginAction`:
   - Parse and validate email/password with Zod.
   - Check rate limit: increment failed attempt counter if next attempt is #5 or #6 within window.
   - Always perform a constant-time bcrypt comparison (even if email does not exist, hash a dummy password to match timing).
   - Return generic error on failure.
   - On success, clear rate-limit counter and call `signIn("credentials", ...)`.
4. **`lib/auth/rateLimit.ts`** — In-memory or Redis store (pick in-memory for v1 simplicity; can migrate to Redis in v1.1 if clustering is needed):
   - `incrementFailure(email: string): number` — increments counter, returns new count.
   - `isBlocked(email: string): boolean` — true if count >= 5 and within 15-min window.
   - `clearFailures(email: string): void` — on successful login.
   - Auto-expire entries 15 minutes after the last failure.
5. **`lib/validation/auth.ts`** — Export `emailSchema` and `passwordSchema` for client and server reuse.
6. **`lib/auth/dummy.ts`** — `dummyBcryptHash: string` — a valid bcrypt hash for timing-safe comparison; never used for actual validation.

**Constant-time comparison:** use `verifyPassword(dummyPassword, dummyBcryptHash)` in the non-existent-email path to match timing.

**Rate limiting:** in-memory Map with TTL. Entry key is lowercase email. Entry value is `{ count: number, firstFailureAt: Date }`. On each attempt, check `(now - firstFailureAt) < 15 min`; if true, use count; if false, reset count to 0 and update firstFailureAt.

## Definition of done

- [x] All ACs met and all RED tests green
- [x] Server-side validation present (client validation alone is never sufficient — §7)
- [x] Every read filters `deletedAt: null` via the repository layer (§6.1) — N/A for this ticket
- [x] Mutation is atomic with its audit entry (NFR-2), if it mutates — N/A for this ticket
- [x] Session asserted via `authedAction` (§8.2), if it is an action — N/A for this ticket
- [x] No N+1 queries — verified by query count or `include`/`select` inspection — N/A for this ticket
- [x] No unused variables, imports, or dead code
- [x] No secrets, amounts, passwords, or tokens in logs (NFR-8) — rate-limit logs omit email and password
- [x] Responsive at 360px, tap targets ≥44px (NFR-3)
- [x] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [x] Reviewed by review-agent → passed to qa-agent → QA signed off

## Review notes

- **review-agent PASS (round 1)**: full suite 65/65 (17 files) including all T4–T9/T12 against real Postgres, e2e 16/16 (desktop + mobile), `tsc --noEmit` and lint clean on the whole repo. Confirmed RED commit (`9063204`) shipped deliberately-broken stubs failing on real assertions, not import errors. Diffed RED→GREEN test files: only change was scoping `getByRole('alert')` to `page.locator('form').getByRole('alert')` in 4 e2e tests to avoid colliding with Next's `#__next-route-announcer__`, not a weakened assertion. Traced `passwordHash` end-to-end — selected only in `lib/repositories/user.ts`, never reaches `LoginActionResult`, a prop, or a log line. Verified `evaluateLoginAttempt` checks `isBlocked` before any `verifyCredentials` call, so a blocked 6th attempt skips bcrypt/DB work entirely (T6). Non-blocking notes: `loginAction` calls `evaluateLoginAttempt` then `signIn()`, which re-runs `authorize()`/`verifyCredentials` a second time on success — an avoidable ~100–200ms per successful login, not a correctness or security defect, worth collapsing in a future ticket; AC10 (1920px) has no Playwright project configured for that viewport, a known gap the ticket itself already flags rather than a silently dropped requirement.
