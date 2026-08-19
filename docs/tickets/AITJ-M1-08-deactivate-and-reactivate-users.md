# AITJ-M1-08 — Deactivate and reactivate users with safety guards

| Field | Value |
|---|---|
| Milestone | M1 — Auth |
| Depends on | AITJ-M1-01, AITJ-M1-07 |
| Blocks | none |
| PRD refs | FR-A9, §2, §5.7 FR-S2 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

A user can deactivate another user from `/settings/users`, blocking their login and preventing future actions. Deactivated users remain in the database with their historical transaction attribution intact (FR-A9). Two safety guards prevent accidents: a user cannot deactivate themselves, and the last active account in the system cannot be deactivated (to avoid locking everyone out). Deactivated users can be reactivated from the same management page. A deactivated user with a still-valid JWT token is blocked on the next request by a session callback that re-checks the `isActive` flag.

## Acceptance criteria

- [ ] AC1 — GET /settings/users shows a list of all users with their status (Active/Deactivated)
- [ ] AC2 — Each active user has a Deactivate action; each deactivated user has a Reactivate action
- [ ] AC3 — Deactivate action shows a confirmation dialog: "Deactivate {name}? They will not be able to log in."
- [ ] AC4 — Deactivate button is disabled if the user is the only active account remaining
- [ ] AC5 — Deactivate button is disabled if the user is trying to deactivate themselves
- [ ] AC6 — On successful deactivation, user.isActive is set to false; user cannot log in
- [ ] AC7 — Deactivated user's name appears unchanged on historical transactions (soft deactivation)
- [ ] AC8 — Reactivate action on a deactivated user sets isActive back to true
- [ ] AC9 — A deactivated user with a still-valid JWT attempts a protected route → session callback detects isActive=false → user is logged out and redirected to /login
- [ ] AC10 — Deactivation and reactivation are logged in the audit trail

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | User attempts to deactivate themselves | Button disabled; error if attempted via API |
| E2 | Two active users; attempt to deactivate the last one | Button disabled or confirmation shows warning "This is the last active account" |
| E3 | Deactivate a user, then attempt to deactivate the other user | First deactivation succeeds; second deactivation's button is now disabled (only one active remains) |
| E4 | Deactivated user with valid JWT in cookie; requests /dashboard | Middleware/session callback checks isActive; redirects to /login and clears cookie |
| E5 | Deactivated user's name appears on a transaction from when they were active | Transaction shows their name unchanged; deactivation does not retroactively affect history |
| E6 | Reactivate a deactivated user, then login with that user's email/password | Login succeeds; user is active again |
| E7 | Concurrent deactivation requests on the same user | First succeeds; second sees isActive already false; both return success (idempotent) or second returns "already deactivated" |
| E8 | Admin deactivates user A; user A attempts login simultaneously | User A's login fails or succeeds and is immediately logged out on next request (depend on timing) |
| E9 | Only one user in the system (the seeded admin); attempt to deactivate | Button disabled; admin cannot deactivate themselves anyway; system cannot be locked out |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `user management > users list displayed on /settings/users` | Table/list shows users with status Active/Deactivated |
| T2 | e2e | `deactivate > confirmation dialog shown before deactivating` | Dialog displays user name and warning message |
| T3 | integration | `deactivate > sets isActive = false` | User record updated; isActive flag false |
| T4 | integration | `deactivate > user cannot login after deactivation` | Login with email/password of deactivated user fails with generic error |
| T5 | integration | `deactivate > self-deactivation prevented` | Attempt to deactivate own user returns error |
| T6 | integration | `deactivate > last active account protected` | With only one active user, deactivation attempt blocked with error |
| T7 | e2e | `deactivate > deactivate button disabled when user is only active account` | Button visually disabled; not clickable |
| T8 | integration | `session > deactivated user with valid JWT redirected to /login` | Session callback detects isActive=false; clears cookie; redirects |
| T9 | e2e | `reactivate > button available for deactivated users` | Reactivate action shown on deactivated user row |
| T10 | integration | `reactivate > sets isActive = true` | User record updated; isActive flag true |
| T11 | e2e | `reactivate > reactivated user can login again` | After reactivation, login succeeds |
| T12 | integration | `audit > deactivation logged as UPDATE action` | AuditLog entry created with action UPDATE, before/after showing isActive change |
| T13 | integration | `audit > reactivation logged as UPDATE action` | AuditLog entry created for reactivation |
| T14 | integration | `transactions > deactivated user's name preserved on historical transactions` | Transaction.createdBy reference shows user name even after deactivation |

**Red gate:** every test above is written and failing for the right reason (assertion failure or missing module — never a syntax error or a typo in the import path). Commit the failing tests before writing implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create/modify:**

1. **`app/(app)/settings/users/page.tsx`** — User management page:
   - Fetch all users and their counts of associated transactions (for display).
   - List users: name, email, status (Active/Deactivated), last login timestamp (optional).
   - Actions: Deactivate (for active users), Reactivate (for deactivated users).
   - Disable deactivate button if user is self or if user is the last active account.
2. **`components/settings/UserListTable.tsx`** — Display users:
   - Table or card list showing users.
   - Status badge: "Active" or "Deactivated".
   - Action buttons with conditional disable logic.
3. **`components/settings/DeactivateUserDialog.tsx`** — Confirmation dialog:
   - Shows user name and warning.
   - Cancel and Deactivate buttons.
   - On Deactivate, calls `deactivateUserAction`.
4. **`components/settings/ReactivateUserButton.tsx`** — Simple button:
   - Calls `reactivateUserAction` on click.
   - Optional confirmation.
5. **`actions/user/deactivateUser.ts`** — Server Action `deactivateUserAction`:
   - Assert session.
   - Receive targetUserId (user to deactivate).
   - Check targetUserId != session.user.id (self-protection).
   - Check COUNT(active users) > 1 (last-active protection).
   - In a transaction:
     - Update user: set isActive = false.
     - Write audit entry (USER entity, UPDATE action, before/after showing isActive change).
   - Return success.
6. **`actions/user/reactivateUser.ts`** — Server Action `reactivateUserAction`:
   - Assert session.
   - Receive targetUserId.
   - In a transaction:
     - Update user: set isActive = true.
     - Write audit entry.
   - Return success.
7. **`lib/auth/config.ts`** — Modify session callback:
   - After reading JWT token, check user.isActive in the database (or cache in JWT and trust it, but re-check on every request for security).
   - If isActive = false, reject session and trigger logout.
   - Return `null` to reject session (Auth.js will handle the redirect).
8. **`repositories/userRepository.ts`** — Add methods:
   - `countActiveUsers(): Promise<number>` — returns count of users with isActive = true.
   - `deactivateUser(userId: string): Promise<void>` — sets isActive = false.
   - `reactivateUser(userId: string): Promise<void>` — sets isActive = true.
   - `findAll(): Promise<User[]>` — all users (for listing).

**Last active account protection:** Before deactivating, query `SELECT COUNT(*) FROM user WHERE isActive = true`. If count = 1 (the target user), reject. This prevents a scenario where the only person with access gets locked out.

**Session callback re-check:** On each request, the session callback should verify the user is still active. Options:
- (a) Fetch user from DB on every request (expensive but most secure).
- (b) Store isActive in JWT and trust it (risky if deactivation is concurrent with a request).
- (c) Hybrid: store isActive in JWT; re-check DB on access to sensitive routes (compromise).
For v1, recommend (a) with caching: fetch user once per session; cache in memory with a short TTL (5 min). Or simpler: just fetch on every request; indexed by ID, should be fast.

**Audit entry:** For deactivation/reactivation, record before/after JSON with only the isActive field change. Example:
```json
{
  "before": { "isActive": true },
  "after": { "isActive": false }
}
```

**UI disable logic:** Disable deactivate button if:
- User is the logged-in user (self).
- User is the only active account.
Show a tooltip explaining why if disabled.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present (client validation alone is never sufficient — §7)
- [ ] Every read filters `deletedAt: null` via the repository layer (§6.1) — User is not soft-deleted; isActive flag handles deactivation
- [ ] Mutation is atomic with its audit entry (NFR-2), if it mutates — deactivate/reactivate and audit entry in same transaction
- [ ] Session asserted via `authedAction` (§8.2), if it is an action — deactivateUserAction and reactivateUserAction use authedAction
- [ ] No N+1 queries — verified by query count or `include`/`select` inspection — single user lookup per action; countActiveUsers is a single aggregation query
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts, passwords, or tokens in logs (NFR-8) — audit entry contains no sensitive data
- [ ] Responsive at 360px, tap targets ≥44px (NFR-3)
- [ ] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
