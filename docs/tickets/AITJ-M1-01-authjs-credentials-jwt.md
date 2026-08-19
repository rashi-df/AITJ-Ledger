# AITJ-M1-01 — Configure Auth.js v5 with Credentials provider and JWT sessions

| Field | Value |
|---|---|
| Milestone | M1 — Auth |
| Depends on | AITJ-M0-03, AITJ-M0-06, AITJ-M0-07 |
| Blocks | AITJ-M1-02, AITJ-M1-03, AITJ-M1-04, AITJ-M1-05 |
| PRD refs | FR-A3, FR-A4, FR-A10, §8.2 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

Auth.js v5 with a Credentials provider and JWT sessions is the authentication backbone. Sessions must be httpOnly, secure, and sameSite=lax cookies with a 7-day sliding window expiry (FR-A3). Passwords are hashed with bcrypt cost 12 and never logged or returned (FR-A10). The `authedAction` wrapper (§8.2) ensures every Server Action checks for a valid session before proceeding.

## Acceptance criteria

- [ ] AC1 — Auth.js v5 config initializes with Credentials provider, reading `AUTH_SECRET` and `AUTH_URL` from env
- [ ] AC2 — Session cookie is httpOnly, secure, sameSite=lax, 7-day sliding window expiry
- [ ] AC3 — Passwords are hashed with bcrypt cost 12; raw password never stored or returned
- [ ] AC4 — `authedAction` wrapper asserts session before any Server Action executes
- [ ] AC5 — (FR-A4) A user can log out from any page; the session is invalidated immediately and the cookie cleared

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Logout called from any page | Session cookie deleted, user redirected to /login |
| E2 | Expired JWT token in cookie | Session rejected, user redirected to /login on next request |
| E3 | `AUTH_SECRET` or `AUTH_URL` missing in env | App startup fails with clear error message |
| E4 | Password containing multi-byte UTF-8 (e.g. "Müller123456") | bcrypt truncates at 72 bytes; hashing is consistent across logins |
| E5 | Password exactly 10 chars (minimum valid) | Accepted and hashed correctly |
| E6 | Password exactly 72 chars (maximum valid) | Accepted and hashed correctly |
| E7 | Password exactly 9 chars or 73 chars | Validation rejects before hashing |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | unit | `password validation > rejects password < 10 chars` | A 9-char password fails Zod validation |
| T2 | unit | `password validation > rejects password > 72 chars` | A 73-char password fails Zod validation |
| T3 | unit | `password validation > accepts password exactly 10 chars` | A 10-char password passes validation |
| T4 | unit | `password validation > accepts password exactly 72 chars` | A 72-char password passes validation |
| T5 | unit | `password hashing > hashes with bcrypt cost 12` | Hash created via bcrypt with cost 12 is valid |
| T6 | integration | `session > sets httpOnly secure sameSite=lax cookie` | Cookie header contains HttpOnly, Secure, SameSite=Lax |
| T7 | integration | `session > 7-day sliding window expiry updates on each request` | Expires timestamp advances by 7 days on consecutive requests |
| T8 | integration | `logout > invalidates session immediately` | After logout, session cookie is deleted; next request is unauthenticated |
| T9 | unit | `password hash > never returned in serialized context` | passwordHash field excluded from any JSON serialization mock |
| T10 | integration | `authedAction > blocks execution if no session` | Server Action throws or returns error before reaching business logic |

**Red gate:** every test above is written and failing for the right reason (assertion failure or missing module — never a syntax error or a typo in the import path). Commit the failing tests before writing implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create/modify:**

1. **`lib/validation/auth.ts`** — Zod schema for password (10–72 chars); export `passwordSchema`.
2. **`lib/auth/password.ts`** — bcrypt hashing: `hashPassword(plain: string): Promise<string>` and `verifyPassword(plain: string, hash: string): Promise<boolean>`. Cost always 12.
3. **`lib/auth/config.ts`** — Auth.js v5 config:
   - Credentials provider: email + password login, validates email exists, calls `verifyPassword`.
   - JWT session strategy.
   - Session cookie config: httpOnly, secure (in production), sameSite='lax', maxAge = 7 days.
   - Callbacks: `session` (excludes passwordHash), `jwt` (handles 7-day sliding window).
4. **`lib/auth/authedAction.ts`** — Server Action wrapper:
   - Reads session via `getSession()`.
   - If no session, throws `AuthError` with generic message.
   - Returns typed `authedAction` function that injects session as first param to wrapped action.
5. **`app/api/auth/[...nextauth]/route.ts`** — Route handler exporting Auth.js handlers.
6. **`lib/auth/logout.ts`** — Server Action: `logoutAction()` calls `signOut()`, invalidates session, redirects to /login.

**Schema reference:** password validation is §7 table: 10–72 chars.

**Security:** passwordHash is never accessed outside `lib/auth/password.ts`. Session callback serializes User for the JWT without the hash field. Logs use structured format (`actor: userId, action: "login"`) never containing password or hash.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present (client validation alone is never sufficient — §7)
- [ ] Every read filters `deletedAt: null` via the repository layer (§6.1) — N/A for this ticket
- [ ] Mutation is atomic with its audit entry (NFR-2), if it mutates — N/A for this ticket
- [ ] Session asserted via `authedAction` (§8.2), if it is an action — authedAction implemented
- [ ] No N+1 queries — verified by query count or `include`/`select` inspection — N/A for this ticket
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts, passwords, or tokens in logs (NFR-8)
- [ ] Responsive at 360px, tap targets ≥44px (NFR-3) — N/A for this ticket
- [ ] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4) — N/A for this ticket
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
