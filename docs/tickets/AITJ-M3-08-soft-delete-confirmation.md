# AITJ-M3-08 — Soft delete transaction with confirmation dialog

| Field | Value |
|---|---|
| Milestone | M3 — Transactions |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M1-01, AITJ-M2-01, AITJ-M3-01, AITJ-M3-02, AITJ-M3-03 |
| Blocks | AITJ-M4-01 |
| PRD refs | FR-T9, FR-T10, FR-T11, §8.2, NFR-2, NFR-3, NFR-4 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

Deleting a transaction (FR-T9, FR-T10) is a soft delete: the row is marked with `deletedAt` timestamp and `deletedById` user ID, excluded from every list/total/chart/export, but retained in the database for audit and restoration (FR-T11). A Delete button on each transaction row opens a confirmation dialog reading exactly "Are you sure you want to delete this transaction?" and showing the transaction's amount, category, and date, so the user can confirm they are deleting the right row. If confirmed, the `deleteTransaction` Server Action is called, which follows the five-step pattern (assert session → validate the transaction exists and is not already deleted → call repository softDelete inside transaction → write audit → revalidate). On success, the dialog closes and the transaction disappears from the list; a success toast offers an immediate Undo affordance. The page is responsive and keyboard-accessible.

## Acceptance criteria

- [ ] AC1 — Each transaction row in a list (Income, Expenses, Transactions pages) has a Delete action button
- [ ] AC2 — Clicking Delete opens a confirmation dialog (using shadcn Dialog)
- [ ] AC3 — Dialog shows the exact text: "Are you sure you want to delete this transaction?"
- [ ] AC4 — Dialog displays the transaction's amount (formatted ₹ en-IN), category, and date (formatted)
- [ ] AC5 — Dialog has two buttons: "Cancel" (closes dialog without action) and "Delete" (confirms and executes)
- [ ] AC6 — Delete button in the dialog is disabled during the request to the Server Action
- [ ] AC7 — On successful delete, the `deleteTransaction` Server Action soft-deletes the transaction and writes an audit entry with action=DELETE
- [ ] AC8 — On successful delete, the dialog closes and the row disappears from the list (via revalidation or optimistic update)
- [ ] AC9 — A success toast appears saying "Transaction deleted" with an Undo link/button
- [ ] AC10 — The Undo link calls `restoreTransaction(id)`, restoring the soft-deleted transaction, and updates the toast to "Undo successful"
- [ ] AC11 — If the user attempts to delete an already-deleted transaction, the action returns an error and the UI handles it gracefully
- [ ] AC12 — If the delete request fails (e.g., network error), an error toast shows a user-friendly message without internal details
- [ ] AC13 — The transaction is never permanently deleted; deleted transactions are restorable from Settings (FR-T11, M7 responsibility for UI)
- [ ] AC14 — After soft delete, the transaction is excluded from all lists, totals, charts, and exports (verified in repository tests for M3-02, not here)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Dialog closed by pressing Escape or clicking outside | Dialog closes without deleting; no request to server |
| E2 | Delete button in dialog clicked | Confirmation is sent to server; transaction is soft-deleted |
| E3 | User clicks Delete, confirms, Undo is clicked immediately | Undo succeeds; transaction is restored; appears in list again |
| E4 | User clicks Delete, confirms, navigates away before Undo | Undo link expires; transaction remains deleted; can be restored from Settings later |
| E5 | User clicks Delete, confirms, then refresh the page | Transaction is gone from list (no visible row); can be restored from Settings |
| E6 | Two concurrent Delete requests for the same transaction | First succeeds; second receives error "Transaction already deleted" (or similar); handled gracefully |
| E7 | Delete a transaction, Undo it, then Delete again | Second delete succeeds; transaction is soft-deleted again with a new deletedAt and deletedById |
| E8 | Transaction was already soft-deleted, user navigates to edit page | Edit page shows error "Transaction not found" (M3-07) |
| E9 | Transaction with amount 99999999999.99 and very long category name | Dialog shows the full amount and category without truncation or wrapping badly |
| E10 | Dialog opened, category archive happens in another tab/window | Dialog still shows the category name (which is immutable in the UI); delete succeeds as normal |
| E11 | Network error during delete request | Error toast shows "Failed to delete transaction"; dialog closes or remains open (state decision); row remains visible |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `delete transaction › unauthenticated access › redirected to login` | Call deleteTransaction without session; rejected with 401 |
| T2 | e2e | `delete transaction › dialog › clicking delete button opens dialog` | On transaction row, click Delete button; dialog appears |
| T3 | e2e | `delete transaction › dialog › shows confirmation text` | Dialog text reads exactly "Are you sure you want to delete this transaction?" |
| T4 | e2e | `delete transaction › dialog › shows amount, category, date` | Dialog displays transaction amount (formatted), category name, and date |
| T5 | e2e | `delete transaction › dialog › cancel button closes without deleting` | Click Cancel; dialog closes; transaction still appears in list; no audit entry created |
| T6 | e2e | `delete transaction › dialog › delete button confirms` | Click Delete button in dialog; server request is sent |
| T7 | e2e | `delete transaction › dialog › delete button disabled during flight` | Click Delete; button is disabled until response arrives |
| T8 | e2e | `delete transaction › dialog › closed by Escape key` | Dialog open; press Escape; dialog closes; transaction not deleted |
| T9 | e2e | `delete transaction › dialog › closed by clicking outside (backdrop)` | Dialog open; click outside the dialog; dialog closes; transaction not deleted |
| T10 | e2e | `delete transaction › successful delete › row disappears from list` | After delete confirmed, row is removed from the list (via revalidation or optimistic update) |
| T11 | e2e | `delete transaction › successful delete › success toast appears` | Toast shows "Transaction deleted" with Undo link |
| T12 | e2e | `delete transaction › successful delete › audit entry created` | After delete, auditLog entry exists with action=DELETE |
| T13 | e2e | `delete transaction › undo › clicking undo restores transaction` | After delete, click Undo in toast; transaction is restored; appears in list again |
| T14 | e2e | `delete transaction › undo › toast updates to success message` | After clicking Undo, toast updates to "Undo successful" or new toast shows |
| T15 | e2e | `delete transaction › undo › page refresh before undo expires` | Delete, refresh page; Undo link is gone; transaction remains deleted; can restore from Settings |
| T16 | e2e | `delete transaction › error › already deleted › graceful handling` | Try to delete an already-deleted transaction; error toast shows; no crash |
| T17 | e2e | `delete transaction › error › network error › friendly message` | Network error during delete; error toast shows "Failed to delete"; transaction remains visible (user can retry) |
| T18 | e2e | `delete transaction › multiple deletes › delete same transaction twice` | Delete, Undo, Delete again; both deletes succeed; transaction is deleted twice (two audit entries) |
| T19 | e2e | `delete transaction › multiple deletes › delete different transactions › both succeed` | Delete transaction A, delete transaction B; both succeed independently |
| T20 | integration | `delete transaction › soft delete › marks deletedAt and deletedById` | After delete, transaction.deletedAt is set; transaction.deletedById = userId; transaction.updatedAt updated |
| T21 | integration | `delete transaction › soft delete › before state in audit` | Audit entry action=DELETE, before contains the full transaction state |
| T22 | integration | `delete transaction › soft delete › excluded from future queries` | Delete transaction; repository.list() does NOT include it; repository.findById(id) returns null |
| T23 | integration | `delete transaction › soft delete › totals exclude deleted` | Before delete: getTotalIncome() = 100; after delete: getTotalIncome() = 0 (if only transaction) |
| T24 | integration | `delete transaction › soft delete › cannot re-edit` | Delete transaction; try to update it via updateTransaction action; fails with error or no-op |
| T25 | integration | `delete transaction › atomicity › if audit write fails, delete does not persist` | Mock audit write failure; call deleteTransaction inside Prisma transaction; if audit fails, row.deletedAt remains null |

**Red gate:** Every test above is written and failing. Commit the failing tests before implementing.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**Files to create/modify:**
- `components/delete-transaction-dialog.tsx` — Client Component (or integrated into transaction row) that renders the confirmation dialog using shadcn Dialog
- `actions/transactions.ts` — Add `deleteTransaction` Server Action

**Approach:**
- Delete button on each row opens the dialog component.
- Dialog shows the transaction details (amount formatted, category, date).
- On Confirm, call `deleteTransaction(transactionId)` Server Action.
- Server Action:
  1. Assert session
  2. Fetch transaction with `transactionRepository.findByIdIncludeDeleted(id)` to get the before state
  3. If deletedAt is not null (already deleted), return error
  4. Call `transactionRepository.softDelete(id, userId)` inside Prisma transaction
  5. Write audit inside same transaction with action=DELETE
  6. Revalidate paths
  7. Return success
- On success, close dialog and show success toast with Undo affordance.
- Undo calls `restoreTransaction(id)` (which is the inverse: fetches the deleted row, calls repository.restore(), writes audit with action=RESTORE).

**Return type for deleteTransaction:**
```typescript
type DeleteTransactionResponse =
  | { success: true; data: { id: string } }
  | { success: false; error: string };
```

**Optimistic update vs. server-driven:** Either optimistically remove the row from the UI state (faster, requires rollback on error), or rely on Next.js revalidation (simpler, slightly slower). State decision in the ticket.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation and mutation logic in place
- [ ] authedAction wrapper used for deleteTransaction
- [ ] Mutation and audit entry atomic (Prisma transaction block)
- [ ] Confirmation dialog shows exact text and transaction details
- [ ] Soft delete marks deletedAt and deletedById, does not remove row
- [ ] Soft-deleted transaction excluded from all reads (verified in M3-02 tests)
- [ ] Undo affordance implemented (calls restoreTransaction)
- [ ] Dialog closes on Escape and backdrop click (Cancel and Close buttons work)
- [ ] Error handling graceful (network error, already deleted, etc.)
- [ ] Responsive at 360px and desktop
- [ ] Keyboard-accessible, focus trapping in dialog, visible focus ring
- [ ] E2E tests pass at 360px and desktop viewports
- [ ] Reviewed by review-agent
