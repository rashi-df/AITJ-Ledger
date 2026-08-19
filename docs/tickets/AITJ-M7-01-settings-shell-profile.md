# AITJ-M7-01 — Settings shell with profile and password sections

| Field | Value |
|---|---|
| Milestone | M7 — Settings & admin |
| Depends on | AITJ-M1-07, none |
| Blocks | none |
| PRD refs | FR-S1, §10 page 8, §5.1 FR-A8, NFR-3, NFR-4 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

FR-S1 requires that a user can view and edit their own name and change their own password. The password change and profile update Server Actions were built in AITJ-M1-07. This ticket implements the Settings page as a tabbed or sectioned UI shell that surfaces those existing actions without reimplementing them. The page is the authoritative entry point for all settings, including user management (M7-02), deleted-transaction restore (M7-03), masjid name (M7-04), and audit viewer (M7-05).

## Acceptance criteria

- [ ] AC1 — The `/settings` route exists and is protected by session middleware (FR-A2); unauthenticated access redirects to `/login`
- [ ] AC2 — The page renders a tabbed or sectioned layout with at least Profile and Password sections visible, and placeholder stubs for Users, Deleted Transactions, Masjid Name, and Audit Log sections (those tabs/sections are implemented in separate tickets but must be navigable from this shell)
- [ ] AC3 — The Profile section displays the logged-in user's current name and an Edit button that opens a form to change it; the form is bound to the existing `updateUserProfile` Server Action from AITJ-M1-07
- [ ] AC4 — The Password section contains a form with Current Password, New Password, and Confirm Password fields; the form is bound to the existing `changePassword` Server Action from AITJ-M1-07
- [ ] AC5 — Both forms include client-side validation (convenience only); server-side validation is enforced by the reused actions
- [ ] AC6 — On successful profile update, a toast confirms "Profile updated" and the page reflects the new name immediately
- [ ] AC7 — On successful password change, a toast confirms "Password changed" and the form clears
- [ ] AC8 — Error states from the Server Actions (e.g., incorrect current password, name too short) are displayed as form validation errors with the action's error message
- [ ] AC9 — At 360px viewport, all form controls and buttons are tap targets ≥44px; text is readable without horizontal scroll (NFR-3)
- [ ] AC10 — All form controls are labelled, keyboard-navigable (Tab, Enter, Escape), with 4.5:1 contrast (NFR-4)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | User's name contains leading/trailing whitespace | Input is trimmed server-side; the page reflects the trimmed value |
| E2 | Profile name field left empty and submitted | Server-side validation rejects it; form shows "Name is required" or similar |
| E3 | New password same as old password | Server-side validation may accept or reject depending on AITJ-M1-07 spec; if rejected, form shows the reason |
| E4 | Current password incorrect | Server-side validation rejects with generic "Incorrect password"; form shows the error |
| E5 | Session expires while editing | On submit, the user is redirected to `/login` with their intended destination preserved (FR-A2) |
| E6 | User name changes via concurrent edit (e.g. by another admin via API, unlikely in v1) | The next page refresh shows the latest name; no merge conflict |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `settings > loads and shows profile and password sections` | /settings renders Profile and Password tabs/sections; placeholder sections are visible for Users, Deleted Transactions, Masjid Name, Audit Log |
| T2 | e2e | `settings > unauthenticated access redirects to login` | Unauthenticated GET /settings redirects to /login?callbackUrl=/settings |
| T3 | e2e | `settings > profile > displays current user name` | The current user's name is visible in the Profile section |
| T4 | e2e | `settings > profile > edit name and see it reflected on page` | Enter a new name in the profile form, submit, and the page name updates without a reload; a success toast appears |
| T5 | e2e | `settings > profile > empty name rejected with error message` | Submit an empty name; the form shows a validation error; the page does not navigate away |
| T6 | e2e | `settings > profile > whitespace-only name rejected` | Submit a name with only spaces; the form shows a validation error |
| T7 | e2e | `settings > password > change password and empty form on success` | Enter correct current password and a new password, submit; form clears and a success toast appears |
| T8 | e2e | `settings > password > incorrect current password rejected` | Enter an incorrect current password; the form shows a validation error |
| T9 | e2e | `settings > password > new password must meet length requirement` | Enter a new password shorter than 10 characters; the form shows a validation error |
| T10 | e2e | `settings > password > new password and confirm password must match` | Enter mismatched passwords; the form shows "Passwords do not match" or similar |
| T11 | e2e | `settings > at 360px all buttons are ≥44px with usable spacing` | Render at 360px; measure all form buttons and inputs; all ≥44px; no horizontal scroll |
| T12 | e2e | `settings > keyboard navigation and focus ring visible` | Tab through all controls; focus ring is visible on every input; Enter submits forms; Escape closes any dialogs |

**Red gate:** All 12 tests are written, committed with failing assertions (e.g., "button not found", "element does not exist"), and run to confirm they fail for the right reason. No implementation yet.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Files to modify/create:**

1. **Route:** `app/(app)/settings/page.tsx` — Server Component that fetches the logged-in user and renders the Settings shell.
2. **Layout/navigation:** `app/(app)/settings/layout.tsx` or tabs/sections within the page — structure the tabbed or sectioned layout with placeholder sections for M7-02, M7-03, M7-04, M7-05.
3. **Components:** 
   - `components/settings/ProfileSection.tsx` — form component that renders the current name and a form bound to the `updateUserProfile` action (from AITJ-M1-07).
   - `components/settings/PasswordSection.tsx` — form component bound to the `changePassword` action (from AITJ-M1-07).
4. **Validation:** Reuse schemas from `lib/validation/user.ts` (already defined in M1).

**Approach:**
- The page is a Server Component that fetches the session and current user data.
- Both sections are client components (because they use `useState`, `useTransition` for form submission).
- Form submission calls the existing Server Actions from M1 directly; do not reimplement password validation or hashing.
- Client-side validation uses Zod schemas for UX feedback; server always re-validates.
- Success/error toasts use `sonner`.

**Reuse only — do not implement:**
- Password change logic (AITJ-M1-07 `changePassword` action).
- Profile update logic (AITJ-M1-07 `updateUserProfile` action).
- Password hash comparison (lib/auth).

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present (client validation alone is never sufficient — §7); reused from AITJ-M1-07 actions
- [ ] Session asserted via middleware on `/settings` route and via `authedAction` in the reused actions (§8.2)
- [ ] No N+1 queries — the page fetches one user row; forms do not refetch
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts, passwords, or tokens in logs (NFR-8); password is never logged or exposed
- [ ] Responsive at 360px, tap targets ≥44px (NFR-3)
- [ ] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
