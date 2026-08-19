# AITJ-M1-05 — Generate and manage user invites

| Field | Value |
|---|---|
| Milestone | M1 — Auth |
| Depends on | AITJ-M1-01, AITJ-M0-03 |
| Blocks | AITJ-M1-06 |
| PRD refs | FR-A6, §6 Invite model |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

A user can invite another by email. The system generates a single-use, time-limited invite token (valid 72 hours) delivered as a copyable link (email delivery is optional in v1 and not required). The invite is stored in the `Invite` model with a hashed token, expiry timestamp, and the inviter's user ID. Email delivery mechanics are deferred; the link is simply displayed to the user to copy and send manually.

## Acceptance criteria

- [ ] AC1 — Authenticated user can generate an invite for a new email via a form at /settings
- [ ] AC2 — Invite form validates email (required, valid format, not already registered as a user)
- [ ] AC3 — Successful invite creation generates a cryptographically secure random token (20+ bytes of entropy)
- [ ] AC4 — Token is hashed before storage; raw token never stored in the database
- [ ] AC5 — Invite record stores: hashed token, email, expiry (72 hours from now), inviter ID, creation timestamp
- [ ] AC6 — Invite link is displayed to the inviter as a copyable URL (e.g., `/invite/[token]`)
- [ ] AC7 — Invite expires 72 hours after creation; expired invites are rejected on use
- [ ] AC8 — An invite cannot be created for an email that already has an active user account
- [ ] AC9 — An invite can be created for a deactivated user's email (reactivation via re-invite)
- [ ] AC10 — Invites are listed in /settings/users; expired invites are shown as expired; accepted invites show the acceptance date

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Invite for email of an existing active user | Form validation rejects with "This email already has an account" |
| E2 | Invite for email of a deactivated user | Invite created; email shows both "deactivated" and "pending invite" states |
| E3 | Invite token exactly at 72-hour expiry boundary (within 1 second) | Token still accepted; just after boundary, rejected |
| E4 | Invite for an email that has a pending invite already | Reject with "An invite already pending for this email" or allow new invite (invalidating the old one) — spec this decision |
| E5 | Email submitted in mixed case (Test@Example.COM) | Normalized to lowercase; lookup checks lowercase |
| E6 | Token is 20 bytes (160 bits of entropy) | Sufficient; hashed and stored correctly |
| E7 | Inviter's account is deactivated before invitee accepts | Invite remains valid; invitee can still accept |
| E8 | Inviter's account is deleted (impossible per FR-A9 — users are never deleted, only deactivated) | N/A |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `invite > form renders at /settings/users` | Email input, submit button visible |
| T2 | e2e | `invite > valid email creates invite record` | Invite stored in DB with hashed token |
| T3 | e2e | `invite > invite link displayed to inviter` | Copy-able link shown with /invite/[token] format |
| T4 | integration | `invite token > token is hashed before storage` | Raw token not in DB; only tokenHash present |
| T5 | integration | `invite token > token has 20+ bytes entropy` | crypto.randomBytes(20) or equivalent used |
| T6 | integration | `invite expiry > 72-hour expiry timestamp set` | expiresAt = now + 72 hours |
| T7 | integration | `invite validation > existing active user rejected` | Create user; invite for same email returns error |
| T8 | integration | `invite validation > deactivated user allowed` | Deactivate user; create invite for same email succeeds |
| T9 | e2e | `invite list > pending invites shown in /settings/users` | Invite row shows email, expiry time, status "pending" |
| T10 | integration | `invite expiry > expired invite (72h+1s old) rejected on use` | Attempt to accept invite fails with "expired" error |
| T11 | integration | `invite > email normalized to lowercase` | Invite for Test@Example.COM stored and searched as test@example.com |
| T12 | unit | `invite email validation > rejects non-email format` | "notanemail" rejected by Zod |

**Red gate:** every test above is written and failing for the right reason (assertion failure or missing module — never a syntax error or a typo in the import path). Commit the failing tests before writing implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create/modify:**

1. **`lib/validation/invite.ts`** — Zod schema `inviteEmailSchema`:
   - Email: required, valid format, lowercase, ≤255 chars.
2. **`lib/auth/token.ts`** — Token generation and hashing:
   - `generateInviteToken(): string` — 20 bytes from crypto.randomBytes, base64url-encoded.
   - `hashToken(token: string): string` — SHA-256 hash or bcrypt (prefer SHA-256 for speed).
3. **`repositories/inviteRepository.ts`** — Data access layer:
   - `createInvite(email: string, hashedToken: string, expiresAt: Date, invitedById: string): Promise<Invite>` — creates record.
   - `findInviteByTokenHash(tokenHash: string): Promise<Invite | null>` — looks up by hash.
   - `findInviteByEmail(email: string): Promise<Invite | null>` — finds pending (not accepted) invite.
   - `findInvitesByInviter(userId: string): Promise<Invite[]>` — lists invites sent by a user.
   - `markInviteAccepted(inviteId: string, acceptedAt: Date): Promise<void>` — sets acceptedAt.
4. **`actions/invite/createInvite.ts`** — Server Action `createInviteAction`:
   - Assert session.
   - Parse email with Zod.
   - Check email not already a user: `userRepository.findByEmail(email)` and user.isActive.
   - Check no pending invite for email: `inviteRepository.findInviteByEmail(email)`.
   - Generate token, hash it, compute 72h expiry.
   - Insert invite via repository.
   - Return raw token (only this once; never returned again).
5. **`components/invite/CreateInviteForm.tsx`** — Client component:
   - Email input, submit button.
   - Client-side Zod validation (with server-side re-validation in action).
   - On success, display copyable link with the raw token.
   - Show success toast.
6. **`app/(app)/settings/users/page.tsx`** — User management page:
   - List users: name, email, isActive, last login (optional).
   - List pending invites: email, created date, expiry countdown, actions (resend/cancel).
   - Show deactivated users with a "Deactivated" badge.
7. **`app/(app)/settings/users/invites-section.tsx`** — Invite management section:
   - Display pending invites.
   - Show expiry time (countdown or absolute "expires at").
   - Option to copy link again (regenerate or just re-show the original).

**Token generation:** Use `crypto.randomBytes(20)` in Node.js; base64url-encode for URL safety.

**Hash function:** SHA-256 for speed and to avoid the cost of bcrypt on every token lookup. `crypto.createHash('sha256').update(token).digest('hex')`.

**Email normalization:** Store and search by `email.toLowerCase()`.

**Open question:** If an email already has a pending invite, should a second invite for that email:
- (a) Reject with "invite already pending"?
- (b) Invalidate the old invite and create a new one?
For v1, recommend (a) to avoid confusion; spec this before writing.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present (client validation alone is never sufficient — §7)
- [ ] Every read filters `deletedAt: null` via the repository layer (§6.1) — Invite model has no soft delete; OK
- [ ] Mutation is atomic with its audit entry (NFR-2), if it mutates — invite creation writes audit entry if needed (optional for v1; defer to M7 if audit on invite is low priority)
- [ ] Session asserted via `authedAction` (§8.2), if it is an action — createInviteAction uses authedAction
- [ ] No N+1 queries — verified by query count or `include`/`select` inspection — single user/invite lookup per action
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts, passwords, or tokens in logs (NFR-8) — raw token never logged; only confirm "invite created for email X"
- [ ] Responsive at 360px, tap targets ≥44px (NFR-3)
- [ ] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
