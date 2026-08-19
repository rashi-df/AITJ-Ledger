# AITJ-M2-03 — Archive, unarchive and delete categories with in-use protection

| Field | Value |
|---|---|
| Milestone | M2 — Categories |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M0-06, AITJ-M0-07, AITJ-M1-01, AITJ-M2-01, AITJ-M2-02 |
| Blocks | AITJ-M2-04, AITJ-M2-05 |
| PRD refs | FR-C7, FR-C8, FR-C9, §6, §6.1, §8.2, §10 page 7 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

Categories in use by any transaction cannot be deleted (FR-C7) — they can only be archived. Archived categories are hidden from the entry-form dropdown but must still render on historical transactions and in reports (same category object, with `isArchived: true`). A category with zero transactions can be permanently deleted (FR-C8), and an archived category can be unarchived (FR-C9). The database `onDelete: Restrict` enforces the in-use constraint at the schema level (§6.1); the application provides user-friendly error messaging.

## Acceptance criteria

- [ ] AC1 — Server Action `archiveCategory(id: string)` sets `isArchived: true` and returns the updated Category
- [ ] AC2 — Server Action `unarchiveCategory(id: string)` sets `isArchived: false` and returns the updated Category
- [ ] AC3 — Server Action `deleteCategory(id: string)` permanently deletes a category if and only if transaction count is zero; throws otherwise
- [ ] AC4 — All three actions assert an authenticated session via `authedAction`
- [ ] AC5 — `deleteCategory` throws error `"Cannot delete a category with transactions"` if transaction count > 0 (including soft-deleted, per FR-C7 note)
- [ ] AC6 — `deleteCategory` with a category that has zero transactions removes it from the database entirely
- [ ] AC7 — `archiveCategory` on an already-archived category is idempotent (no error, returns the category)
- [ ] AC8 — `unarchiveCategory` on a non-archived category is idempotent (no error, returns the category)
- [ ] AC9 — All three actions write audit entries with before/after state (NFR-2)
- [ ] AC10 — Archived categories do NOT appear in the category dropdown for creating/editing transactions (tested in M2-04 UI, but action doesn't enforce — UI queries with `isArchived: false`)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Archive a category with zero transactions | Succeeds; `isArchived: true` |
| E2 | Archive a category with one transaction | Succeeds; `isArchived: true`; transaction still references it and displays it |
| E3 | Unarchive a category and verify it appears in dropdown again | Unarchive, then query for categories with `isArchived: false`; it is included |
| E4 | Archive, then immediately archive again | Second call succeeds (idempotent); no error |
| E5 | Unarchive, then immediately unarchive again | Second call succeeds (idempotent); no error |
| E6 | Delete a category with zero transactions | Succeeds; category is gone from database; cannot be retrieved by id |
| E7 | Delete a category with exactly one transaction | Fails; error "Cannot delete a category with transactions" |
| E8 | Delete a category with one non-deleted and one soft-deleted transaction | Fails; error "Cannot delete a category with transactions" (soft-deleted still counts, per FR-C7 logic: it may be restored and still reference the category) |
| E9 | Delete a category with only soft-deleted transactions | Fails; error "Cannot delete a category with transactions" (same rationale as E8) |
| E10 | Database `onDelete: Restrict` fires when attempting delete | Prisma throws constraint error; action catches and re-throws with user-friendly message (integration test) |
| E11 | Unauthenticated user calls `archiveCategory` | Redirects to login (session assert) |
| E12 | Unauthenticated user calls `deleteCategory` | Redirects to login (session assert) |
| E13 | Attempt to unarchive and then create a transaction with it (M3 flow) | Both succeed; the category becomes in-use again; archive/delete now fails with "Cannot delete" |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `actions/categories.test.ts > archiveCategory requires authenticated session` | Unauthenticated call throws or redirects |
| T2 | integration | `actions/categories.test.ts > archiveCategory sets isArchived=true` | Create category, archive, retrieve and assert `isArchived: true` |
| T3 | integration | `actions/categories.test.ts > archiveCategory on unused category succeeds` | Archive a category with zero transactions; succeeds |
| T4 | integration | `actions/categories.test.ts > archiveCategory on used category succeeds` | Create category, create transaction with it, archive category; succeeds (archiving doesn't require unused status) |
| T5 | integration | `actions/categories.test.ts > archiveCategory is idempotent` | Archive already-archived category; no error; returned category unchanged |
| T6 | integration | `actions/categories.test.ts > archiveCategory writes audit entry` | Archive category, retrieve audit log, assert one UPDATE entry with before={isArchived:false} and after={isArchived:true} |
| T7 | integration | `actions/categories.test.ts > unarchiveCategory requires authenticated session` | Unauthenticated call throws or redirects |
| T8 | integration | `actions/categories.test.ts > unarchiveCategory sets isArchived=false` | Archive then unarchive, retrieve and assert `isArchived: false` |
| T9 | integration | `actions/categories.test.ts > unarchiveCategory is idempotent` | Unarchive non-archived category; no error; returned category unchanged |
| T10 | integration | `actions/categories.test.ts > unarchiveCategory writes audit entry` | Unarchive, retrieve audit log, assert one UPDATE entry with before={isArchived:true} and after={isArchived:false} |
| T11 | integration | `actions/categories.test.ts > deleteCategory requires authenticated session` | Unauthenticated call throws or redirects |
| T12 | integration | `actions/categories.test.ts > deleteCategory with zero transactions succeeds` | Create unused category, delete, assert not retrievable by id |
| T13 | integration | `actions/categories.test.ts > deleteCategory with one transaction fails` | Create category, create transaction, attempt delete, error is "Cannot delete a category with transactions" |
| T14 | integration | `actions/categories.test.ts > deleteCategory with soft-deleted transaction fails` | Create transaction, soft-delete it, attempt to delete category, error is "Cannot delete a category with transactions" |
| T15 | integration | `actions/categories.test.ts > deleteCategory writes audit entry on success` | Create and delete unused category, retrieve audit log, assert one DELETE entry with before={id, name, type, ...} |
| T16 | integration | `actions/categories.test.ts > archived category not in dropdown query` | Archive a category, query `getCategoriesWithStats` for EXPENSE with `isArchived: false`, assert category not in result |
| T17 | integration | `actions/categories.test.ts > unarchived category appears in dropdown query` | Create and archive, then unarchive, query `getCategoriesWithStats` with `isArchived: false`, assert category is included |
| T18 | integration | `actions/categories.test.ts > archived category renders on historical transaction` | Create category, create transaction, archive category, query transaction detail, assert category name is displayed (ID-based reference survives archive state) |

**Red gate:** All 18 tests written, failing for the right reason. Commit failing tests before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**File: `actions/categories.ts`** — extend from M2-02

- Export `async function archiveCategory(id: string)` — wrapped in `authedAction`
- Export `async function unarchiveCategory(id: string)` — wrapped in `authedAction`
- Export `async function deleteCategory(id: string)` — wrapped in `authedAction`
- `archiveCategory` and `unarchiveCategory`: call repository methods, write audit entry with before/after
- `deleteCategory`: call `getTransactionCountForCategory(id)` from M2-01; if count > 0, throw `CategoryInUseError` with message "Cannot delete a category with transactions"; otherwise call repository `deleteCategory` and write audit entry
- All write entries inside the same transaction as the mutation (atomicity)
- `revalidatePath('/categories')` after each successful mutation

**File: `lib/repositories/category.ts`** — extend from M2-01

- Methods already implemented in M2-01; no changes needed here

**Integration with transaction filtering:** The M2-04 category page will query categories with `isArchived: false` for the dropdown. Do not query archived categories in the entry form dropdown (enforced at query layer, not at action layer). The action doesn't enforce this; the UI does.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Session asserted via `authedAction` on all three actions
- [ ] Audit entries written atomically with mutations (NFR-2)
- [ ] `deleteCategory` verifies transaction count includes soft-deleted rows (FR-C7 safety net)
- [ ] Archived categories excluded from `getCategoriesWithStats(..., { isArchived: false })` query
- [ ] `onDelete: Restrict` at database level is tested to confirm it prevents deletion when in use
- [ ] Idempotency tests pass (archive → archive, unarchive → unarchive)
- [ ] No N+1 queries
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts, passwords, or tokens in logs
- [ ] Reviewed by review-agent → QA signed off
