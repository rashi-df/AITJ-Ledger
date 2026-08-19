# AITJ-M1-06 — Accept an invite and set name and password

| Field | Value |
|---|---|
| Milestone | M1 — Auth |
| Depends on | AITJ-M1-05 |
| Blocks | none |
| PRD refs | FR-A7, FR-A10, §6 Invite model, §10 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

An invitee navigates to `/invite/[token]`, which displays a form to set their name and password. The token is validated, checked for expiry and single-use (must not have `acceptedAt` already set), and matched against the stored hash in constant time. On successful submission, a new user is created with the provided name and password, the invite is marked as accepted with a timestamp, and the user is logged in and redirected to `/dashboard`.

## Acceptance criteria

- [ ] AC1 — GET /invite/[token] displays a form with name, password, and confirm-password fields
- [ ] AC2 — Token is looked up by comparing against the stored hash in constant time
- [ ] AC3 — Expired token (expiresAt < now) returns a 404 or "link expired" error
- [ ] AC4 — Token that has already been accepted (acceptedAt IS NOT NULL) returns "link already used" error
- [ ] AC5 — Valid token displays the email from the invite record (read-only) and name/password inputs
- [ ] AC6 — Form validates: name (1–255 chars, trimmed), password (10–72 chars), password confirmation matches
- [ ] AC7 — On successful submission, a new user is created with the provided name, email from the invite, and hashed password
- [ ] AC8 — New user has `isActive = true` and `mustChangePassword = false`
- [ ] AC9 — Invite record is marked `acceptedAt = now`
- [ ] AC10 — User is immediately logged in (session created) and redirected to /dashboard
- [ ] AC11 — Invite token cannot be reused after acceptance

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Token is malformed or does not exist in DB | "Invalid or expired link" generic error |
| E2 | Token expired exactly 72 hours ago (within 1 second) | "Link expired" error |
| E3 | Token already accepted, attempt to use again | "Link already used" error |
| E4 | Name field empty | Validation error shown; user not created |
| E5 | Name field 255 chars (max) | Accepted and user created |
| E6 | Name field 256 chars (over max) | Validation error shown |
| E7 | Password and confirm-password do not match | Validation error; user not created |
| E8 | Password exactly 10 chars (minimum) | Accepted; user created; password hashed with bcrypt |
| E9 | Password exactly 72 chars (maximum) | Accepted; user created |
| E10 | Password exactly 9 chars or 73 chars | Validation error; user not created |
| E11 | Multiple concurrent requests to accept the same invite token | One succeeds; second sees `acceptedAt` already set and is rejected |
| E12 | Invitee email domain is unusual (e.g. user+tag@domain.co.uk) | Email from invite is used as-is; user created with that email |
| E13 | Server error during user creation (DB failure) | Transaction rolls back; invite.acceptedAt remains null; user can retry |
| E14 | User navigates to invite link after session is created | Already logged in; redirect to /dashboard (or show "you already accepted" message) |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `invite accept > form renders with email read-only` | Email field displayed; name/password inputs present |
| T2 | e2e | `invite accept > valid token creates user and logs in` | POST succeeds; user created in DB; session established; redirected to /dashboard |
| T3 | integration | `invite token validation > token hash compared in constant time` | Hash comparison uses constant-time algorithm (not string equality) |
| T4 | integration | `invite expiry > expired token (72h+1s) rejected` | expiresAt check prevents acceptance |
| T5 | integration | `invite single-use > already-accepted token rejected on re-use` | acceptedAt IS NOT NULL check rejects second attempt |
| T6 | e2e | `invite accept > password and confirm must match` | Form validation error if mismatched; user not created |
| T7 | integration | `invite accept > new user created with provided name and email` | User record has correct name and email from invite |
| T8 | integration | `invite accept > password hashed with bcrypt` | User passwordHash is a valid bcrypt hash |
| T9 | integration | `invite accept > isActive = true, mustChangePassword = false` | User flags set correctly |
| T10 | integration | `invite accept > invite marked acceptedAt = now` | Invite record updated with acceptance timestamp |
| T11 | e2e | `invite accept > user logged in and at /dashboard after accept` | Session cookie set; navigated to /dashboard |
| T12 | integration | `invite accept > password < 10 chars rejected` | 9-char password fails validation |
| T13 | integration | `invite accept > password > 72 chars rejected` | 73-char password fails validation |
| T14 | unit | `invite token validation > non-existent token returns generic error` | "Invalid or expired link" (not "token not found") |

**Red gate:** every test above is written and failing for the right reason (assertion failure or missing module — never a syntax error or a typo in the import path). Commit the failing tests before writing implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create/modify:**

1. **`app/(auth)/invite/[token]/page.tsx`** — Server Component:
   - Receives token from URL params.
   - Calls a function to fetch the invite (or passes token to a client component that does).
   - Renders the form with email read-only.
   - If token invalid/expired/accepted, renders error message.
2. **`components/auth/InviteAcceptForm.tsx`** — Client Component:
   - Name input (1–255 chars, trimmed).
   - Password input (10–72 chars).
   - Confirm password input.
   - Client-side Zod validation; server re-validates.
   - On submit, calls `acceptInviteAction`.
3. **`actions/invite/acceptInvite.ts`** — Server Action `acceptInviteAction`:
   - Receives token (raw, from the URL).
   - Parses and validates name, password, confirmPassword with Zod.
   - Hash token via the same function as creation.
   - Look up invite by tokenHash using constant-time comparison.
   - Check expiresAt < now → error.
   - Check acceptedAt IS NOT NULL → error.
   - In a transaction:
     - Create user with email from invite, provided name, hashed password. Set isActive=true, mustChangePassword=false.
     - Update invite: set acceptedAt = now.
   - On success, call `signIn("credentials", ...)` to create session automatically.
   - Redirect to /dashboard.
4. **`repositories/inviteRepository.ts`** — Add methods:
   - `findInviteByTokenHash(hash: string): Promise<Invite | null>` — uses constant-time comparison or relies on DB's indexed lookup (hash is unique).
   - `acceptInvite(inviteId: string): Promise<void>` — sets acceptedAt.
5. **`repositories/userRepository.ts`** — Add method:
   - `createUser(email: string, name: string, passwordHash: string, isActive?: boolean, mustChangePassword?: boolean): Promise<User>`.
6. **`lib/validation/invite.ts`** — Add schema `acceptInviteSchema`:
   - `name`: 1–255 chars, trimmed.
   - `password`: 10–72 chars.
   - `confirmPassword`: must match password.

**Constant-time token comparison:** The tokenHash is stored in the database and is indexed, so the lookup is efficient. The comparison itself: if using a hash like SHA-256, the lookup is `WHERE tokenHash = ?` with parameterized query (safe from injection). For an extra layer of safety, you can use `crypto.timingSafeEqual()` in Node.js on the client-supplied token vs. the stored hash, but this is not required if the hash comparison is done at the DB level. Recommended: let the DB do the lookup; timingSafeEqual is a defense-in-depth for a hypothetical timing attack on the hash comparison, which is lower risk than the lookup itself.

**Transaction atomicity:** Create user and mark invite accepted in the same Prisma transaction. If user creation fails, the transaction rolls back and the invite remains unused.

**Login after acceptance:** After transaction commits, call `signIn("credentials", email, password)` or use Auth.js's session creation directly. The latter is simpler; the user is already known to be valid.

**Error messages:** All errors should be generic to avoid leaking information. "Invalid or expired link" covers: token not found, expired, already used, or malformed.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present (client validation alone is never sufficient — §7)
- [ ] Every read filters `deletedAt: null` via the repository layer (§6.1) — Invite and User are not soft-deleted; OK
- [ ] Mutation is atomic with its audit entry (NFR-2), if it mutates — user creation and invite acceptance in same transaction; audit entry optional for invite (defer if low priority)
- [ ] Session asserted via `authedAction` (§8.2), if it is an action — acceptInviteAction does not require session (unauthenticated flow)
- [ ] No N+1 queries — verified by query count or `include`/`select` inspection — one invite lookup, one user creation
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts, passwords, or tokens in logs (NFR-8) — raw token never logged; only "invite accepted for email X"
- [ ] Responsive at 360px, tap targets ≥44px (NFR-3)
- [ ] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
