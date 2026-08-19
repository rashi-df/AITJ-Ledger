# AITJ-M3-06 — Build Expenses page with fast-entry form

| Field | Value |
|---|---|
| Milestone | M3 — Transactions |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M1-01, AITJ-M2-01, AITJ-M3-01, AITJ-M3-02, AITJ-M3-04 |
| Blocks | AITJ-M4-01 |
| PRD refs | FR-T1, FR-T4, FR-T6, FR-T7, §10, A2, NFR-3, NFR-4 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

The Expenses page (`/expenses`) mirrors the Income page (M3-05) but for expense transactions. It provides a fast-entry form (amount, category filtered to expenses-only, date defaulting to today IST, optional description), clears the form on save but retains the date, shows a success toast with Undo, and displays an expense-only transaction list below. The page is fully responsive (360px mobile, desktop) and keyboard-accessible. All validation, error handling, and Undo behavior are identical to the Income page.

## Acceptance criteria

- [ ] AC1 — Route `/expenses` exists and requires authentication; unauthenticated users redirect to `/login` preserving the destination
- [ ] AC2 — Page shows a form with fields: amount (text input), category (dropdown, expense-only), date (date picker), description (optional textarea)
- [ ] AC3 — Amount input accepts typed strings (with commas, spaces, ₹ symbol) and coerces them; Zod validation runs client-side for immediate feedback
- [ ] AC4 — Category dropdown shows only non-archived EXPENSE categories, fetched from the category repository on page load
- [ ] AC5 — Date field defaults to today's date in IST (not UTC); if no date is selected, defaults to today IST on submit
- [ ] AC6 — Description field is optional; placeholder text "Optional" or similar; max 500 chars indicated
- [ ] AC7 — Submit button is labelled "Add Expense" and is disabled while a request is in flight
- [ ] AC8 — After successful submit, the form clears: amount, category, description become empty; date is NOT cleared (keeps today's date)
- [ ] AC9 — A success toast appears saying "Expense recorded" (or similar), displaying the amount and category, with an Undo link/button
- [ ] AC10 — The Undo affordance, when clicked, calls `restoreTransaction(id)` (soft-restore the just-deleted transaction); if successful, the toast updates to say "Undo successful"
- [ ] AC11 — If submit fails, an error toast shows a user-friendly message without internal details
- [ ] AC12 — The Expenses list below the form shows all expense-only transactions (excluding soft-deleted), sorted by date descending, with columns: Date, Category, Description, Amount
- [ ] AC13 — Amount is displayed in ₹ symbol, en-IN format (e.g., ₹1,50,000.00), with expense amounts shown in a distinct colour (e.g., red or dark) and never distinguished by colour alone (a dash prefix or label helps non-colour users)
- [ ] AC14 — List is empty on first load; as transactions are added, they appear at the top (most recent first)
- [ ] AC15 — Each row has Edit and Delete action buttons (linking to M3-07 and M3-08 respectively)
- [ ] AC16 — On mobile (360px), the form and list stack vertically; form is above list; list collapses to stacked cards (not a table)
- [ ] AC17 — All form labels are associated with inputs; tabbing navigates through all controls in logical order; focus ring is visible

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Expenses list is empty on first load | Show "No expenses recorded yet" message with a link to the form |
| E2 | User adds expense, then navigates away before using Undo | Undo link expires; transaction is deleted permanently (or "Undo window closed" message, state decision) |
| E3 | User adds expense and immediately clicks Undo | Undo succeeds; transaction is restored; list shows the row again |
| E4 | User adds expense, toast shows, user clicks Undo, but the soft-delete was already processed (no-op) | Undo call fails gracefully; toast shows "Cannot undo" or "Already deleted" (state decision) |
| E5 | Amount = "₹5,50,000.25" (formatted with ₹ and commas) | Form accepts; on submit, Zod coerces to "550000.25"; stored correctly |
| E6 | Amount = "1e3" (user typed scientific notation) | Zod rejects with error message; form shows error in the amount field |
| E7 | Category dropdown is empty (no non-archived EXPENSE categories exist) | Form still renders; category dropdown shows "No categories available" or similar; submit is disabled |
| E8 | Date picker: user selects today + 1 year + 1 day (exceeds max) | Zod rejects; error "Enter a valid date" shows under the date field |
| E9 | Description = exactly 500 chars | Zod accepts; transaction is created |
| E10 | Submit with empty category dropdown | Zod validation fails; error "Select a category" shows under the category field |
| E11 | Two concurrent form submits by double-clicking the button | Button is disabled after first click; second click is no-op |
| E12 | Form submitted with network error (offline) | Error toast shows "Failed to record expense"; form data is NOT cleared (user can retry) |
| E13 | On page load, category repository fetch fails | Page shows error message; form is not rendered or is disabled; user can retry |
| E14 | Undo link in toast is clicked after page refresh | Depends on whether Undo state is in URL, sessionStorage, or local component state (state decision in ticket) |
| E15 | Mobile (360px): form is tall with many fields | Form and list both stack; form is scrollable or collapses if needed (test layout doesn't break) |
| E16 | Very long category name (e.g., 50 chars) | Dropdown text wraps or truncates gracefully; not breaking the layout |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `expenses page › unauthenticated access › redirects to login` | GET /expenses without session; redirects to /login?redirect=/expenses (or similar) |
| T2 | e2e | `expenses page › form renders › shows all fields` | Page loads; form shows amount input, category select, date input, description textarea, submit button |
| T3 | e2e | `expenses page › form defaults › date defaults to today IST` | Load page at 23:50 IST on 2026-08-19; date field shows 2026-08-19, not 2026-08-20 |
| T4 | e2e | `expenses page › category dropdown › fetches non-archived EXPENSE categories` | Category dropdown shows all non-archived EXPENSE categories from the database |
| T5 | e2e | `expenses page › category dropdown › hides archived categories` | Archive an EXPENSE category; reload page; category does not appear in dropdown |
| T6 | e2e | `expenses page › category dropdown › hides INCOME categories` | Create an INCOME category; reload page; category does not appear in dropdown |
| T7 | e2e | `expenses page › submit › valid input › creates transaction` | Fill form with amount=5000, category=Electricity, date=today, description="Monthly bill"; click submit; transaction appears in DB |
| T8 | e2e | `expenses page › submit › valid input › success toast appears` | After submit, toast shows "Expense recorded ₹5,000.00 - Electricity" with Undo link |
| T9 | e2e | `expenses page › submit › valid input › form clears but keeps date` | Fill form, submit; amount/category/description are empty; date field still shows today |
| T10 | e2e | `expenses page › submit › valid input › list updates with new row` | Before submit, list is empty; after submit, transaction appears in list at the top |
| T11 | e2e | `expenses page › submit › amount validation › rejects 0` | Enter amount=0, submit; error "Enter an amount greater than 0" shows under amount field |
| T12 | e2e | `expenses page › submit › amount validation › rejects 0.001` | Enter amount=0.001, submit; error shows; form data is NOT cleared |
| T13 | e2e | `expenses page › submit › category validation › requires category` | Leave category empty, submit; error "Select a category" shows |
| T14 | e2e | `expenses page › submit › date validation › accepts today + 1 year` | Enter date today + 1 year, submit; succeeds (future dates allowed per A7) |
| T15 | e2e | `expenses page › submit › date validation › rejects past date (1999-12-31)` | Enter date 1999-12-31, submit; error "Enter a valid date" shows |
| T16 | e2e | `expenses page › submit › description validation › accepts 500 chars` | Enter exactly 500 chars, submit; succeeds |
| T17 | e2e | `expenses page › submit › button disabled during flight` | Start submit; click button rapidly; only one request is sent |
| T18 | e2e | `expenses page › undo › restores deleted transaction` | Add expense, toast shows, click Undo; list shows the transaction again; DB has deletedAt=null |
| T19 | e2e | `expenses page › undo › updates toast to success message` | After clicking Undo, toast updates or a new toast shows "Undo successful" |
| T20 | e2e | `expenses page › undo › fails gracefully if already deleted` | Add expense, click Undo after transaction is already restored; error handling is graceful (no crash) |
| T21 | e2e | `expenses page › list › empty state` | On first load, no transactions; list shows "No expenses recorded yet" |
| T22 | e2e | `expenses page › list › displays amounts in en-IN format` | After adding expense of 5000, list shows "₹5,000.00" (not "₹5000.00" or "5000") |
| T23 | e2e | `expenses page › list › rows have Edit and Delete buttons` | Each row in list shows Edit and Delete buttons |
| T24 | e2e | `expenses page › list › ordered by date descending` | Add expense on 2026-08-01, then 2026-08-15, then 2026-08-08; list shows 2026-08-15 first, then 2026-08-08, then 2026-08-01 |
| T25 | e2e | `expenses page › list › amount uses visual distinction (not colour alone)` | Expense amounts are shown in a different style (e.g., red text, dash prefix "- ₹1,000") not solely by colour |
| T26 | e2e | `expenses page › responsive › 360px mobile › form and list stack` | On 360px viewport, form is above list; no horizontal scroll; tap targets ≥44px |
| T27 | e2e | `expenses page › responsive › 360px mobile › list is stacked cards, not table` | On 360px, list renders as stacked cards, not a table |
| T28 | e2e | `expenses page › responsive › desktop › layout is readable` | On 1920px viewport, form and list are side-by-side or stacked but readable |
| T29 | e2e | `expenses page › accessibility › tab navigation` | Tab through form; focus moves through amount → category → date → description → submit in logical order |
| T30 | e2e | `expenses page › accessibility › focus ring visible` | Tab to each control; focus ring is visible |
| T31 | e2e | `expenses page › accessibility › labels associated with inputs` | Each input has an associated label; screen reader reads label when focused |
| T32 | integration | `expenses page › form submission › records createdBy user` | After submit, transaction.createdById equals the authenticated user's ID |
| T33 | integration | `expenses page › form submission › type is always EXPENSE` | After submit, transaction.type equals TransactionType.EXPENSE |
| T34 | integration | `expenses page › form submission › soft-deleted transaction is not shown in list` | Add expense, soft-delete it via API; list does NOT show it |

**Red gate:** Every test above is written and failing. Commit the failing tests before implementing the page.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create:**
- `app/(app)/expenses/page.tsx` — Server Component that fetches non-archived EXPENSE categories and renders the page
- `components/expenses-form.tsx` — Client Component for the form (using shadcn Form, Select, Input, Textarea from the stack)
- `components/expenses-list.tsx` — Client Component or Server Component for the transaction list

**Approach:**
- Mirror the Income page (M3-05) structure exactly, but filter category dropdown to EXPENSE only.
- Form validation, error handling, Undo, and list display are identical.
- Amount visual distinction: Use a red or dark colour (plus a prefix like "- " or a label) so expense amounts are not distinguished by colour alone (NFR-4).
- All validation rules and error messages are the same as the Income page.
- Date default and Undo scope are the same as M3-05.

**Reuse:** If possible, extract shared form/list logic into a generic component parameterized by type (INCOME vs EXPENSE) to avoid duplication. However, separate pages are acceptable for clarity. Decision to state in the ticket.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation (action) and client-side convenience validation (form) both in place
- [ ] Route `/expenses` exists and requires authentication
- [ ] Form submits to `createTransaction` Server Action with type=EXPENSE
- [ ] Success toast shows amount and category
- [ ] Date defaults to today in IST, not UTC
- [ ] Form clears but date is retained after successful submit
- [ ] Category dropdown filters to non-archived EXPENSE categories only
- [ ] List shows expense-only transactions, sorted by date descending
- [ ] Amounts formatted en-IN with ₹ symbol and visual distinction (not colour alone)
- [ ] Edit and Delete buttons link to correct pages (M3-07, M3-08)
- [ ] Responsive at 360px (mobile cards) and desktop (readable layout)
- [ ] Keyboard-accessible, labelled form controls, focus ring visible
- [ ] Undo affordance defined and tested (expires after page navigation or toast timeout)
- [ ] E2E tests pass at 360px and desktop viewports
- [ ] Reviewed by review-agent
