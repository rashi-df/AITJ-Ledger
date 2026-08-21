# AITJ-M1-03 — Route protection middleware and post-login redirect

| Field | Value |
|---|---|
| Milestone | M1 — Auth |
| Depends on | AITJ-M1-01 |
| Blocks | AITJ-M1-04, AITJ-M1-05, AITJ-M1-06, AITJ-M1-07, AITJ-M1-08 |
| PRD refs | FR-A2, NFR-7 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

All routes except `/login` and `/invite/[token]` require an authenticated session. Unauthenticated access redirects to `/login?redirect=<original-path>`, and after successful login, the user returns to the intended destination (FR-A2). The redirect URL is validated as a relative in-app path to prevent open-redirect attacks. This is enforced by a middleware or a wrapper applied consistently across all protected routes.

## Acceptance criteria

- [x] AC1 — GET /dashboard unauthenticated redirects to /login?redirect=%2Fdashboard
- [x] AC2 — GET /transactions unauthenticated redirects to /login with preserved destination
- [x] AC3 — GET /invite/[token] is accessible without authentication
- [x] AC4 — GET /login is accessible without authentication (no redirect loop)
- [x] AC5 — Redirect URL is validated as a relative in-app path; external URLs are rejected
- [x] AC6 — After successful login, the redirect param is read and the user is navigated to the saved destination
- [x] AC7 — If redirect param is missing or invalid, post-login redirect defaults to /dashboard
- [x] AC8 — Redirect is a server-side redirect (not client-side XSS), preserving browser history correctly

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Unauthenticated access to /settings | Redirects to /login?redirect=%2Fsettings |
| E2 | Unauthenticated access to /income | Redirects to /login?redirect=%2Fincome |
| E3 | Redirect param is an external URL (https://attacker.com) | Rejected; defaults to /dashboard instead |
| E4 | Redirect param contains a protocol (http://example.com/dashboard) | Rejected; defaults to /dashboard |
| E5 | Redirect param is a relative path with ../ (../../etc/passwd) | Rejected if it escapes app scope; or sanitized to in-app only |
| E6 | Multiple levels deep (/reports/settings/profile) | Redirects correctly if path exists; 404 if invalid path |
| E7 | Redirect param is URL-encoded (%2Fdashboard) | Decoded and validated; if valid, user is redirected |
| E8 | Login succeeds, no redirect param in URL | Defaults to /dashboard |
| E9 | Login succeeds with redirect=/login | Redirects to /dashboard instead (loop prevention) |
| E10 | Session expires during a request | Next request to protected route redirects to /login again |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `protected route > unauthenticated GET /dashboard redirects to /login` | Status 307/308 redirect to /login (or 303 with Location header) |
| T2 | e2e | `protected route > redirect query param preserved` | Redirect URL includes ?redirect=%2Fdashboard |
| T3 | e2e | `protected route > GET /login does not redirect when unauthenticated` | Status 200; form rendered |
| T4 | e2e | `protected route > GET /invite/[token] does not redirect when unauthenticated` | Status 200 (or 404 if token invalid); not redirected to /login |
| T5 | e2e | `post-login redirect > user redirected to saved destination after login` | After login with ?redirect=%2Ftransactions, user is at /transactions |
| T6 | e2e | `post-login redirect > missing redirect param defaults to /dashboard` | Login without redirect param leads to /dashboard |
| T7 | unit | `redirect validation > external URL rejected` | `https://attacker.com` fails validation; returns false |
| T8 | unit | `redirect validation > relative in-app path accepted` | `/dashboard`, `/income`, `/reports` pass validation |
| T9 | unit | `redirect validation > path traversal with ../ sanitized or rejected` | `../../etc/passwd` fails validation |
| T10 | unit | `redirect validation > URL-encoded path decoded and validated` | `%2Fdashboard` decoded to `/dashboard` and accepted |
| T11 | e2e | `post-login redirect > /login as redirect target redirects to /dashboard instead` | Loop prevention; user lands on /dashboard |
| T12 | integration | `session > expired session redirects to /login on next protected route access` | Middleware checks session validity; invalid session → redirect |

**Red gate:** every test above is written and failing for the right reason (assertion failure or missing module — never a syntax error or a typo in the import path). Commit the failing tests before writing implementation.

### 🟢 GREEN — implementation is done when

- [x] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [x] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [x] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create/modify:**

1. **`middleware.ts`** (Next.js middleware at root) — or use route-group layouts for protection:
   - Check session validity for protected routes.
   - Allow `/login`, `/invite/[token]`, `/api/auth/*` unauthenticated.
   - For unauthenticated access to protected routes, redirect to `/login?redirect=<encoded-path>`.
   - Validate redirect URL before encoding (see below).
2. **`lib/auth/redirectValidation.ts`** — Export `isValidRedirect(url: string): boolean`:
   - Must start with `/` (relative path only).
   - Must not be `http://` or `https://` (no protocol).
   - Must not contain `//` (no protocol or scheme).
   - May not be `/login` (loop prevention).
   - Recommended: maintain an allowlist of valid app routes (dashboard, income, expenses, transactions, reports, categories, settings).
3. **`app/(app)/layout.tsx`** (or similar for protected routes) — If using layouts instead of middleware:
   - Use a wrapper component that checks session at the layout level.
   - If session invalid, redirect to /login.
4. **`components/auth/PostLoginRedirect.tsx`** (client component, if needed) — After login succeeds, read the redirect param and navigate.
5. **`actions/auth/redirectAfterLogin.ts`** — Server Action or helper:
   - Called after login succeeds.
   - Reads `redirect` URL param.
   - Validates it.
   - Redirects via `redirect()` helper or sets a client-side navigation.

**Redirect URL encoding:** Query param encoding is automatic; preserve it during validation. Example: `?redirect=%2Fdashboard` → decode to `/dashboard` → validate → encode and return in location header.

**Middleware vs. layout approach:** Middleware is simpler for global protection; layout groups are more granular. Either works; pick middleware if deploying to a platform with middleware support (Vercel, Netlify, etc.).

## Definition of done

- [x] All ACs met and all RED tests green
- [x] Server-side validation present (client validation alone is never sufficient — §7)
- [x] Every read filters `deletedAt: null` via the repository layer (§6.1) — N/A for this ticket
- [x] Mutation is atomic with its audit entry (NFR-2), if it mutates — N/A for this ticket
- [x] Session asserted via `authedAction` (§8.2), if it is an action — middleware checks session
- [x] No N+1 queries — verified by query count or `include`/`select` inspection — N/A for this ticket
- [x] No unused variables, imports, or dead code
- [x] No secrets, amounts, passwords, or tokens in logs (NFR-8)
- [x] Responsive at 360px, tap targets ≥44px (NFR-3) — N/A for this ticket
- [x] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4) — N/A for this ticket
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
