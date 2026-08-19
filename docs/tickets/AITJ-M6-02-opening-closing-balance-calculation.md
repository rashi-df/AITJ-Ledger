# AITJ-M6-02 — Opening and closing balance calculation

| Field | Value |
|---|---|
| Milestone | M6 — Reports |
| Depends on | AITJ-M6-01, AITJ-M5-02 |
| Blocks | AITJ-M6-03, AITJ-M6-05 |
| PRD refs | FR-R5, §6.1, A2 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

A report must reconcile — closing balance equals opening balance plus the net balance for the period (FR-R5). The opening balance is the sum of all transactions *before* the period start date; the closing balance is opening plus period net. This reconciliation is the first line of defence against arithmetic errors in the ledger. The calculation must be exact (decimal precision, never floating point), boundaries must be computed in IST (A2), and soft-deleted transactions must be excluded from all components.

## Acceptance criteria

- [ ] AC1 — A repository method `getOpeningBalance(beforeDate: Date)` returns the sum of all non-deleted income minus all non-deleted expenses occurring strictly before the `beforeDate` as an exact `Decimal` string
- [ ] AC2 — Opening balance for a period with no prior transactions is `"0.00"`, not `null` or `undefined`
- [ ] AC3 — A method `getClosingBalance(period: { from, to })` returns opening balance + period net balance as an exact `Decimal` string
- [ ] AC4 — The closing balance of period N equals the opening balance of period N+1 (reconciliation test)
- [ ] AC5 — For an all-time period (from 1 Jan 2000 to today), opening balance is `"0.00"` and closing balance equals the all-time balance from FR-D5
- [ ] AC6 — A period with zero net (income == expenses) has closing balance == opening balance
- [ ] AC7 — A period with negative net (expenses > income) has negative closing balance; this is clearly displayed without error (FR-D4)
- [ ] AC8 — Boundaries are computed in IST (A2): a transaction at 23:50 IST on the last day of the period is included in the opening balance calculation for the next period, not the current one
- [ ] AC9 — Soft-deleted transactions are excluded from opening, net, and closing balance calculations

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Opening balance when no transactions exist before the period start | `"0.00"`, coalesced from SQL `SUM(NULL)` |
| E2 | Opening balance for the earliest possible period (period.from = 2000-01-01) | `"0.00"`, no prior transactions |
| E3 | Period boundary: transaction exactly on from-date (00:00 IST) | Included in period net; not in opening |
| E4 | Period boundary: transaction exactly on to-date (23:59:59 IST or technically 00:00 next day in UTC) | Included in period net; not in closing calculation of next period |
| E5 | Period where all transactions are deleted | Opening = non-deleted sum before period, Net = 0, Closing = Opening (unchanged) |
| E6 | Crossing year boundary: period from Dec 2025 to Jan 2026 in IST | Boundaries are IST dates, not UTC; transaction at 23:50 IST Dec 31 is in period; transaction at 00:10 UTC Jan 1 (= 05:40 IST) is in period |
| E7 | Negative period balance (expenses exceed income) | Closing balance < opening balance; represented as negative decimal string, e.g. `"-500.00"` |
| E8 | Very large opening balance near max `DECIMAL(14,2)` | No overflow; decimal precision maintained |
| E9 | Multiple transactions on same date before period start | All summed correctly into opening balance |
| E10 | Closing balance calculation chain: Period A's closing == Period B's opening (sequential periods) | Assertion test verifies this holds exactly |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `openingBalance > calculates sum of income and expenses before period start` | Given transactions before a period start (e.g. Jan 1–5 before a Feb 1–28 period), `getOpeningBalance(Feb 1)` returns exact decimal string of (income before - expenses before) |
| T2 | integration | `openingBalance > returns "0.00" when no prior transactions` | Given a period with no transactions before it, `getOpeningBalance(period.from)` returns `"0.00"`, not null |
| T3 | integration | `openingBalance > excludes soft-deleted transactions` | Given 2 income before period (1 non-deleted, 1 deleted), opening balance reflects only the non-deleted one |
| T4 | integration | `openingBalance > excludes transactions on or after the date` | Given a transaction exactly on the boundary date, it is not included in opening; verify with `getOpeningBalance(txn.occurredOn)` |
| T5 | integration | `closingBalance > equals opening + period net` | Given opening balance and a period's calculated net, closing balance equals opening + net (decimal arithmetic) |
| T6 | integration | `closingBalance > for all-time period, closing is all-time balance` | Given from: 2000-01-01, to: today (or max future date), closing equals sum of all income - all expenses (all-time balance) |
| T7 | integration | `closingBalance > for all-time period, opening is zero` | All-time period opening is `"0.00"` |
| T8 | integration | `closingBalance > sequential period reconciliation` | Given two sequential periods (Period A: Jan 1–31, Period B: Feb 1–28), Period A's closing == Period B's opening (exact decimal match) |
| T9 | integration | `closingBalance > negative net produces negative closing if it exceeds opening` | Given opening balance `"100.00"` and period net of `"-200.00"`, closing is `"-100.00"` (exact decimal string) |
| T10 | integration | `closingBalance > zero period net: closing equals opening` | Given period with equal income and expenses (net = 0), closing == opening |
| T11 | integration | `balance > boundary: transaction on to-date is included in period net` | Transaction dated exactly on to-date is counted in period net (closing = opening + net reflects this) |
| T12 | integration | `balance > boundary: transaction day before from-date is in opening, not period` | Transaction dated one day before from-date is in opening balance, not in period net |
| T13 | integration | `balance > soft-deleted in period affects closing` | Given opening and a period with 1 deleted and 1 non-deleted net income, closing = opening + (non-deleted net only) |
| T14 | unit | `balance > IST date boundary handling` | A transaction dated at 23:50 IST on the to-date is included in the period (test verifies date comparison uses IST, not UTC) — may require a mock of the current timezone or a test that seeds at a specific timestamp |
| T15 | integration | `balance > reconciliation across year boundary` | Period from Dec 2025 to Jan 2026 correctly includes transactions on both sides in IST, closing of Dec period == opening of Jan period |

**Red gate:** all 15 tests written and failing. Commit the failing tests before implementing.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Repository layer** (`lib/repositories/report.ts` or existing aggregation):
- Method `getOpeningBalance(beforeDate: Date): Promise<string>`
  - SQL: `SELECT SUM(amount) FROM transactions WHERE type='INCOME' AND deletedAt IS NULL AND occurredOn < beforeDate UNION SELECT -SUM(amount) FROM transactions WHERE type='EXPENSE' AND deletedAt IS NULL AND occurredOn < beforeDate`
  - Or more efficiently: `SELECT SUM(CASE WHEN type='INCOME' THEN amount ELSE -amount END) FROM transactions WHERE deletedAt IS NULL AND occurredOn < beforeDate`
  - Coalesce result to `Decimal(0, 2)`, convert to string
  - `beforeDate` should be a `Date` object (calendar date, per A5)

- Method `getClosingBalance(period: { from: Date, to: Date }): Promise<string>`
  - Call `getOpeningBalance(period.from)` to get opening
  - Call `getReportAggregates(period)` to get `totalIncome`, `totalExpenses`
  - Calculate net = totalIncome - totalExpenses
  - Closing = opening + net (all Decimal arithmetic)
  - Return as string

**Reconciliation helper** (for testing):
- Unit test verifies that `getClosingBalance(periodA)` == `getOpeningBalance(periodB.from)` when periodA.to == periodB.from - 1 day
- This test asserts the fundamental invariant: "the closing balance of a period is the opening balance of the next period"

**IST date handling:**
- `beforeDate` parameter is a calendar `Date` object representing a day in IST (e.g., 2024-02-01)
- SQL comparison `occurredOn < beforeDate` works directly on the DATE column (A5)
- No timezone conversion is needed in the repository; the date has already been computed in IST by the caller (the period engine from M5-01)
- If a test needs to verify "23:50 IST on the last day of the period", it should:
  - Create a transaction with `occurredOn: lastDayOfPeriod` (a DATE, no time)
  - Seed that transaction
  - Verify it is counted in the period's net, not in opening or closing of next period

**Decimal handling:**
- All balance calculations use `Decimal` from Prisma; store intermediate results as `Decimal`
- Convert to string only at the return boundary
- Example: `const opening = Decimal(...); const net = Decimal(...); const closing = opening.plus(net); return closing.toString();`

**Integration test setup:**
- Seed transactions with various dates: before period, on boundaries, after period
- Include soft-deleted transactions to assert they are excluded
- Run against real PostgreSQL

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Opening and closing balance methods are called by M6-03 page and M6-05 export
- [ ] Reconciliation test passes: Period N closing == Period N+1 opening
- [ ] All balances computed in SQL, never in Node
- [ ] Decimal precision maintained; no floating-point arithmetic
- [ ] Every read filters `deletedAt: null`
- [ ] Boundaries correctly exclude/include transactions (from-date inclusive, to-date inclusive)
- [ ] IST date boundaries respected (tested against real date column)
- [ ] No N+1 queries
- [ ] No secrets or amounts in logs
- [ ] Reviewed by review-agent → QA signed off
