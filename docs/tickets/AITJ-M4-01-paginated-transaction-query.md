# AITJ-M4-01 — Paginated and sortable transaction query in the repository

| Field | Value |
|---|---|
| Milestone | M4 — Transaction list |
| Depends on | AITJ-M3-02 (transaction repository exists), AITJ-M2-01 (categories) |
| Blocks | AITJ-M4-02, AITJ-M4-03, AITJ-M4-04, AITJ-M4-05 |
| PRD refs | FR-L7, FR-L8, §6 (indexes), §6.1 (deletedAt filter), §8.3 (aggregation), NFR-1 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

The transaction list requires a flexible, performant query that applies filters (type, category, date range, search), sorts (date or amount), and paginates (25 rows per page) all on the server. This repository method is the foundation for every list operation in M4. It must use the three indexes defined in §6 and execute within NFR-1's 1.5s budget on 10,000 rows. Server-side pagination is mandatory (FR-L8) — the method returns at most 25 rows, never the full table.

## Acceptance criteria

- [ ] AC1 — Repository method `findTransactionsPaginated(filters, sort, page)` returns exactly 25 rows (or fewer on the last page), never the full table
- [ ] AC2 — Sort by `occurredOn` descending (default, newest first) or ascending; or by `amount` descending or ascending
- [ ] AC3 — Supports filter chains: type (INCOME/EXPENSE/null for All), categoryIds (array), dateRange ({from, to}), searchTerm (description and category name)
- [ ] AC4 — Returns `{ items: Transaction[], total: number, hasNextPage: boolean }` where `total` is the count of ALL matching rows across all pages
- [ ] AC5 — Every row in items includes the category object (no N+1 queries)
- [ ] AC6 — Rejects invalid page numbers (page < 0, page 0, non-numeric, beyond last page) by returning empty items but valid total
- [ ] AC7 — Every query filters `deletedAt: null`
- [ ] AC8 — Performance: query plan on 10,000 rows executes in < 100ms (measured in integration test)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Page 0 (off-by-one) | Treat as page 1; return the first 25 rows |
| E2 | Page 1 with 50 total rows | Return 25 rows, hasNextPage = true |
| E3 | Page 2 with 50 total rows | Return 25 rows (rows 26–50), hasNextPage = false |
| E4 | Page 3 with 50 total rows (beyond last) | Return empty items array, total = 50, hasNextPage = false |
| E5 | Negative page number | Treat as page 1 |
| E6 | Non-numeric page (e.g. "abc") | Treat as page 1 |
| E7 | dateRange with from > to | Return empty (no rows match). Do not throw; let validation reject this upstream in the action |
| E8 | Empty database, all pages | All pages return empty items, total = 0, hasNextPage = false |
| E9 | Exactly 25 rows | Page 1 returns 25, hasNextPage = false |
| E10 | Exactly 26 rows | Page 1 returns 25, hasNextPage = true; page 2 returns 1, hasNextPage = false |
| E11 | 10,000 rows with no filters | Pagination boundaries respected; query time < 100ms for page 1 |
| E12 | Sort by amount (mixed income/expense) | Amounts are always positive (A10); sort by magnitude. State explicitly: "Amount sorting is by absolute value (magnitude), not signed effect, since all amounts in the table are positive" |
| E13 | Two transactions same date, same amount | Sort stability: add createdAt (or ID) as tiebreaker to ensure deterministic order across page boundaries |
| E14 | Search term with wildcards: %, _, ', ", backslash | Terms are escaped; query does not break and does not match unintended rows |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `transactions.repository > findTransactionsPaginated > returns exactly 25 rows on page 1 of 50` | items.length === 25 && total === 50 && hasNextPage === true |
| T2 | integration | `transactions.repository > findTransactionsPaginated > returns remaining rows on last page` | page 2 of 50 returns 25; page 3 returns 0 (last page already passed) |
| T3 | integration | `transactions.repository > findTransactionsPaginated > excludes soft-deleted rows from items and total` | 51 rows created, 1 deleted; page 1 returns 25, total = 50 |
| T4 | integration | `transactions.repository > findTransactionsPaginated > sorts by occurredOn descending (newest first) by default` | items[0].occurredOn > items[1].occurredOn (dates are more recent at index 0) |
| T5 | integration | `transactions.repository > findTransactionsPaginated > sorts by occurredOn ascending (oldest first) when requested` | items[0].occurredOn < items[1].occurredOn |
| T6 | integration | `transactions.repository > findTransactionsPaginated > sorts by amount descending (largest first)` | items[0].amount >= items[1].amount |
| T7 | integration | `transactions.repository > findTransactionsPaginated > sorts by amount ascending (smallest first)` | items[0].amount <= items[1].amount |
| T8 | integration | `transactions.repository > findTransactionsPaginated > handles sort stability (same date and amount) with deterministic tiebreaker` | Create two transactions same date and amount; page across the boundary; row is not duplicated or dropped |
| T9 | integration | `transactions.repository > findTransactionsPaginated > filters by type INCOME only` | typeFilter = "INCOME"; all items have type = "INCOME"; total matches seeded INCOME count |
| T10 | integration | `transactions.repository > findTransactionsPaginated > filters by type EXPENSE only` | typeFilter = "EXPENSE"; all items have type = "EXPENSE" |
| T11 | integration | `transactions.repository > findTransactionsPaginated > filters by type ALL (null) includes both` | typeFilter = null; results include both INCOME and EXPENSE |
| T12 | integration | `transactions.repository > findTransactionsPaginated > filters by single category` | categoryIds = [catId1]; all items.category.id === catId1 |
| T13 | integration | `transactions.repository > findTransactionsPaginated > filters by multiple categories (OR)` | categoryIds = [catId1, catId2]; all items belong to one of the two categories |
| T14 | integration | `transactions.repository > findTransactionsPaginated > filters by date range inclusive both ends` | from = "2026-01-15", to = "2026-01-20"; transactions on exactly 2026-01-15 and 2026-01-20 are included |
| T15 | integration | `transactions.repository > findTransactionsPaginated > filters by date range excludes outside dates` | from = "2026-01-15", to = "2026-01-20"; transaction on 2026-01-14 and 2026-01-21 are excluded |
| T16 | integration | `transactions.repository > findTransactionsPaginated > combines type and category filters` | typeFilter = "INCOME" and categoryIds = [catId]; results are INCOME and in that category |
| T17 | integration | `transactions.repository > findTransactionsPaginated > combines type, category, date filters` | All three; results match all three predicates |
| T18 | integration | `transactions.repository > findTransactionsPaginated > search term matches description case-insensitive` | Description = "Electricity Bill"; search = "electricity"; row is included |
| T19 | integration | `transactions.repository > findTransactionsPaginated > search term matches category name case-insensitive` | Category name = "Jumu'ah"; search = "jum"; row is included (partial match) |
| T20 | integration | `transactions.repository > findTransactionsPaginated > search term with special chars %, _, ', ", backslash is escaped` | searchTerm contains these; query executes without syntax error and returns only truly matching rows |
| T21 | integration | `transactions.repository > findTransactionsPaginated > page 0 treated as page 1` | page = 0; returns items at indices 0–24 |
| T22 | integration | `transactions.repository > findTransactionsPaginated > negative page treated as page 1` | page = -5; returns items at indices 0–24 |
| T23 | integration | `transactions.repository > findTransactionsPaginated > non-numeric page treated as page 1` | page = "abc"; returns items at indices 0–24 |
| T24 | integration | `transactions.repository > findTransactionsPaginated > page beyond last returns empty items, valid total, hasNextPage false` | 50 rows, page = 5; items = [], total = 50, hasNextPage = false |
| T25 | integration | `transactions.repository > findTransactionsPaginated > dateRange from > to returns no rows (silently)` | from = "2026-12-31", to = "2026-01-01"; items = [], total = 0 |
| T26 | integration | `transactions.repository > findTransactionsPaginated > includes category object (no N+1)` | Query count = 1 (single query with join/include); every item.category.id and item.category.name are present |
| T27 | integration | `transactions.repository > findTransactionsPaginated > empty database returns empty on all pages` | Zero transactions seeded; all pages return items = [], total = 0, hasNextPage = false |
| T28 | integration | `transactions.repository > findTransactionsPaginated > exactly 25 rows, page 1, hasNextPage false` | Seed exactly 25; page 1 returns 25, hasNextPage = false |
| T29 | integration | `transactions.repository > findTransactionsPaginated > exactly 26 rows, page 1 hasNextPage true, page 2 hasNextPage false` | Seed 26; page 1 returns 25, hasNextPage = true; page 2 returns 1, hasNextPage = false |
| T30 | performance | `transactions.repository > findTransactionsPaginated > 10,000 rows, page 1, query time < 100ms` | Seed 10,000 rows; measure query time; assert < 100ms (validates NFR-1) |

**Red gate:** every test above is written and failing for the right reason (either missing method or assertion failure). Commit the failing tests before implementing the method.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**File: `lib/repositories/transaction.repository.ts`**

Add method:

```typescript
async findTransactionsPaginated(
  filters: {
    type?: TransactionType | null;
    categoryIds?: string[];
    dateRange?: { from: Date; to: Date };
    searchTerm?: string;
  },
  sort: { field: "occurredOn" | "amount"; direction: "asc" | "desc" },
  page: number
): Promise<{ items: TransactionWithCategory[]; total: number; hasNextPage: boolean }>
```

**Key implementation decisions:**

1. **Pagination:** Use `skip` and `take` with Prisma. `skip = Math.max(0, (Math.max(1, page) - 1) * 25)`, `take = 26` (fetch one extra to determine hasNextPage).

2. **Total count:** Issue a separate `count()` query with the same `where` predicate to get the accurate total for all pages. Do not rely on `items.length` or the page count.

3. **Deleted filter:** Every query includes `where: { deletedAt: null }`. This is centralized in the repository and never forgotten.

4. **Category join:** Use `include: { category: true }` to fetch category in one query (no N+1).

5. **Sort stability:** Add a secondary sort by `createdAt` (or `id`) ascending to ensure deterministic order when primary sort is tied.

6. **Sort by amount:** Amounts are always positive (A10). Sort by absolute value (all amounts in the result). State in a comment: "Amounts are always positive per A10; sorting is by magnitude."

7. **Search predicate:** Search matches on `description` (ILIKE `%term%`) OR `category.name` (ILIKE `%term%`). Escape special characters: `%` → `\%`, `_` → `\_`, single quote → `''`, double quote → `\"`, backslash → `\\`. Use parameterized queries or Prisma's escaping to prevent injection.

   **Note on performance:** ILIKE with leading wildcard does not use a btree index. Per A8 (a few thousand rows per year), this is acceptable. Add a comment: "Search uses ILIKE '%term%' which does not use a btree index. Acceptable for A8's data volume (few thousand rows per year). If search volume grows significantly, consider a full-text index (tsvector) in a v1.1 optimization."

8. **Page number handling:** Coerce `page` to a number; treat 0, negative, and non-numeric as 1.

9. **Test database:** Integration tests use Testcontainers or a disposable Postgres instance seeded with realistic data (soft-deleted rows, mixed types, multiple categories).

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side pagination: method returns at most 25 rows per call, never the full table
- [ ] Total count is accurate across all pages (separate aggregation query, not a sum of page items)
- [ ] Sort stability: two rows with identical primary sort key are ordered deterministically (secondary tiebreaker)
- [ ] Category included in one query (no N+1)
- [ ] `deletedAt: null` filter applied via repository only
- [ ] Search escapes special characters correctly and does not break on injection attempts
- [ ] Performance: 10,000-row integration test query < 100ms (NFR-1)
- [ ] `pnpm test`, `pnpm lint`, `pnpm tsc --noEmit` all pass
