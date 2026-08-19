# AITJ-M3-02 — Build transaction repository with centralized soft-delete filtering

| Field | Value |
|---|---|
| Milestone | M3 — Transactions |
| Depends on | AITJ-M0-03, AITJ-M0-04 |
| Blocks | AITJ-M3-04, AITJ-M3-05, AITJ-M3-06, AITJ-M3-07, AITJ-M3-08, AITJ-M4-01, AITJ-M5-01 |
| PRD refs | FR-T10, FR-T11, FR-T13, §6.1, §8.2, §8.3, NFR-1, A5, A6 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

The transaction repository is the sole owner of the soft-delete filter `deletedAt: null`. Every read path (list, single fetch, totals, category usage counts) filters through this layer, never at call sites, so a forgotten filter cannot corrupt a total. This centralizes the invariant: "soft-deleted rows are invisible everywhere" (FR-T10, §6.1). Aggregation (SUM) happens in SQL, never in Node code, per §8.3. The repository also supports restore of soft-deleted transactions (FR-T11), storing the before/after state for audit entries.

## Acceptance criteria

- [ ] AC1 — `lib/repositories/transactionRepository.ts` exports an object with methods: `create`, `findById`, `findByIdIncludeDeleted`, `list`, `getTotalIncome`, `getTotalExpenses`, `getCategoryUsageCount`, `update`, `softDelete`, `restore`, `getDeletedTransactions`
- [ ] AC2 — Every read method (`findById`, `list`, `getTotalIncome`, etc.) filters `deletedAt IS NULL` at the Prisma query layer; SQL query inspection shows the filter in the WHERE clause
- [ ] AC3 — `create(data, userId)` inserts a row with type, amount, categoryId, occurredOn, description, createdById; returns the full transaction object including id, createdAt, updatedAt
- [ ] AC4 — `findById(id)` returns a transaction or null; if `deletedAt` is not null, returns null (no soft-deleted row is visible)
- [ ] AC5 — `findByIdIncludeDeleted(id)` returns a transaction regardless of deletedAt status; used only for fetching a deleted transaction to restore it or to audit
- [ ] AC6 — `list(filters)` returns paginated transactions with schema `{ data: Transaction[], total: number }`, accepting `{ type?, categoryId?, dateFrom?, dateTo?, search?, sort, page, limit }`, filtering on deletedAt=null
- [ ] AC7 — `getTotalIncome(filters)` returns total income as a Decimal string (never a number) for the filtered set, excluding soft-deleted; e.g. `"50000.00"`
- [ ] AC8 — `getTotalExpenses(filters)` returns total expenses as Decimal string, excluding soft-deleted
- [ ] AC9 — `getCategoryUsageCount(categoryId)` returns the count of non-deleted transactions using that category (used by FR-C7 to check if a category can be deleted)
- [ ] AC10 — `update(id, data, userId)` updates a transaction, setting updatedById and updatedAt; fails if the transaction is soft-deleted (returns null or throws); if successful, returns the old row and new row for audit
- [ ] AC11 — `softDelete(id, userId)` marks a transaction deleted with timestamp and userId; returns the full transaction row (before deletion, for audit); fails if already deleted
- [ ] AC12 — `restore(id, userId)` clears deletedAt and deletedById for a soft-deleted transaction, sets updatedById and updatedAt; returns the restored transaction; fails if not deleted
- [ ] AC13 — `getDeletedTransactions(filters)` returns soft-deleted transactions (opposite of normal list); used in Settings for FR-T11 restore UI
- [ ] AC14 — Totals aggregation uses PostgreSQL `SUM()` in the SELECT clause, never fetches rows and adds them in Node

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | `list()` with empty database | Returns `{ data: [], total: 0 }` |
| E2 | `list()` with only soft-deleted transactions | Returns `{ data: [], total: 0 }` (deleted rows are invisible) |
| E3 | `list()` with mix of active and soft-deleted | Returns only active rows; total count excludes deleted |
| E4 | `getTotalIncome()` with no transactions | Returns "0.00" (Decimal string) |
| E5 | `getTotalIncome()` with one active and one soft-deleted transaction of 100 each | Returns "100.00", not "200.00" |
| E6 | `getTotalIncome()` with amounts 0.1 and 0.2 (decimal precision edge case) | Returns "0.30" exactly (never "0.30000000000000004") |
| E7 | `getTotalIncome()` with amount 1234567.89 | Returns "1234567.89" exactly after SUM |
| E8 | `getTotalIncome()` with amounts summing to a Decimal with >2 decimal places (e.g., 0.015 * 100) | If schema allows only 2dp, sum is exact; if edge case occurs, test state expected |
| E9 | `getCategoryUsageCount(categoryId)` for a category with 3 transactions, 1 of which is soft-deleted | Returns 2 (deleted not counted) |
| E10 | `getCategoryUsageCount(categoryId)` for a non-existent category | Returns 0 |
| E11 | `findById(id)` for a soft-deleted transaction | Returns null (not the row) |
| E12 | `findByIdIncludeDeleted(id)` for a soft-deleted transaction | Returns the row including deletedAt and deletedById |
| E13 | `findById()` with invalid ID format | Returns null |
| E14 | `update(id, ...)` on a soft-deleted transaction | Fails; returns null or throws (state explicitly) |
| E15 | `update(id, ...)` with only some fields (partial update) | Updates only the provided fields; sets updatedById and updatedAt |
| E16 | `softDelete(id, userId)` on already-deleted transaction | Fails; returns null or throws (state explicitly) |
| E17 | `softDelete(id, userId)` on an active transaction | Succeeds; returns the full row before deletion; deletedAt and deletedById are set |
| E18 | `restore(id, userId)` on an active transaction | Fails; cannot restore a non-deleted row |
| E19 | `restore(id, userId)` on a soft-deleted transaction | Succeeds; clears deletedAt and deletedById, sets updatedAt |
| E20 | Two concurrent `list()` calls with the same filters | Both return the same data (snapshot isolation) |
| E21 | `list()` filtered by type=INCOME | Returns only INCOME transactions (active, deleted excluded) |
| E22 | `list()` filtered by categoryId | Returns only transactions with that categoryId (active, deleted excluded) |
| E23 | `list()` filtered by dateRange [2026-01-01, 2026-12-31] | Returns only transactions with occurredOn in that range (active only) |
| E24 | `list()` with sort=date, order=desc | Results ordered by occurredOn DESC (most recent first) |
| E25 | `list()` with sort=amount, order=asc | Results ordered by amount ASC |
| E26 | `list()` with page=2, limit=25 | Returns rows 26–50; total is count of ALL matching rows (not just this page) |
| E27 | `create()` with amount 99999999999.99 | Stores exact value; no truncation or rounding |
| E28 | `create()` and then `update()` same transaction | Old updatedById is null; after update, updatedById = userId, updatedAt is new timestamp |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `transactionRepository › create › inserts a row` | After create, findById returns the row with the correct values |
| T2 | integration | `transactionRepository › create › returns id, createdAt, updatedAt` | create() response includes all fields |
| T3 | integration | `transactionRepository › findById › returns active transaction` | findById returns row if deletedAt is null |
| T4 | integration | `transactionRepository › findById › returns null for deleted transaction` | After softDelete, findById(id) returns null |
| T5 | integration | `transactionRepository › findByIdIncludeDeleted › returns deleted transaction` | After softDelete, findByIdIncludeDeleted(id) returns the row with deletedAt set |
| T6 | integration | `transactionRepository › list › returns active only` | Seed 1 active, 1 soft-deleted; list returns data.length = 1 and total = 1 |
| T7 | integration | `transactionRepository › list › empty database` | list returns { data: [], total: 0 } |
| T8 | integration | `transactionRepository › list › pagination` | Seed 50 rows; list(page=1, limit=25) returns 25 rows and total=50; list(page=2) returns rows 26–50 |
| T9 | integration | `transactionRepository › list › filter by type INCOME` | Seed 2 INCOME, 2 EXPENSE; list(type=INCOME) returns 2 rows |
| T10 | integration | `transactionRepository › list › filter by categoryId` | Seed 3 transactions in category A, 2 in B; list(categoryId=A) returns 3 rows |
| T11 | integration | `transactionRepository › list › filter by date range` | Seed transactions on 2026-01-01, 2026-06-15, 2026-12-31; list(from=2026-01-01, to=2026-06-30) returns 2 rows |
| T12 | integration | `transactionRepository › list › sort by date descending` | Seed dates 2026-01-01, 2026-06-15, 2026-12-31; list(sort=date, order=desc) returns 2026-12-31, 2026-06-15, 2026-01-01 |
| T13 | integration | `transactionRepository › list › sort by amount ascending` | Seed amounts 100, 50, 200; list(sort=amount, order=asc) returns 50, 100, 200 |
| T14 | integration | `transactionRepository › getTotalIncome › returns "0.00" for empty db` | getTotalIncome() returns "0.00" (string, not number) |
| T15 | integration | `transactionRepository › getTotalIncome › returns "100.00" for 1 transaction` | Seed 1 INCOME of 100; getTotalIncome() returns "100.00" |
| T16 | integration | `transactionRepository › getTotalIncome › excludes deleted transactions` | Seed 2 INCOME of 100 each, delete 1; getTotalIncome() returns "100.00", not "200.00" |
| T17 | integration | `transactionRepository › getTotalIncome › handles decimal precision (0.1 + 0.2)` | Seed INCOME of 0.1 and 0.2; getTotalIncome() returns "0.30" (exact string) |
| T18 | integration | `transactionRepository › getTotalIncome › handles large amounts` | Seed INCOME of 1234567.89; getTotalIncome() returns "1234567.89" (exact string) |
| T19 | integration | `transactionRepository › getTotalExpenses › returns "0.00" for empty db` | getTotalExpenses() returns "0.00" |
| T20 | integration | `transactionRepository › getTotalExpenses › excludes deleted transactions` | Seed 2 EXPENSE of 50 each, delete 1; getTotalExpenses() returns "50.00" |
| T21 | integration | `transactionRepository › getTotalIncome › with filters (type, category, date)` | Seed mixed transactions; getTotalIncome(type=INCOME, categoryId=X, dateFrom, dateTo) returns correct filtered sum |
| T22 | integration | `transactionRepository › getCategoryUsageCount › returns count of active transactions` | Seed 3 transactions in category; getCategoryUsageCount(categoryId) returns 3 |
| T23 | integration | `transactionRepository › getCategoryUsageCount › excludes deleted transactions` | Seed 3 transactions, delete 1; getCategoryUsageCount(categoryId) returns 2 |
| T24 | integration | `transactionRepository › getCategoryUsageCount › returns 0 for non-existent category` | getCategoryUsageCount("nonexistent") returns 0 |
| T25 | integration | `transactionRepository › update › modifies fields and sets updatedById` | Seed transaction; update(id, { amount: "200.00" }, userId); findById returns new amount and updatedById set |
| T26 | integration | `transactionRepository › update › fails on soft-deleted transaction` | Seed and delete transaction; update(id, ...) returns null or throws |
| T27 | integration | `transactionRepository › update › returns old and new row for audit` | update() response includes before and after states |
| T28 | integration | `transactionRepository › softDelete › marks row as deleted` | Seed transaction; softDelete(id, userId); findById(id) returns null; findByIdIncludeDeleted returns deletedAt set |
| T29 | integration | `transactionRepository › softDelete › fails on already-deleted transaction` | Seed and delete; softDelete(id, userId) again returns null or throws |
| T30 | integration | `transactionRepository › softDelete › returns the row before deletion` | softDelete() response includes the transaction data for audit |
| T31 | integration | `transactionRepository › restore › clears deletedAt and deletedById` | Seed and delete; restore(id, userId); findById(id) returns the row with deletedAt=null |
| T32 | integration | `transactionRepository › restore › fails on active transaction` | Seed active transaction; restore(id, userId) returns null or throws |
| T33 | integration | `transactionRepository › getDeletedTransactions › returns only deleted transactions` | Seed 2 active, 2 deleted; getDeletedTransactions() returns 2 rows |
| T34 | integration | `transactionRepository › getDeletedTransactions › empty if none deleted` | Seed only active; getDeletedTransactions() returns [] |

**Red gate:** Every test above is written and failing. Commit the failing tests before implementing the repository.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.
- [ ] Integration tests run against a real PostgreSQL instance (Testcontainers, or a disposable docker-compose service).

## Implementation notes

**File to create:** `lib/repositories/transactionRepository.ts`

**Approach:**
- Create a Prisma-based repository module.
- Every query that reads transactions must include `where: { deletedAt: null }` at the Prisma query layer.
- For aggregation (getTotalIncome, getTotalExpenses), use `prisma.transaction.aggregate()` with `_sum: { amount: true }` and the deletedAt filter.
- Return aggregated amounts as Decimal strings (use `.toString()` on Prisma Decimal objects), never as numbers.
- For `findById` / `list`, use Prisma's `findUnique`, `findMany` with select/include to avoid N+1.
- For `update`, use `prisma.transaction.update()` and also return the previous state (fetch before update or use `select: { before: true }`).
- For `softDelete` and `restore`, use `update()` with `data: { deletedAt: new Date(), deletedById: userId }` or `data: { deletedAt: null, deletedById: null }`.
- Pagination support: `skip` and `take` on `findMany`.
- Search support (for description/category name match in `list`): TBD if included in M3-02 or deferred to M4; ticket should state this decision.

**Indexes:** The data model (§6) includes three indexes on Transaction: `[deletedAt, occurredOn]`, `[deletedAt, type, occurredOn]`, `[deletedAt, categoryId]`. Repository queries should leverage these.

**No N+1:** Every method that returns a transaction or list must use Prisma `select` or `include` to fetch relations in one query, not separate queries for category.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side data access layer established and tested
- [ ] Every read filters `deletedAt: null` via Prisma where clause
- [ ] All aggregation uses PostgreSQL SUM, not Node loops
- [ ] Amounts returned as Decimal strings, never JS numbers
- [ ] Every test asserting money uses exact string comparison, not float equality
- [ ] No N+1 queries — uses `select`/`include` for relations
- [ ] Integration tests run on real Postgres (not mocked)
- [ ] At least one test seeds a soft-deleted row and asserts it is excluded from every query
- [ ] No unused variables or dead code
- [ ] No secrets or amounts in logs (NFR-8)
- [ ] Reviewed by review-agent
