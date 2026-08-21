# AITJ-M1-04 — Forced password change for the seeded admin account

| Field | Value |
|---|---|
| Milestone | M1 — Auth |
| Depends on | AITJ-M1-01, AITJ-M1-02, AITJ-M1-03 |
| Blocks | AITJ-M1-07, AITJ-M1-08 |
| PRD refs | FR-A5, NFR-10 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

On first boot, if no user exists, an admin account is seeded from the `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` environment variables (FR-A5). This account is marked with `mustChangePassword = true`. The app forces a password change before any other action — all routes except `/login`, `/invite/[token]`, and `/settings/change-password` are blocked until the password is changed. Once the password is changed, the flag is cleared and the user proceeds normally.

## Acceptance criteria

- [x] AC1 — On first boot with no users in the database, `prisma/seed.ts` creates a user with email from `SEED_ADMIN_EMAIL` and password from `SEED_ADMIN_PASSWORD`
- [x] AC2 — Seeded user has `mustChangePassword = true` and `isActive = true`
- [x] AC3 — Seeded user exists in the database after a fresh deployment
- [x] AC4 — On first login with seeded credentials, login succeeds and user is redirected to /settings/change-password
- [x] AC5 — If a user with `mustChangePassword = true` attempts to access /dashboard or /income, they are redirected to /settings/change-password
- [x] AC6 — If a user with `mustChangePassword = true` attempts to access /settings, they are redirected to /settings/change-password
- [x] AC7 — Password change page is accessible with `mustChangePassword = true`
- [x] AC8 — After successful password change, `mustChangePassword` is cleared to false and user is redirected to /dashboard
- [x] AC9 — User can only change password via the forced-change flow (no other form allows it while the flag is set)
- [x] AC10 — Password change during this phase requires the new password but not the current password (seed account has no legitimate "current" password in the user's mind)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Seed env vars missing on first boot | App startup fails with clear error; no partial user created |
| E2 | Seed user email already exists (re-run seed) | Seed script checks; does not duplicate; updates password if needed or logs warning |
| E3 | First login with seeded credentials, password is only 9 chars | Seed fails at startup; cannot seed invalid password |
| E4 | First login with seeded credentials, password is exactly 10 chars | Seed succeeds; login works; password change flow normal |
| E5 | User with `mustChangePassword = true` tries logout | Logout succeeds; session cleared; next login redirects to change-password flow |
| E6 | Two tabs open; first tab completes password change; second tab tries to access /dashboard | Session is updated; second tab detects flag is false; access granted |
| E7 | Password change fails (server error) | Error shown; flag remains true; user stays on change-password page |
| E8 | Middleware check sees `mustChangePassword = true` and session is valid | Redirect to /settings/change-password (not a logout or session kill) |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `seed > creates admin user on first boot` | User with `SEED_ADMIN_EMAIL` exists in DB after seed |
| T2 | integration | `seed > seeded user has mustChangePassword = true` | User record has mustChangePassword flag set |
| T3 | integration | `seed > seeded user is active` | User record has isActive = true |
| T4 | unit | `seed validation > rejects password < 10 chars` | Seed script exits with error if password < 10 chars |
| T5 | unit | `seed validation > accepts password exactly 10 chars` | Seed succeeds with 10-char password |
| T6 | e2e | `forced password change > login with seeded credentials succeeds` | Login form accepts seeded email/password |
| T7 | e2e | `forced password change > post-login redirect to /settings/change-password` | After login, redirected to change-password page |
| T8 | e2e | `forced password change > access /dashboard redirects to /settings/change-password` | GET /dashboard with mustChangePassword=true redirects |
| T9 | e2e | `forced password change > access /settings redirects to /settings/change-password` | GET /settings with mustChangePassword=true redirects |
| T10 | e2e | `forced password change > password change clears flag` | After password change, mustChangePassword=false in session/DB |
| T11 | e2e | `forced password change > access /dashboard succeeds after password change` | GET /dashboard after flag cleared returns 200 and renders page |
| T12 | integration | `forced password change > logout and re-login still requires password change` | Re-login after logout preserves mustChangePassword=true flag |

**Red gate:** every test above is written and failing for the right reason (assertion failure or missing module — never a syntax error or a typo in the import path). Commit the failing tests before writing implementation.

### 🟢 GREEN — implementation is done when

- [x] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [x] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [x] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create/modify:**

1. **`prisma/seed.ts`** — Seeding script:
   - Check if any user exists (SELECT COUNT(*) FROM user > 0).
   - If no users, create admin:
     - Email from `SEED_ADMIN_EMAIL` env var.
     - Password from `SEED_ADMIN_PASSWORD` env var; validate length (10–72 chars).
     - Hash password with bcrypt cost 12.
     - Set `mustChangePassword = true` and `isActive = true`.
   - If seed env vars missing, log error and exit with non-zero code.
2. **`app/(auth)/login/page.tsx`** or **`actions/auth/login.ts`** — Modify login action:
   - On successful login, check session `user.mustChangePassword`.
   - If true, redirect to `/settings/change-password?next=/dashboard` (or similar).
3. **`middleware.ts`** — Add check for mustChangePassword:
   - If session exists and `user.mustChangePassword = true`, redirect to `/settings/change-password`.
   - Exception: allow `/settings/change-password`, `/api/auth/*`, `/login`.
4. **`app/(app)/settings/change-password/page.tsx`** — Forced password change page:
   - Form accepts only new password (not current password).
   - Label: "Set your new password" (not "Change password").
   - Submit calls `changePasswordForcedAction`.
5. **`actions/auth/changePasswordForced.ts`** — Server Action:
   - Assert session.
   - Assert `user.mustChangePassword = true` (safety check).
   - Validate new password (Zod, 10–72 chars).
   - Hash with bcrypt.
   - Update user: set passwordHash and mustChangePassword = false.
   - Write audit log for password change.
   - Redirect to `/dashboard`.

**Env validation:** Check `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` at boot time (in seed.ts and/or in the app startup check). Missing vars should fail loudly.

## Definition of done

- [x] All ACs met and all RED tests green
- [x] Server-side validation present (client validation alone is never sufficient — §7)
- [x] Every read filters `deletedAt: null` via the repository layer (§6.1) — N/A for this ticket (User has no `deletedAt`)
- [x] Mutation is atomic with its audit entry (NFR-2), if it mutates — audit entry written for password change, same `prisma.$transaction` as the write
- [x] Session asserted via `authedAction` (§8.2), if it is an action — changePasswordForcedAction uses authedAction
- [x] No N+1 queries — verified by query count or `include`/`select` inspection — session callback does not query again for mustChangePassword (carried in the JWT from sign-in)
- [x] No unused variables, imports, or dead code
- [x] No secrets, amounts, passwords, or tokens in logs (NFR-8)
- [x] Responsive at 360px, tap targets ≥44px (NFR-3)
- [x] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [x] Reviewed by review-agent → passed to qa-agent → QA signed off

## Review notes

- **review-agent REJECT (round 1)**: `actions/auth/changePasswordForced.ts` called `prisma.$transaction` directly, violating CLAUDE.md's unqualified "no Prisma call outside `lib/repositories/`" rule. Everything else verified clean in the same pass: TDD cycle genuine (RED `e403895` → GREEN `50344ea`, T1-T5/T6 correctly identified as pre-existing carryover, not falsely claimed as new), full suite/e2e/typecheck/lint all independently re-run and clean, `passwordHash` never leaves the repository layer, mutation+audit atomicity verified end-to-end.
- **Fix (round 1)**: added `lib/repositories/user.ts`'s `applyForcedPasswordChange()`, which owns the `prisma.$transaction` — re-reading the safety-check flag, writing the password, and recording the audit entry inside it. The action now only calls this one function and branches on `{ ok }`, never touching `prisma` or `Prisma.TransactionClient` itself (`f3fbfa7`). Full suite re-run clean: 79/79 unit+integration, 12/12 e2e for this ticket, tsc/lint clean.
- **review-agent PASS (round 2)**: confirmed the fix is exactly what was asked and nothing more — no test files touched, TDD chain (RED → GREEN → structural fix) intact. `grep -rn "prisma\." actions/ app/ components/ middleware.ts` excluding `lib/repositories` returns nothing. Independently re-ran typecheck/lint/full suite (79/79)/e2e (12/12) all clean. Confirmed `findUserForForcedPasswordChange` still selects only `{ id, mustChangePassword }` and the audit snapshot carries only the boolean flag transition — data-protection invariant holds after the refactor.
