# AITJ-M1-07 — Profile edit and self-service password change

| Field | Value |
|---|---|
| Milestone | M1 — Auth |
| Depends on | AITJ-M1-01, AITJ-M1-04 |
| Blocks | none |
| PRD refs | FR-A8, FR-A10, §10 (Settings page), §5.7 FR-S1 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

A user can edit their own name and change their own password from `/settings` (FR-S1). Name edit is a simple form submission. Password change requires the current password to be entered and verified before the new password is set (FR-A8). On success, the new password is hashed and stored; the user remains logged in (session is not invalidated by a password change).

## Acceptance criteria

- [ ] AC1 — GET /settings shows the current user's name and email (read-only)
- [ ] AC2 — Name can be edited; form validates name (1–255 chars, trimmed)
- [ ] AC3 — Name change is saved immediately; user sees success toast
- [ ] AC4 — Password change form requires current password, new password, and confirmation
- [ ] AC5 — New password must differ from current password (or allow sameness, spec this)
- [ ] AC6 — New password and confirmation must match
- [ ] AC7 — New password is validated (10–72 chars); confirmation matches
- [ ] AC8 — Current password is verified before new password is set
- [ ] AC9 — If current password is wrong, form shows "Current password is incorrect" error
- [ ] AC10 — On successful password change, new password is hashed and stored
- [ ] AC11 — User remains logged in after password change (session not invalidated)
- [ ] AC12 — Password change is logged (audit entry) without storing the password itself

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Current password field left empty | Validation error; password not changed |
| E2 | Current password incorrect (typo) | Error "Current password is incorrect"; new password not set |
| E3 | New password same as current password | Allowed (or disallowed per spec); if allowed, hash differs due to bcrypt salt |
| E4 | New password exactly 10 chars | Accepted; user password changed |
| E5 | New password exactly 72 chars | Accepted; user password changed |
| E6 | New password exactly 9 or 73 chars | Validation error; password not changed |
| E7 | New password and confirmation do not match | Validation error; password not changed |
| E8 | User has `mustChangePassword = true` | User is on the forced-change flow; normal password change form not shown; use AITJ-M1-04's action instead |
| E9 | User is deactivated; tries to change password | Session should not allow access to /settings (redirected to /login by middleware) |
| E10 | Name change while password change in flight (concurrency) | Both complete successfully; last write wins (or use transactions for serialization) |
| E11 | Password change, then user is deactivated, then user tries to login | Login fails; user is inactive |
| E12 | Password contains multi-byte UTF-8 (e.g. "Müller@12345") | Hashed correctly; bcrypt truncation at 72 bytes handled |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `settings > name and email displayed` | Current values shown on /settings |
| T2 | e2e | `settings > name can be edited and saved` | Edit name, submit, success toast shown, name updated in DB |
| T3 | e2e | `settings > password change form displayed` | Current password, new password, confirmation fields present |
| T4 | integration | `password change > current password verified before new password set` | Attempt with wrong current password fails; password not changed |
| T5 | integration | `password change > new password hashed and stored` | New password hash differs from old; login with new password succeeds |
| T6 | e2e | `password change > new and confirmation must match` | Mismatch shows validation error; password not changed |
| T7 | e2e | `password change > session not invalidated after password change` | User remains logged in; no redirect to /login |
| T8 | integration | `password change > new password < 10 chars rejected` | 9-char password fails validation |
| T9 | integration | `password change > new password > 72 chars rejected` | 73-char password fails validation |
| T10 | integration | `password change > audit entry written with action UPDATE` | AuditLog record created for user password change |
| T11 | integration | `password change > audit entry does not contain old or new password` | before/after JSON does not include passwords |
| T12 | e2e | `settings > name change with 1–255 chars succeeds` | Boundary: 1 char, 255 chars, both work |
| T13 | e2e | `settings > name change with 256 chars rejected` | Validation error shown |

**Red gate:** every test above is written and failing for the right reason (assertion failure or missing module — never a syntax error or a typo in the import path). Commit the failing tests before writing implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create/modify:**

1. **`app/(app)/settings/page.tsx`** — Server Component:
   - Fetches current user info via session.
   - Renders name edit section and password change section.
   - Separates the two forms or keeps them on the same page (recommend separate for clarity).
2. **`components/settings/EditNameForm.tsx`** — Client Component:
   - Name input (1–255 chars).
   - Submit button.
   - On submit, calls `updateNameAction`.
3. **`components/settings/ChangePasswordForm.tsx`** — Client Component:
   - Current password input.
   - New password input.
   - Confirm password input.
   - Client-side Zod validation; server re-validates.
   - On submit, calls `changePasswordAction`.
4. **`actions/user/updateName.ts`** — Server Action `updateNameAction`:
   - Assert session.
   - Parse name with Zod (1–255 chars, trimmed).
   - Update user: set name.
   - Write audit entry (USER entity, UPDATE action).
   - Return success.
5. **`actions/user/changePassword.ts`** — Server Action `changePasswordAction`:
   - Assert session.
   - Parse currentPassword, newPassword, confirmPassword with Zod.
   - Verify currentPassword via `verifyPassword(currentPassword, user.passwordHash)`.
   - If fails, return error "Current password is incorrect".
   - Check newPassword != currentPassword (optional per spec; if required, add check here).
   - Validate newPassword (10–72 chars), confirmPassword matches.
   - In a transaction:
     - Hash newPassword with bcrypt.
     - Update user: set passwordHash.
     - Write audit entry (USER entity, UPDATE action).
   - Return success.
6. **`lib/validation/user.ts`** — Zod schemas:
   - `nameSchema`: 1–255 chars, trimmed.
   - `changePasswordSchema`: currentPassword (any string), newPassword (10–72), confirmPassword (must match).
7. **`repositories/userRepository.ts`** — Add methods:
   - `updateUser(userId: string, updates: Partial<User>): Promise<User>` — updates name, passwordHash, etc.
   - Or simpler: `updateName(userId: string, name: string): Promise<void>` and `updatePassword(userId: string, passwordHash: string): Promise<void>`.

**Audit logging:** For password change, the audit entry should record action="UPDATE" on User entity, with before/after showing only `{ name: "...", isActive: true }` (no password field). Never include passwordHash in before/after JSON.

**Session handling:** After password change, user remains in the session. The old session JWT is still valid (it doesn't know about the password change). This is acceptable: the password change is a security upgrade, and forcing a re-login would be annoying. If you want to force a re-login (paranoid approach), call `signOut()` and redirect to /login, but this is not required by the PRD.

**Open question:** Should a user be prevented from setting the new password to the same value as the current password? For UX simplicity, allow it (the user might be copy-pasting and not notice). If security policy requires a unique password, add a check and error message "New password must be different from current password".

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present (client validation alone is never sufficient — §7)
- [ ] Every read filters `deletedAt: null` via the repository layer (§6.1) — User is not soft-deleted; OK
- [ ] Mutation is atomic with its audit entry (NFR-2), if it mutates — user update and audit entry in same transaction
- [ ] Session asserted via `authedAction` (§8.2), if it is an action — updateNameAction and changePasswordAction use authedAction
- [ ] No N+1 queries — verified by query count or `include`/`select` inspection — single user lookup per action
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts, passwords, or tokens in logs (NFR-8) — no password in logs; audit entry without hash
- [ ] Responsive at 360px, tap targets ≥44px (NFR-3)
- [ ] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
