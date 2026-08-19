# AITJ-M2-01 — Category repository with type scoping and usage counts

| Field | Value |
|---|---|
| Milestone | M2 — Categories |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M0-06, AITJ-M0-07, AITJ-M1-01 |
| Blocks | AITJ-M2-02, AITJ-M2-03, AITJ-M2-04, AITJ-M2-05 |
| PRD refs | FR-C1, §6, §6.1, §8.2, §8.3, §13, NFR-2 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

The Category repository is the single point of all category data access (§8.2). It must enforce FR-C1 (categories belong to exactly one type: INCOME or EXPENSE), centralize the `deletedAt` filter for transactions, and provide efficient aggregation. The repository must compute transaction count and lifetime total per category in a single grouped SQL query, not in application code — violating this will be rejected in review (§8.3).

## Acceptance criteria

- [ ] AC1 — Repository exports `getCategoriesWithStats(type: TransactionType | "ALL")` returning `{ id, name, type, isArchived, transactionCount, lifetimeTotal, sortOrder, createdAt, updatedAt }[]`
- [ ] AC2 — Stats (count and total) are computed by PostgreSQL `GROUP BY`, excluding soft-deleted transactions, and returned in one query
- [ ] AC3 — `getCategoriesWithStats` sorts by `sortOrder ASC` then `name ASC`
- [ ] AC4 — A category with zero transactions shows `transactionCount: 0` and `lifetimeTotal: "0.00"` (string, not null or missing)
- [ ] AC5 — Repository exports `createCategory(name: string, type: TransactionType, sortOrder?: number)` creating a new Category and returning it
- [ ] AC6 — Repository exports `getCategoryById(id: string)` returning Category or null (throws if not found, per §8.2 pattern)
- [ ] AC7 — Repository exports `renameCategory(id: string, newName: string)` returning the updated Category
- [ ] AC8 — Repository exports `archiveCategory(id: string)` and `unarchiveCategory(id: string)` returning the updated Category
- [ ] AC9 — Repository exports `deleteCategory(id: string)` — succeeds only if transaction count is zero; throws if in use or not found
- [ ] AC10 — Repository exports `getTransactionCountForCategory(categoryId: string)` returning `number`

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | `getCategoriesWithStats("ALL")` | Returns categories of both types, mixed in output, sorted by sortOrder/name |
| E2 | `getCategoriesWithStats("INCOME")` | Returns only INCOME categories |
| E3 | Category with exactly one non-deleted transaction | `transactionCount: 1`, `lifetimeTotal` equals that transaction's amount |
| E4 | Category with one non-deleted and one soft-deleted transaction | `transactionCount: 1` (soft-deleted excluded) |
| E5 | Category with one transaction of amount `123.45`, one of `456.78` | `lifetimeTotal: "580.23"` (exact decimal, not float approximation) |
| E6 | `deleteCategory` called on a category with zero transactions | Succeeds and returns `{ success: true }` |
| E7 | `deleteCategory` called on a category in use (count > 0) | Throws `CategoryInUseError` with message "Cannot delete a category with transactions" |
| E8 | `deleteCategory` called on a category with only soft-deleted transactions | Throws `CategoryInUseError` (soft-deleted transactions still reference the category and may be restored per FR-C7) |
| E9 | Database `onDelete: Restrict` on category relation fires | Throws error; application layer should catch and present a user-friendly message (tested at integration level) |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | unit | `lib/repositories/category.test.ts > getCategoriesWithStats returns empty array when no categories` | Empty array returned; no crash on empty database |
| T2 | unit | `lib/repositories/category.test.ts > getCategoriesWithStats filters by type correctly` | INCOME query returns only INCOME; EXPENSE returns only EXPENSE; "ALL" returns both |
| T3 | integration | `lib/repositories/category.test.ts > getCategoriesWithStats computes count and total in one query` | Execute `getCategoriesWithStats` and assert query count = 1; use `jest.mock('lib/db')` or queryspy |
| T4 | integration | `lib/repositories/category.test.ts > getCategoriesWithStats excludes soft-deleted transactions` | Seed 2 transactions, soft-delete one, assert count=1 and total excludes the deleted row |
| T5 | integration | `lib/repositories/category.test.ts > getCategoriesWithStats returns exact decimal total` | Seed transactions `100.50 + 200.75`, assert `lifetimeTotal: "301.25"` (string, exact) |
| T6 | integration | `lib/repositories/category.test.ts > getCategoriesWithStats sorts by sortOrder then name` | Seed categories with different sortOrder; verify order matches expected |
| T7 | integration | `lib/repositories/category.test.ts > createCategory creates and returns new category` | Create category, assert id, name, type, isArchived=false, and retrievable by id |
| T8 | integration | `lib/repositories/category.test.ts > getCategoryById returns null for nonexistent id` | Call with fake id, assert null (per pattern in §8.2) |
| T9 | integration | `lib/repositories/category.test.ts > renameCategory updates name and returns it` | Create, rename, verify new name, confirm transactions still reference by id (latent test for M3) |
| T10 | integration | `lib/repositories/category.test.ts > archiveCategory sets isArchived=true` | Create, archive, retrieve, assert `isArchived: true` |
| T11 | integration | `lib/repositories/category.test.ts > unarchiveCategory sets isArchived=false` | Archive then unarchive, assert `isArchived: false` |
| T12 | integration | `lib/repositories/category.test.ts > archiveCategory is idempotent` | Archive already-archived category; no error; returned category unchanged |
| T13 | integration | `lib/repositories/category.test.ts > unarchiveCategory is idempotent` | Unarchive non-archived category; no error; returned category unchanged |
| T14 | integration | `lib/repositories/category.test.ts > deleteCategory succeeds with zero transactions` | Create category with zero transactions; delete succeeds; category not retrievable |
| T15 | integration | `lib/repositories/category.test.ts > deleteCategory throws if transaction count > 0` | Create category, create transaction referencing it, attempt delete, throws `CategoryInUseError` |
| T16 | integration | `lib/repositories/category.test.ts > deleteCategory throws if soft-deleted transaction references it` | Create transaction, soft-delete it, attempt to delete category, throws `CategoryInUseError` |
| T17 | integration | `lib/repositories/category.test.ts > getTransactionCountForCategory returns zero for unused category` | Create category, call method, returns `0` |
| T18 | integration | `lib/repositories/category.test.ts > getTransactionCountForCategory excludes soft-deleted` | Create transaction, soft-delete it, call method, returns `0` |

**Red gate:** All 18 tests written, failing for the right reason (missing module `lib/repositories/category`, missing function, or assertion failure). Commit failing tests before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**File: `lib/repositories/category.ts`** — new file

- Create `CategoryRepository` class or export functions directly (per project pattern in M1 repository)
- Implement `getCategoriesWithStats` using Prisma `findMany` with a `select` that includes `_count` on the relation and `_sum` on amount:
  ```
  prisma.category.findMany({
    where: { type: value, ... },
    select: {
      id: true, name: true, type: true, isArchived: true, sortOrder: true, createdAt: true, updatedAt: true,
      _count: { select: { transactions: { where: { deletedAt: null } } } },
      _sum: { select: { transactions: { where: { deletedAt: null } } } }
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  })
  ```
  Map the result to include `transactionCount` (from `_count.transactions`) and `lifetimeTotal` (from `_sum.transactions.amount`, formatted as string "X.XX")
- Implement remaining CRUD methods: `createCategory`, `getCategoryById`, `renameCategory`, `archiveCategory`, `unarchiveCategory`, `deleteCategory`, `getTransactionCountForCategory`
- For `deleteCategory`, use `getTransactionCountForCategory` first; if count > 0, throw custom error; else call `prisma.category.delete()`
- The database `onDelete: Restrict` will enforce FR-C7 at the schema level; catch the Prisma error if it fires and throw a domain error

**File: `lib/repositories/index.ts`** — export from category repository

**File: `lib/errors.ts`** — add `CategoryInUseError` class if not present

**Test setup:** Use Testcontainers or a disposable `docker-compose.test.yml` PostgreSQL service. Seed the test database with known categories and transactions before each test.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] `getCategoriesWithStats` executes exactly 1 query (verified in test T3)
- [ ] No N+1 queries in any method
- [ ] All aggregated amounts are Decimal strings (never floats), formatted to 2 decimal places
- [ ] Soft-deleted transactions excluded from all counts and totals
- [ ] Repository layer owns all Prisma access; no direct Prisma calls leak to actions
- [ ] Session assertion happens at the action layer (M2-02, not here)
- [ ] `onDelete: Restrict` is tested at integration level to prove database enforces FR-C7
- [ ] No secrets, passwords, or tokens in logs
- [ ] Reviewed by review-agent → QA signed off
