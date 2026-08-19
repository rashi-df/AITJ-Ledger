# AITJ-M3-07 — Edit a transaction including type switching and audit trails

| Field | Value |
|---|---|
| Milestone | M3 — Transactions |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M1-01, AITJ-M2-01, AITJ-M3-01, AITJ-M3-02, AITJ-M3-03, AITJ-M3-04 |
| Blocks | AITJ-M4-01 |
| PRD refs | FR-T8, FR-T13, §8.2, NFR-2, NFR-3, NFR-4 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

The Edit Transaction page allows a user to change any field of an existing transaction: amount, category, date, description, and type (FR-T8). Switching the transaction's type from INCOME to EXPENSE (or vice versa) clears the category field and forces the user to select a category of the new type; this enforces the type/category invariant. The page displays who created the transaction and when, and if edited before, shows who last edited it and when (FR-T13). Editing is a full-transaction update: the `updateTransaction` Server Action follows the same five-step pattern as create (assert session → parse → repository call inside transaction → write audit → revalidate). The audit entry records the before and after states, so the user can see what changed. The page is responsive (360px, desktop) and keyboard-accessible.

## Acceptance criteria

- [ ] AC1 — Route `/transactions/[id]/edit` exists and requires authentication; unauthenticated users redirect to `/login`
- [ ] AC2 — Page fetches the transaction by ID; if not found or soft-deleted, shows "Transaction not found" or redirects to `/transactions`
- [ ] AC3 — Form fields are pre-populated: type, amount, category, date, description (from the transaction's current values)
- [ ] AC4 — Type field is a radio or select showing INCOME and EXPENSE; changing it triggers a category clear and re-fetch
- [ ] AC5 — When type is changed (e.g., INCOME → EXPENSE), the category field is cleared and the category dropdown is re-populated with the new type's non-archived categories
- [ ] AC6 — Changing type does not submit the form; the user can change type and then select a new category before submitting
- [ ] AC7 — Category dropdown only shows non-archived categories of the currently-selected type
- [ ] AC8 — Amount, date, and description can be edited without changing type
- [ ] AC9 — Submit button is labelled "Save Changes" and is disabled while a request is in flight
- [ ] AC10 — On successful submit, the user is redirected to `/transactions` (or `/income` or `/expenses` depending on type, state decision) with a success toast
- [ ] AC11 — If the transaction is soft-deleted, the page shows an error and does not allow editing
- [ ] AC12 — Below the form, the page shows: "Added by {creatorName} on {date}" (e.g., "Added by Ahmed on 19 Aug 2026")
- [ ] AC13 — If the transaction has been edited before, show: "Last edited by {editorName} on {date}"
- [ ] AC14 — If editing fails (e.g., category deleted between fetch and submit), an error toast shows a user-friendly message
- [ ] AC15 — The audit entry records the before and after states, including both old and new type and category, so the change is traceable

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Edit soft-deleted transaction | Page shows error; form is not rendered or is disabled |
| E2 | Fetch transaction: ID is invalid (not a cuid) | Returns 400 or shows "Transaction not found" |
| E3 | Fetch transaction: ID does not exist | Shows "Transaction not found"; no form |
| E4 | Fetch transaction: ID belongs to a soft-deleted transaction | Shows "Transaction not found" (or error); no form |
| E5 | Type switch INCOME → EXPENSE, then back to INCOME | Category is cleared and re-populated; user must re-select an INCOME category before submitting |
| E6 | Type switch but do not re-select category, then submit | Zod validation fails with "Select a category"; form is not submitted |
| E7 | Fetch category by ID for dropdown: one category exists, another is archived and should not appear | Dropdown shows only the non-archived category of the new type |
| E8 | Type switch and category is re-selected; then amount is changed | Submit succeeds; before/after in audit show old and new type, category, and amount |
| E9 | Only description is changed (amount, category, date, type unchanged) | Submit succeeds; audit before and after differ only in description (and updatedAt) |
| E10 | Edit transaction, category used by this transaction is archived between fetch and submit | On submit, Zod validation fails with "Select a category" (archived categories are not valid); user must select a different category |
| E11 | Two users edit the same transaction concurrently | Last write wins; both audit entries are created; the second editor's before state is the first editor's after state (non-atomic from first editor's perspective, but each edit is atomic) — state expected resolution |
| E12 | Amount changed from 100 to 150 | Audit before.amount = "100.00", after.amount = "150.00" (both strings) |
| E13 | Amount entered with ₹ symbol or commas, e.g., "₹1,50,000" | Zod coerces to "150000"; submit succeeds |
| E14 | Description changed from "X" to "" (cleared) | Audit records before.description = "X", after.description = null or empty (state decision) |
| E15 | Date boundary: changed from 2026-08-19 to today + 1 year + 1 day (exceeds max) | Zod validation fails with "Enter a valid date"; form not submitted |
| E16 | Created by Alice, edited by Bob, now edited by Charlie | Page shows "Added by Alice on ...", "Last edited by Bob on ..." and after this edit, audit shows "Last edited by Charlie on ..." (next page load) |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `edit transaction › unauthenticated access › redirects to login` | GET /transactions/[id]/edit without session; redirects to /login |
| T2 | e2e | `edit transaction › fetch › loads transaction data` | Navigate to edit page; form fields are pre-populated with transaction values |
| T3 | e2e | `edit transaction › fetch › soft-deleted transaction › shows error` | Fetch a soft-deleted transaction; page shows error or redirects; form not rendered |
| T4 | e2e | `edit transaction › fetch › non-existent ID › shows not found` | Fetch /transactions/invalid-id/edit; page shows "Transaction not found" |
| T5 | e2e | `edit transaction › form › type field shows current type` | Load edit page for INCOME transaction; type field shows INCOME selected |
| T6 | e2e | `edit transaction › form › category field pre-populated` | Load edit page; category dropdown shows the current category selected |
| T7 | e2e | `edit transaction › form › amount field pre-populated` | Load edit page; amount input shows current amount |
| T8 | e2e | `edit transaction › form › date field pre-populated` | Load edit page; date picker shows current date |
| T9 | e2e | `edit transaction › form › description field pre-populated` | Load edit page; description textarea shows current description (or empty if null) |
| T10 | e2e | `edit transaction › type switch › change INCOME to EXPENSE` | On form, click type EXPENSE; category dropdown clears and re-populates with EXPENSE categories only |
| T11 | e2e | `edit transaction › type switch › category cleared` | After type switch, category field is empty; "Select a category" placeholder shows |
| T12 | e2e | `edit transaction › type switch › cannot submit without new category` | Type switch, don't select category, click Submit; validation error "Select a category" shows |
| T13 | e2e | `edit transaction › type switch › select new category and submit` | Type switch INCOME → EXPENSE, select Electricity, submit; succeeds; audit shows both old and new type and category |
| T14 | e2e | `edit transaction › type switch › switch back to original type` | Change INCOME to EXPENSE, then back to INCOME; category is cleared each time; final submit with correct category succeeds |
| T15 | e2e | `edit transaction › submit › amount only › succeeds` | Edit transaction: change amount only, click Submit; succeeds; audit shows amount changed |
| T16 | e2e | `edit transaction › submit › description only › succeeds` | Edit transaction: change description only; submit succeeds |
| T17 | e2e | `edit transaction › submit › all fields › succeeds` | Edit transaction: change amount, category, date, description (type unchanged); submit succeeds |
| T18 | e2e | `edit transaction › submit › success toast › shows confirmation` | After successful edit, toast shows "Transaction updated" or similar |
| T19 | e2e | `edit transaction › submit › redirects › navigates to transactions or income/expenses` | After successful edit, redirected to /transactions or /income or /expenses (state decision) |
| T20 | e2e | `edit transaction › submit › validation › amount = 0 › rejected` | Change amount to 0; submit; error "Enter an amount greater than 0" shows |
| T21 | e2e | `edit transaction › submit › validation › amount > max › rejected` | Change amount to 100000000000.00; submit; error shows |
| T22 | e2e | `edit transaction › submit › validation › date = 1999-12-31 › rejected` | Change date to 1999-12-31; submit; error "Enter a valid date" shows |
| T23 | e2e | `edit transaction › submit › validation › description 501 chars › rejected` | Change description to 501 chars; submit; error shows |
| T24 | e2e | `edit transaction › attribution › shows creator name and date` | Below form, shows "Added by Ahmed on 19 Aug 2026" (or similar format) |
| T25 | e2e | `edit transaction › attribution › shows last editor if edited before` | If transaction was edited before, shows "Last edited by Bob on 18 Aug 2026" |
| T26 | e2e | `edit transaction › attribution › updates after this edit` | Edit transaction and refresh page; "Last edited by Charlie on 19 Aug 2026" now shows |
| T27 | e2e | `edit transaction › button › disabled during flight` | Click Submit; button is disabled until response arrives |
| T28 | e2e | `edit transaction › error handling › category archived between fetch and submit` | Fetch transaction with category X (non-archived), archive X, submit; validation fails with "Select a category" |
| T29 | e2e | `edit transaction › error handling › network error › form data retained` | Submit with network error; error toast shows; form data is NOT cleared (user can retry) |
| T30 | integration | `edit transaction › audit › before and after values` | After update, audit entry exists with action=UPDATE, before contains old values, after contains new values |
| T31 | integration | `edit transaction › audit › type and category both in before and after` | After type-switch update, audit before/after show old and new type and categoryId |
| T32 | integration | `edit transaction › audit › amount as Decimal string` | Audit before.amount and after.amount are strings (e.g., "100.00", "150.00"), not numbers |
| T33 | integration | `edit transaction › permissions › user cannot edit another user's transaction` | User A creates transaction; User B tries to edit it; should be rejected (or allowed — state decision; M3 likely allows all users to edit all transactions per FR-A*) |

**Red gate:** Every test above is written and failing. Commit the failing tests before implementing the page.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create:**
- `app/(app)/transactions/[id]/edit/page.tsx` — Server Component that fetches the transaction and renders the edit page
- `components/transaction-edit-form.tsx` — Client Component for the form (using shadcn Form, Select, Input, Textarea)
- `actions/transactions.ts` — Add `updateTransaction` Server Action to the file created in M3-04

**Approach:**
- Server Component fetches the transaction using `transactionRepository.findByIdIncludeDeleted(id)` so it can show who created it (even if later deleted, but the edit page rejects deleted transactions anyway).
- Form is a Client Component with React Hook Form + Zod.
- Type field: onChange handler clears the category field and updates the available categories.
- Category fetch: Implement a separate Server Action or route that returns non-archived categories for a given type (used on type change).
- On submit, call `updateTransaction` Server Action.
- Attribution section: Display creator name and createdAt (formatted), and if updatedBy is not null, show last editor and updatedAt.

**New Server Action:** `updateTransaction(id: string, input: unknown)`
- Assert session
- Fetch transaction using `transactionRepository.findByIdIncludeDeleted(id)` to get before state
- If soft-deleted, reject
- Parse input with Zod
- Call `transactionRepository.update(id, parsed, userId)` inside a Prisma transaction
- Write audit inside same transaction with before and after
- Revalidate paths
- Return success or error

**Reuse:** Extract category fetching into a shared helper or Server Action used by both Income/Expenses pages and the Edit page.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation and mutation logic in place
- [ ] authedAction wrapper used for the updateTransaction action
- [ ] Mutation and audit entry atomic (Prisma transaction block)
- [ ] Type/category invariant enforced and tested
- [ ] Type switch clears category and forces reselection
- [ ] Attribution (creator/editor names and dates) displayed correctly
- [ ] Soft-deleted transactions rejected with error
- [ ] Amounts as Decimal strings in response and audit
- [ ] Responsive at 360px and desktop
- [ ] Keyboard-accessible, labelled controls, focus ring visible
- [ ] E2E tests pass at 360px and desktop viewports
- [ ] Reviewed by review-agent
