# AITJ-M7-03 — Deleted transactions view with restore

| Field | Value |
|---|---|
| Milestone | M7 — Settings & admin |
| Depends on | AITJ-M3-02, AITJ-M3-03, AITJ-M7-01 |
| Blocks | none |
| PRD refs | FR-S4, FR-T10, FR-T11, FR-T12, FR-C7, §2, §6 models, §8.2, NFR-2, NFR-3, NFR-4 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

FR-S4 requires a UI to view soft-deleted transactions and restore them. FR-T11 states deleted transactions are visible only in Settings → Deleted transactions. FR-T12 mandates that a restore writes an audit entry with action `RESTORE`. FR-T10 guarantees deleted rows are excluded from every list and total. This ticket implements the Deleted transactions section within Settings (M7-01), builds the restore Server Action, and updates the audit writer (M3-03) to log restores. The repository layer (M3-02) must expose a separate, explicitly-named method to fetch soft-deleted transactions, not via an optional flag that could leak elsewhere.

## Acceptance criteria

- [ ] AC1 — The Deleted transactions section of Settings is navigable from the shell tab/section layout (M7-01)
- [ ] AC2 — A list displays all soft-deleted transactions with columns: Date, Type, Category, Description, Amount, Deleted by, Deleted on. Sorting is by deletion date (most recent first, per FR-L7)
- [ ] AC3 — Each row has a Restore button; clicking it calls the `restoreTransaction` Server Action
- [ ] AC4 — On successful restore, a toast confirms "Transaction restored" and the row disappears from the deleted list
- [ ] AC5 — A restored transaction immediately reappears in the Dashboard, Income, Expenses, and Transactions pages — the dashboard balance updates by exactly the restored amount
- [ ] AC6 — A restore audit entry is created with action `RESTORE`, referencing the transaction and the restoring user
- [ ] AC7 — Restoring a transaction whose category has been archived succeeds; the transaction reappears with the archived category shown (FR-C7 allows this)
- [ ] AC8 — Empty state: if no transactions have been deleted, the page displays "No deleted transactions. All transactions are safe."
- [ ] AC9 — At 360px viewport, the list collapses into cards; all buttons are ≥44px tap targets; text is readable (NFR-3)
- [ ] AC10 — All controls are labelled, keyboard-navigable, with 4.5:1 contrast (NFR-4)
- [ ] AC11 — Restoring is atomic: the transaction row and its audit entry commit together or not at all (NFR-2)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Restore a transaction whose category was archived | The restore succeeds; the transaction reappears with the archived category intact (FR-C7). Test that the dashboard total changes by the correct amount. |
| E2 | Restore a transaction whose category no longer exists (hard deleted) | This must be impossible by design: FR-C7 and FR-C8 state a category with any transaction (including soft-deleted) cannot be deleted. Write a test that proves the invariant holds — attempt to hard-delete a category with a soft-deleted transaction and verify it fails at the database level. |
| E3 | Restore an already-restored transaction (idempotency) | Once a transaction is restored (deletedAt set to null), attempting to restore it again should either be idempotent (succeeds, no audit entry) or rejected with "Transaction is not deleted". Decide and state in the ticket. For now, assume rejection: "Cannot restore a non-deleted transaction". |
| E4 | Two concurrent restore requests for the same transaction | The first succeeds; the second is rejected (per E3). Database and audit log show one restore entry. |
| E5 | Restore and immediately view dashboard | The dashboard balance reflects the restored amount without a page refresh (requires cache invalidation via `revalidatePath` on the dashboard route). |
| E6 | Transaction's "Added by" user has been deactivated | The deleted list shows the deactivated user's name in "Deleted by"; on restore, the same attribution is preserved (FR-A9). |
| E7 | Very long description or category name | Text is truncated or wrapped in cards; tap targets remain ≥44px. |
| E8 | Deleted transaction with amount `0.01` or `99999999999.99` | Restore succeeds; the exact decimal amount is restored in the dashboard total. |
| E9 | Delete, then restore, then delete again | The transaction is soft-deleted again with a new deletedAt timestamp and deletedById (the current user); the audit log shows two DELETE entries and one RESTORE entry for this transaction. |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `settings > deleted transactions > loads and displays list` | /settings?tab=deleted-transactions renders the deleted transactions section with a table/card layout |
| T2 | e2e | `settings > deleted transactions > unauthenticated access redirects to login` | Unauthenticated GET /settings redirects to /login |
| T3 | e2e | `settings > deleted transactions > empty state when no deleted transactions` | No rows exist; page shows "No deleted transactions. All transactions are safe." |
| T4 | e2e | `settings > deleted transactions > shows deleted transaction with type income badge` | Create and delete an income transaction; it appears in the deleted list with Income badge and amount sign |
| T5 | e2e | `settings > deleted transactions > shows deleted transaction with type expense badge` | Create and delete an expense transaction; it appears in the deleted list with Expense badge and amount sign |
| T6 | e2e | `settings > deleted transactions > restore button and restore succeeds` | Click Restore on a deleted row; a toast confirms "Transaction restored"; the row disappears from the list |
| T7 | e2e | `settings > deleted transactions > restored transaction reappears in dashboard` | Delete a transaction, restore it, navigate to Dashboard; the balance updates by the exact restored amount (test with a specific amount like ₹5,000) |
| T8 | e2e | `settings > deleted transactions > restored transaction reappears in transaction list` | Delete a transaction, restore it, navigate to /transactions; the transaction appears in the full list |
| T9 | e2e | `settings > deleted transactions > restore with archived category succeeds` | Create a transaction with category X, archive X, delete the transaction, restore it; the restored transaction shows the archived category name; dashboard reflects it |
| T10 | integration | `restoreTransaction > creates audit entry with RESTORE action` | Call restoreTransaction action with a soft-deleted transaction ID; verify AuditLog row exists with action="RESTORE", entityType="Transaction", entityId matching the transaction, before=null, after=JSON snapshot of the restored transaction |
| T11 | integration | `restoreTransaction > restore is atomic with audit entry` | Call restoreTransaction action; verify within a single transaction that deletedAt is set to null AND an audit entry is created (commit together or rollback together). Use a real Postgres and transaction test. |
| T12 | integration | `restoreTransaction > reject restore of non-deleted transaction` | Call restoreTransaction with a transaction that is not deleted; the action rejects with "Cannot restore a non-deleted transaction" or similar; audit log has no new entry |
| T13 | integration | `restoreTransaction > reject restore if category is hard-deleted` | Write a test proving this is impossible: create a transaction with category X, soft-delete the transaction, attempt to hard-delete category X; the database rejects with onDelete: Restrict. Do not write a test that tries to restore after category deletion, since deletion must be impossible. |
| T14 | integration | `restoreTransaction > session asserted` | Call restoreTransaction action without a session (simulated); the action rejects with "Unauthorized"; no audit entry created |
| T15 | e2e | `settings > deleted transactions > sorted by deletion date descending` | Delete transaction A on day 1, transaction B on day 2; the list shows B first, then A |
| T16 | e2e | `settings > deleted transactions > at 360px renders as cards with ≥44px buttons` | Render at 360px; deleted transactions list collapses into cards; measure Restore button; verify ≥44px; no horizontal scroll |
| T17 | e2e | `settings > deleted transactions > keyboard navigation` | Tab through all controls; all are reachable; Enter restores; focus ring visible |
| T18 | integration | `repository > fetchDeletedTransactions method exists and returns only soft-deleted rows` | Call a repository method named `fetchDeletedTransactions` or similar (verify the explicit name); it returns rows where deletedAt IS NOT NULL; it does not filter by deletedAt: null |

**Red gate:** All 18 tests are written, committed with failing assertions, and run to confirm they fail for the right reason.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Files to modify/create:**

1. **Repository:** `lib/repositories/transaction.ts`
   - Add a method `fetchDeletedTransactions(filters?: {…})` that explicitly fetches only rows where `deletedAt IS NOT NULL`. This method is separate from the normal transaction-list query and must not accept an optional `includeDeleted` flag that could be misused elsewhere.
   - Return deleted transactions with their related user, category, and the actor who deleted them.

2. **Action:** `actions/transactions.ts` or new file `actions/restore-transaction.ts`
   - Create `restoreTransaction(transactionId: string)` Server Action that:
     - Asserts session via `authedAction`.
     - Parses and validates the transaction ID (cuid).
     - Calls `transaction.restore(id, actorId)` inside a transaction.
     - Writes an audit entry with action="RESTORE".
     - Calls `revalidatePath` for /, /income, /expenses, /transactions, and /settings.

3. **Audit writer:** `lib/audit/writer.ts` (AITJ-M3-03)
   - Ensure `AuditAction.RESTORE` is supported.
   - On a restore, the "after" JSON snapshot is the restored transaction data; "before" is null (or the state before restore, per spec — clarify).

4. **UI Component:** `components/settings/DeletedTransactionsSection.tsx`
   - Server Component fetches deleted transactions via `repository.fetchDeletedTransactions()`.
   - Client component for the Restore button bound to the `restoreTransaction` action.
   - Empty state for no deleted transactions.

5. **Routing:** Add the tab/section to Settings navigation (M7-01).

**Approach:**
- The deleted-transactions view is a simple list (no filters, no search in v1 — only soft-deleted rows, sorted by deletion date desc).
- Restore is a single-click action with a confirmation toast, no confirmation dialog needed (unlike delete, which uses FR-T9's dialog).
- The page does not auto-refresh after restore; the row disappears due to revalidatePath on the settings page.
- Dashboard, transaction list, and totals all exclude deletedAt: null rows via the repository layer, so a restore automatically reappears everywhere without special code.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present (cannot restore a non-deleted or archived transaction)
- [ ] Session asserted via `authedAction` (§8.2)
- [ ] Restore is atomic with audit entry (NFR-2); verified by transaction test
- [ ] `repository.fetchDeletedTransactions()` is an explicit, separately-named method, not a flag on the normal fetch method
- [ ] Repository method includes related user, category, and deletedBy for display
- [ ] No N+1 queries — deleted list fetched in one query with `include`
- [ ] Audit entry includes the restored transaction's full after snapshot; "before" is null or state before restore (clarify in implementation)
- [ ] No amounts, passwords, or tokens in logs (NFR-8)
- [ ] Responsive at 360px, tap targets ≥44px (NFR-3); table becomes cards
- [ ] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
