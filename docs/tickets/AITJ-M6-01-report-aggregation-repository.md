# AITJ-M6-01 — Report aggregation repository with category breakdowns

| Field | Value |
|---|---|
| Milestone | M6 — Reports |
| Depends on | AITJ-M5-02, AITJ-M3-02 |
| Blocks | AITJ-M6-02, AITJ-M6-03, AITJ-M6-04, AITJ-M6-05 |
| PRD refs | FR-R2, FR-R3, FR-R4, FR-R8, §8.3, §6.1 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

The dashboard (M5-02) and transaction-list header (M4) already compute period totals: total income, total expenses, and net balance. Reports must show the same totals *identically* (§8.3) plus category-wise breakdowns — income grouped by category and expenses grouped by category. Every aggregate must be computed by SQL `SUM` with `deletedAt IS NULL` filtering, never by fetching rows and summing in Node. Categories with zero activity in the period must be omitted from the breakdown (FR-R8), but archived categories with historical transactions in the period must still appear (FR-C7).

## Acceptance criteria

- [ ] AC1 — A new repository method `getReportAggregates(period: { from, to })` returns `{ totalIncome, totalExpenses, netBalance, incomeBreakdown, expenseBreakdown }` as exact `Decimal` strings
- [ ] AC2 — `incomeBreakdown` is an array of `{ categoryId, categoryName, type, count, amount, percentOfTotal }`, sorted by amount descending, omitting categories with zero transactions in the period
- [ ] AC3 — `expenseBreakdown` has the same structure for EXPENSE type
- [ ] AC4 — Archived income categories with transactions in the period appear in `incomeBreakdown`; archived expense categories appear in `expenseBreakdown`; archived categories with zero activity are omitted (FR-C7 + FR-R8)
- [ ] AC5 — A period with zero transactions returns `{ totalIncome: "0.00", totalExpenses: "0.00", netBalance: "0.00", incomeBreakdown: [], expenseBreakdown: [] }`
- [ ] AC6 — All amounts are `Decimal` objects converted to exact decimal strings (e.g. `"1234.56"`), never rounded or floated
- [ ] AC7 — Soft-deleted transactions (with `deletedAt IS NOT NULL`) are excluded from all totals and breakdowns
- [ ] AC8 — Percentage calculations (`amount / (category type total) * 100`) are performed in SQL; the result is returned as a numeric value, not pre-formatted

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Period with zero transactions | All totals ₹0.00, both breakdowns empty arrays |
| E2 | Period with income but no expenses (and vice versa) | Total expenses ₹0.00, expense breakdown empty; net == income |
| E3 | Period where expenses exceed income | Negative net balance as exact decimal string, e.g. `"-500.00"` |
| E4 | All transactions in period are soft-deleted | Treated as zero-transaction period; all totals ₹0.00, empty breakdowns |
| E5 | Boundary transaction exactly on from-date (midnight IST) | Included in period totals and breakdown |
| E6 | Boundary transaction exactly on to-date (23:59:59 IST) | Included in period totals and breakdown |
| E7 | Boundary transaction one day before from-date | Excluded from period; belongs to opening balance (M6-02) |
| E8 | Category with transactions before period, none during, and none after | Appears in breakdown for periods that contain its transactions; omitted from periods that do not |
| E9 | Two categories: income "Other" and expense "Other" (allowed by FR-C6) | Both appear in their respective sections; never merged |
| E10 | Decimal precision: SUM of breakdown amounts must equal total | Tested at the row level; no rounding drift |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `reportRepository > getReportAggregates returns totals as exact decimal strings` | Given 3 income and 2 expense transactions within a period, `getReportAggregates()` returns `totalIncome`, `totalExpenses`, and `netBalance` as `Decimal` objects that serialize to exact strings (e.g. `"5000.00"`) and no floating-point drift |
| T2 | integration | `reportRepository > income breakdown sums to total income` | Given period with income transactions in multiple categories, sum of all `incomeBreakdown[*].amount` equals `totalIncome` as exact decimal |
| T3 | integration | `reportRepository > expense breakdown sums to total expenses` | Given period with expense transactions in multiple categories, sum of all `expenseBreakdown[*].amount` equals `totalExpenses` as exact decimal |
| T4 | integration | `reportRepository > breakdown omits categories with zero activity in period` | Given 2 categories with activity (e.g. Donation and Zakat), and 1 category with zero transactions (Other), breakdown includes only the active two, omits Other |
| T5 | integration | `reportRepository > breakdown includes archived categories with activity in period` | Given an archived category (e.g. `Electricity`, `isArchived: true`) with one transaction in the period, breakdown includes it |
| T6 | integration | `reportRepository > breakdown omits archived categories with zero activity in period` | Given an archived category with zero transactions in the period, breakdown does not include it |
| T7 | integration | `reportRepository > soft-deleted transactions excluded from totals` | Given 1 income and 1 expense both non-deleted, plus 1 income and 1 expense both soft-deleted in the period, totals reflect only the non-deleted rows; breakdown counts and sums exclude soft-deleted |
| T8 | integration | `reportRepository > zero-transaction period returns empty breakdown` | Given a period with no transactions, `getReportAggregates()` returns `{ totalIncome: "0.00", totalExpenses: "0.00", netBalance: "0.00", incomeBreakdown: [], expenseBreakdown: [] }` (not null or undefined) |
| T9 | integration | `reportRepository > two categories same name different types do not merge` | Given income "Other" and expense "Other" each with transactions in the period, both appear in their respective sections with distinct entries |
| T10 | unit | `reportRepository > percentage calculation with zero denominator` | Calling `getReportAggregates()` on a period with zero income must not throw or return `Infinity` / `NaN` for percentage; the test specifies expected output once the behaviour is decided (e.g. numeric value or em-dash indicator) |
| T11 | integration | `reportRepository > period boundary: from-date inclusive` | Given transaction dated exactly on from-date (00:00 IST), it is included in period totals and breakdown |
| T12 | integration | `reportRepository > period boundary: to-date inclusive` | Given transaction dated exactly on to-date, it is included in period totals and breakdown |
| T13 | integration | `reportRepository > period boundary: day before from-date excluded` | Given transaction dated one day before from-date, it is excluded from the period (not in totals or breakdown) |
| T14 | integration | `reportRepository > breakdown sorted by amount descending` | Given multiple categories with different totals, `incomeBreakdown` and `expenseBreakdown` are sorted by `amount` descending |
| T15 | integration | `reportRepository > category count is distinct transaction count in period` | Given 3 transactions in category A and 2 in category B (all in period), breakdown shows `count: 3` for A and `count: 2` for B |

**Red gate:** all 15 tests written and failing. Commit the failing tests before implementing.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Repository layer** (`lib/repositories/report.ts`):
- New file or extend existing aggregation repository from M5-02
- Method `getReportAggregates(period: { from: Date, to: Date })`
- SQL queries:
  - `SELECT SUM(amount) FROM transactions WHERE type='INCOME' AND deletedAt IS NULL AND occurredOn >= from AND occurredOn <= to`
  - `SELECT SUM(amount) FROM transactions WHERE type='EXPENSE' AND deletedAt IS NULL AND occurredOn >= from AND occurredOn <= to`
  - For each breakdown:
    ```sql
    SELECT 
      categoryId, 
      category.name, 
      category.type, 
      COUNT(*) as count, 
      SUM(amount) as amount,
      (SUM(amount) / NULLIF(total_for_type, 0)) * 100 as percentOfTotal
    FROM transactions
    JOIN category ON transactions.categoryId = category.id
    WHERE deletedAt IS NULL 
      AND occurredOn >= from 
      AND occurredOn <= to
      AND type = 'INCOME' (or 'EXPENSE')
      AND (NOT category.isArchived OR COUNT(*) > 0)
    GROUP BY categoryId, category.name, category.type
    HAVING COUNT(*) > 0
    ORDER BY amount DESC
    ```
  - Coalesce `SUM(amount)` to `0` to handle zero-transaction case
  - Convert all `Decimal` results to strings via `.toString()`

**Return type** (in `lib/types/report.ts` or similar):
```typescript
interface ReportAggregates {
  totalIncome: string;        // decimal string, e.g. "5000.00"
  totalExpenses: string;
  netBalance: string;
  incomeBreakdown: CategoryBreakdown[];
  expenseBreakdown: CategoryBreakdown[];
}

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  type: TransactionType;
  count: number;
  amount: string;             // decimal string
  percentOfTotal: number;     // or string if em-dash is chosen
}
```

**Reuse from M5-02:**
- This ticket extends, not replaces, the aggregation work from M5-02 (dashboard totals)
- The same `totalIncome`, `totalExpenses` logic must be shared; verify the dashboard calls the same repository method for its headline cards
- If M5-02 has a `getPeriodTotals(period)` method, `getReportAggregates` calls it internally and adds category breakdowns

**Integration test setup:**
- Seed 4–5 transactions (mix of income/expense, multiple categories) within a test period
- Seed 1–2 soft-deleted transactions in the same period to assert they are excluded
- Seed 1 transaction before and 1 after the period to assert boundaries
- Run real PostgreSQL (Testcontainers or docker-compose test instance)

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Repository method is called by M6-03 page and M6-05 export route
- [ ] Dashboard (from M5) and reports call the same `getReportAggregates` or shared sub-methods for totals (audit that they agree on a test dataset)
- [ ] Server-side aggregation (SQL SUM) used throughout; no JS summation of rows
- [ ] Every read filters `deletedAt: null` via the repository layer
- [ ] Decimal strings returned, not floats; no rounding in the repository
- [ ] No N+1 queries — single query per breakdown section (use `include` or appropriate join)
- [ ] No unused variables, imports, or dead code
- [ ] No amounts or sensitive data in logs
- [ ] Reviewed by review-agent → QA signed off
