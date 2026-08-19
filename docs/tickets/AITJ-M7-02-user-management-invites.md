# AITJ-M7-02 — User management, invites and deactivation UI

| Field | Value |
|---|---|
| Milestone | M7 — Settings & admin |
| Depends on | AITJ-M1-05, AITJ-M1-08, AITJ-M7-01 |
| Blocks | none |
| PRD refs | FR-S2, FR-A6, FR-A7, FR-A9, §2, §5.1 FR-A6 to FR-A9, §10 page 8, NFR-3, NFR-4 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

FR-S2 requires a UI to manage users: list all users, invite new ones by email, deactivate users, and reactivate them. The invite creation and deactivation Server Actions were built in AITJ-M1-05 and AITJ-M1-08 respectively. This ticket implements the Users section within the Settings page shell (M7-01), reusing those actions. §2 clarifies that every authenticated user can perform these actions — there is no role hierarchy or admin-only gate. FR-A9 adds constraints: a user cannot deactivate themselves, and the last active account cannot be deactivated.

## Acceptance criteria

- [ ] AC1 — The Users section of Settings is navigable from the shell tab/section layout (M7-01)
- [ ] AC2 — A user list displays all users (active and inactive) with columns: Name, Email, Status (Active/Inactive/Pending invite), and Actions
- [ ] AC3 — Pending invites show the email, expiry date (if applicable), and a Resend button; accepted invites show the user's name; deactivated users show "(Inactive)" next to the name
- [ ] AC4 — An "Invite user" button opens a dialog or form with an Email field; the form is bound to the existing `inviteUser` Server Action from AITJ-M1-05
- [ ] AC5 — On successful invite, a toast confirms "Invite sent to [email]" and the invite row appears in the list with status "Pending"; the form clears
- [ ] AC6 — Existing invites show their expiry date or "Expired" if the 72-hour window has passed; expired invites have no Resend affordance (or Resend is disabled)
- [ ] AC7 — A Resend button on a pending invite re-sends the link (arguably the same token if not yet accepted, or a new token per AITJ-M1-05 spec)
- [ ] AC8 — An "Undo" or "Deactivate" action on active users opens a confirmation dialog; the dialog shows the user's name and warns "This user will not be able to log in. Their name will still appear on past transactions."
- [ ] AC9 — Deactivate is bound to the existing `deactivateUser` Server Action from AITJ-M1-08 and updates the list immediately on success; a toast confirms "User deactivated"
- [ ] AC10 — A "Reactivate" action on inactive users is bound to the existing `reactivateUser` Server Action (must exist per FR-A9) and updates the list; a toast confirms "User reactivated"
- [ ] AC11 — Deactivate button is disabled for the logged-in user with a tooltip "You cannot deactivate yourself"
- [ ] AC12 — Deactivate button is disabled for the last active user with a tooltip "Cannot deactivate the last active account"
- [ ] AC13 — At 360px viewport, the user list collapses into cards with all actions visible; buttons are ≥44px tap targets; text is readable (NFR-3)
- [ ] AC14 — All controls are labelled, keyboard-navigable, with 4.5:1 contrast (NFR-4)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | User tries to invite an email that is already registered | Server returns an error (per AITJ-M1-05); form shows "This email is already in use" |
| E2 | User tries to invite an email with an active pending invite | Server returns an error or allows a resend; per AITJ-M1-05 spec (state the behavior) |
| E3 | User tries to deactivate themselves | The button is disabled; on attempted action (if button somehow fires), server rejects with "Cannot deactivate your own account" |
| E4 | User tries to deactivate the last active user (which may be themselves or another) | The button is disabled; on attempted action, server rejects with "Cannot deactivate the last active account" |
| E5 | Two concurrent deactivation requests for the same user | The first succeeds; the second may error or silently succeed (idempotent). Verify the behavior and state it. The user list eventually shows one deactivated row. |
| E6 | Invite expires (72 hours elapsed) | The row shows "Expired"; Resend button is available or disabled per implementation choice. If clicked, a new 72-hour token is generated. |
| E7 | User list is empty (no invites, no other users) | The page shows a message "No other users yet. Use the Invite button to add committee members." |
| E8 | Inviting a user immediately after they expire a previous invite | A new invite is created with a new token and 72-hour expiry; the old expired row may remain or be replaced. |
| E9 | A deactivated user's name still appears on historical transactions | When viewing transaction details or lists, the deactivated user's name is shown in the "Added by {user}" attribution (FR-T13 / FR-A9). |
| E10 | Very long email or name in the list | Text is truncated or wrapped without breaking the layout; tap targets remain ≥44px |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `settings > users > loads and displays user list` | /settings?tab=users or similar renders a list with columns for Name, Email, Status, Actions |
| T2 | e2e | `settings > users > unauthenticated access redirects to login` | Unauthenticated GET /settings redirects to /login |
| T3 | e2e | `settings > users > invite button opens dialog` | Click "Invite user" button; a dialog opens with Email input and Send button |
| T4 | e2e | `settings > users > invite new user and see in list as pending` | Enter email, submit; toast shows "Invite sent to [email]"; the email appears in the list with status "Pending" and an expiry date |
| T5 | e2e | `settings > users > invite with empty email shows validation error` | Submit without entering email; form shows validation error |
| T6 | e2e | `settings > users > invite with invalid email shows validation error` | Submit "notanemail"; form shows validation error |
| T7 | e2e | `settings > users > invite that already exists shows server error` | Invite a user, then try to invite the same email again; form shows "Email already invited" or similar |
| T8 | e2e | `settings > users > accepted invite shows user name and active status` | Accept an invite (via token flow in separate e2e); return to settings and verify the email now shows the user's name with status "Active" |
| T9 | e2e | `settings > users > deactivate user confirmation dialog shows warning` | Click Deactivate on an active user; dialog opens with the user's name and warning text about historical records |
| T10 | e2e | `settings > users > deactivate user and see status change` | Confirm deactivation; user list updates to show status "Inactive"; a toast appears |
| T11 | e2e | `settings > users > reactivate inactive user` | Click Reactivate on an inactive user; status changes back to "Active"; a toast appears |
| T12 | e2e | `settings > users > deactivate button disabled for logged-in user` | As the logged-in user, verify the Deactivate button is disabled for their own row with tooltip "You cannot deactivate yourself" |
| T13 | e2e | `settings > users > deactivate button disabled for last active user` | Create one active user, then verify the Deactivate button is disabled for that user with tooltip "Cannot deactivate the last active account" |
| T14 | integration | `deactivate > server rejects if user is last active` | Call deactivateUser action with the last active user's ID; the action rejects with a specific error message; database shows user still active |
| T15 | integration | `deactivate > server rejects if user is the actor` | Call deactivateUser action with the logged-in user's own ID; the action rejects; database unchanged |
| T16 | e2e | `settings > users > at 360px user list renders as cards with tap targets ≥44px` | Render at 360px; user list collapses into card layout; measure all buttons; verify ≥44px; no horizontal scroll |
| T17 | e2e | `settings > users > keyboard navigation` | Tab through all controls; all are reachable; Enter submits; Escape closes dialogs; focus ring visible |

**Red gate:** All 17 tests are written, committed with failing assertions, and run to confirm they fail for the right reason.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Files to modify/create:**

1. **Tab/Section:** `app/(app)/settings/page.tsx` or a sub-route `app/(app)/settings/users/page.tsx` — add the Users section to the Settings shell (M7-01).
2. **Components:**
   - `components/settings/UsersSection.tsx` — main container; Server Component fetches user list and invite list, renders the table and Invite button.
   - `components/settings/UserTable.tsx` — displays users (active and inactive) with status badges and action buttons.
   - `components/settings/InviteDialog.tsx` — form to invite a new user; client component bound to `inviteUser` action.
   - `components/settings/DeactivateDialog.tsx` — confirmation dialog with action bound to `deactivateUser`.
3. **Actions to reuse (do NOT reimplement):**
   - `inviteUser` from AITJ-M1-05 (returns the invite with email and expiry).
   - `deactivateUser` from AITJ-M1-08 (checks self and last-active guards server-side).
   - `reactivateUser` from AITJ-M1-08 (or AITJ-M1-05 if defined there).
4. **Validation:** Reuse email schema from `lib/validation/user.ts`.

**Approach:**
- The Users section is a Server Component that fetches all users and invites in a single query (no N+1 — use `include` to get related data).
- Invite and deactivate actions are called from client components; the page does not refresh the entire section on action success — instead, local state and the toast confirm the action, and a brief cache invalidation (e.g., `revalidatePath`) brings data in sync.
- Buttons for deactivate/reactivate are conditionally disabled or hidden based on:
  - Is the user the logged-in user? (cannot deactivate self)
  - Is the user the last active user? (cannot deactivate)
  - Is the user active or inactive? (Deactivate vs Reactivate)
- Invite expirations are calculated client-side based on `createdAt` + 72h.

**Important:** Do not reimplement invite token generation, deactivation checks, or reactivation logic. Call the existing Server Actions only.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation and authorization checks present (self-deactivation, last-active guard) — reused from AITJ-M1-05 and AITJ-M1-08
- [ ] Session asserted in all actions via `authedAction` (§8.2)
- [ ] No N+1 queries — user list with invites fetched in one query with `include` on the Invite relation
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, tokens, or passwords in logs (NFR-8); invite tokens are hashed and never logged in full
- [ ] Responsive at 360px, tap targets ≥44px (NFR-3); table becomes cards on mobile
- [ ] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
