# AITJ-M3-05 — Build Income page with fast-entry form

| Field | Value |
|---|---|
| Milestone | M3 — Transactions |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M1-01, AITJ-M2-01, AITJ-M3-01, AITJ-M3-02, AITJ-M3-04 |
| Blocks | AITJ-M4-01 |
| PRD refs | FR-T1, FR-T4, FR-T6, FR-T7, §10, A2, NFR-3, NFR-4 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

The Income page (`/income`) provides a fast-entry form for recording income transactions (§10, route 3). The form shows fields for amount, category (income-only), date (defaulting to today in IST), and optional description. After a successful save, the form clears but the date is retained so rapid consecutive entries are fast (FR-T7). A success toast appears with an Undo affordance. Below the form, an income-only transaction list is displayed, initially empty until the first entry. The page is fully responsive (360px mobile, desktop) and keyboard-accessible.

## Acceptance criteria

- [ ] AC1 — Route `/income` exists and requires authentication; unauthenticated users redirect to `/login` preserving the destination
- [ ] AC2 — Page shows a form with fields: amount (text input), category (dropdown, income-only), date (date picker), description (optional textarea)
- [ ] AC3 — Amount input accepts typed strings (with commas, spaces, ₹ symbol) and coerces them; Zod validation runs client-side for immediate feedback
- [ ] AC4 — Category dropdown shows only non-archived INCOME categories, fetched from the category repository on page load
- [ ] AC5 — Date field defaults to today's date in IST (not UTC); if no date is selected, defaults to today IST on submit
- [ ] AC6 — Description field is optional; placeholder text "Optional" or similar; max 500 chars indicated
- [ ] AC7 — Submit button is labelled "Add Income" and is disabled while a request is in flight
- [ ] AC8 — After successful submit, the form clears: amount, category, description become empty; date is NOT cleared (keeps today's date)
- [ ] AC9 — A success toast appears saying "Income recorded" (or similar), displaying the amount and category, with an Undo link/button
- [ ] AC10 — The Undo affordance, when clicked, calls `restoreTransaction(id)` (soft-restore the just-deleted transaction); if successful, the toast updates to say "Undo successful"
- [ ] AC11 — If submit fails, an error toast shows a user-friendly message without internal details
- [ ] AC12 — The Income list below the form shows all income-only transactions (excluding soft-deleted), sorted by date descending, with columns: Date, Category, Description, Amount
- [ ] AC13 — Amount is displayed in ₹ symbol, en-IN format (e.g., ₹1,50,000.00), with income amounts shown in black (or positive colour) and never distinguished by colour alone
- [ ] AC14 — List is empty on first load; as transactions are added, they appear at the top (most recent first)
- [ ] AC15 — Each row has Edit and Delete action buttons (linking to M3-07 and M3-08 respectively)
- [ ] AC16 — On mobile (360px), the form and list stack vertically; form is above list; list collapses to stacked cards (not a table)
- [ ] AC17 — All form labels are associated with inputs; tabbing navigates through all controls in logical order; focus ring is visible

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Income list is empty on first load | Show "No income recorded yet" message with a link to the form |
| E2 | User adds income, then navigates away before using Undo | Undo link expires; transaction is deleted permanently (or "Undo window closed" message if Undo is re-offered later, state decision) |
| E3 | User adds income and immediately clicks Undo | Undo succeeds; transaction is restored; list shows the row again |
| E4 | User adds income, toast shows, user clicks Undo, but the soft-delete was already processed (no-op) | Undo call fails gracefully; toast shows "Cannot undo" or "Already deleted" (state decision) |
| E5 | Amount = "1,000.50" (user typed with comma) | Form accepts; on submit, Zod coerces to "1000.50"; stored correctly |
| E6 | Amount = "1e5" (user typed scientific notation) | Zod rejects with error message; form shows error in the amount field |
| E7 | Category dropdown is empty (no non-archived INCOME categories exist) | Form still renders; category dropdown shows "No categories available" or similar; submit is disabled |
| E8 | Date picker: user selects 1999-12-31 | Zod rejects; error "Enter a valid date" shows under the date field |
| E9 | Description = 501 chars | Zod rejects; error "Description is too long" shows under the description field |
| E10 | Submit with empty category dropdown | Zod validation fails; error "Select a category" shows under the category field |
| E11 | Two concurrent form submits by double-clicking the button | Button is disabled after first click; second click is no-op |
| E12 | Form submitted with network error (offline) | Error toast shows "Failed to record income"; form data is NOT cleared (user can retry) |
| E13 | On page load, category repository fetch fails | Page shows error message; form is not rendered or is disabled; user can retry |
| E14 | Undo link in toast is clicked after page refresh | Depends on whether Undo state is in URL, sessionStorage, or local component state (state decision in ticket) |
| E15 | Mobile (360px): form is tall with many fields | Form and list both stack; form is scrollable or collapses if needed (test layout doesn't break) |
| E16 | Very long category name (e.g., 50 chars) | Dropdown text wraps or truncates gracefully; not breaking the layout |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `income page › unauthenticated access › redirects to login` | GET /income without session; redirects to /login?redirect=/income (or similar) |
| T2 | e2e | `income page › form renders › shows all fields` | Page loads; form shows amount input, category select, date input, description textarea, submit button |
| T3 | e2e | `income page › form defaults › date defaults to today IST` | Load page at 23:50 IST on 2026-08-19; date field shows 2026-08-19, not 2026-08-20 |
| T4 | e2e | `income page › category dropdown › fetches non-archived INCOME categories` | Category dropdown shows all non-archived INCOME categories from the database |
| T5 | e2e | `income page › category dropdown › hides archived categories` | Archive an INCOME category; reload page; category does not appear in dropdown |
| T6 | e2e | `income page › category dropdown › hides EXPENSE categories` | Create an EXPENSE category; reload page; category does not appear in dropdown |
| T7 | e2e | `income page › submit › valid input › creates transaction` | Fill form with amount=1000, category=Donation, date=today, description="Test"; click submit; transaction appears in DB |
| T8 | e2e | `income page › submit › valid input › success toast appears` | After submit, toast shows "Income recorded ₹1,000.00 - Donation" with Undo link |
| T9 | e2e | `income page › submit › valid input › form clears but keeps date` | Fill form, submit; amount/category/description are empty; date field still shows today |
| T10 | e2e | `income page › submit › valid input › list updates with new row` | Before submit, list is empty; after submit, transaction appears in list at the top |
| T11 | e2e | `income page › submit › amount validation › rejects 0` | Enter amount=0, submit; error "Enter an amount greater than 0" shows under amount field |
| T12 | e2e | `income page › submit › amount validation › rejects 0.001` | Enter amount=0.001, submit; error shows; form data is NOT cleared |
| T13 | e2e | `income page › submit › category validation › requires category` | Leave category empty, submit; error "Select a category" shows |
| T14 | e2e | `income page › submit › date validation › rejects past date (1999-12-31)` | Enter date 1999-12-31, submit; error "Enter a valid date" shows |
| T15 | e2e | `income page › submit › description validation › rejects 501 chars` | Enter 501 chars, submit; error "Description is too long" shows |
| T16 | e2e | `income page › submit › button disabled during flight` | Start submit; click button rapidly; only one request is sent |
| T17 | e2e | `income page › undo › restores deleted transaction` | Add income, toast shows, click Undo; list shows the transaction again; DB has deletedAt=null |
| T18 | e2e | `income page › undo › updates toast to success message` | After clicking Undo, toast updates or a new toast shows "Undo successful" |
| T19 | e2e | `income page › undo › fails gracefully if already deleted` | Add income, click Undo after transaction is already restored; error handling is graceful (no crash) |
| T20 | e2e | `income page › list › empty state` | On first load, no transactions; list shows "No income recorded yet" |
| T21 | e2e | `income page › list › displays amounts in en-IN format` | After adding income of 1000, list shows "₹1,000.00" (not "₹1000.00" or "1000") |
| T22 | e2e | `income page › list › rows have Edit and Delete buttons` | Each row in list shows Edit and Delete buttons |
| T23 | e2e | `income page › list › ordered by date descending` | Add income on 2026-08-01, then 2026-08-15, then 2026-08-08; list shows 2026-08-15 first, then 2026-08-08, then 2026-08-01 |
| T24 | e2e | `income page › responsive › 360px mobile › form and list stack` | On 360px viewport, form is above list; no horizontal scroll; tap targets ≥44px |
| T25 | e2e | `income page › responsive › 360px mobile › list is stacked cards, not table` | On 360px, list renders as stacked cards (Date, Category, Amount in separate rows per card), not a table |
| T26 | e2e | `income page › responsive › desktop › layout is readable` | On 1920px viewport, form and list are side-by-side or stacked but readable; no truncation |
| T27 | e2e | `income page › accessibility › tab navigation` | Tab through form; focus moves through amount → category → date → description → submit in logical order |
| T28 | e2e | `income page › accessibility › focus ring visible` | Tab to each control; focus ring is visible (default or custom) |
| T29 | e2e | `income page › accessibility › labels associated with inputs` | Each input has an associated label (via `for` attribute); screen reader reads label when focused |
| T30 | integration | `income page › form submission › records createdBy user` | After submit, transaction.createdById equals the authenticated user's ID |
| T31 | integration | `income page › form submission › soft-deleted transaction is not shown in list` | Add income, soft-delete it via API; list does NOT show it |

**Red gate:** Every test above is written and failing. Commit the failing tests before implementing the page.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create:**
- `app/(app)/income/page.tsx` — Server Component that fetches non-archived INCOME categories and renders the page
- `components/income-form.tsx` — Client Component for the form (using shadcn Form, Select, Input, Textarea from the stack)
- `components/income-list.tsx` — Client Component or Server Component for the transaction list

**Approach:**
- Server Component fetches categories on every page load (for freshness).
- Form is a Client Component (for interactivity); uses React Hook Form + Zod for validation.
- On submit, calls the `createTransaction` Server Action from M3-04.
- Success toast uses `sonner` toast library (from stack).
- Undo is implemented as a link in the toast that calls a `restoreTransaction` Server Action (which soft-restores the deleted row). The Undo window can be tied to the toast lifetime (e.g., 5 seconds, then the link expires). Alternatively, store the most-recent transaction ID in component state and only enable Undo if the transaction is still in the state (if page navigates away or refreshes, Undo expires).
- List fetches transactions on page load; refresh list after successful create or delete.
- Date picker uses `@shadcn/ui` Popover + Calendar or similar component.
- Amount input is a text input (to accept coerced values); Zod handles parsing on submit.
- Category dropdown is a Select; options are fetched from the server-side category repository.

**Concerns to address:**
- **IST date default:** Use `date-fns` with `@date-fns/tz` to compute today in IST, then format as YYYY-MM-DD for the date input.
- **Undo scope:** Define explicitly whether Undo is per-session, per-page-load, or per-toast-lifetime. If page navigation clears Undo, state that.
- **List refresh:** After successful create, either refetch the list or rely on Next.js revalidation (via the Server Action's `revalidatePath`).

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation (action) and client-side convenience validation (form) both in place
- [ ] Route `/income` exists and requires authentication
- [ ] Form submits to `createTransaction` Server Action
- [ ] Success toast shows amount and category
- [ ] Date defaults to today in IST, not UTC
- [ ] Form clears but date is retained after successful submit
- [ ] Category dropdown filters to non-archived INCOME categories only
- [ ] List shows income-only transactions, sorted by date descending
- [ ] Amounts formatted en-IN with ₹ symbol
- [ ] Edit and Delete buttons link to correct pages (M3-07, M3-08)
- [ ] Responsive at 360px (mobile cards) and desktop (readable layout)
- [ ] Keyboard-accessible, labelled form controls, focus ring visible
- [ ] Undo affordance defined and tested (expires after page navigation or toast timeout)
- [ ] E2E tests pass at 360px and desktop viewports
- [ ] Reviewed by review-agent
