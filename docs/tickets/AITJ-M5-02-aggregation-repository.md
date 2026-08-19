# AITJ-M5-02 — Aggregation repository for period totals and balance

| Field | Value |
|---|---|
| Milestone | M5 — Dashboard |
| Depends on | AITJ-M3-02, AITJ-M5-01 |
| Blocks | AITJ-M5-03, AITJ-M5-05, AITJ-M5-06, M6 (Reports) |
| PRD refs | FR-D1, FR-D2, FR-L9, FR-R2, §8.3, §6.1, A6, A10 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

The dashboard headline cards, transaction-list header, and reports all need the same computed totals: total income, total expenses, and current balance for a period. To guarantee they never disagree (§8.3), these totals are computed by a single set of repository methods that perform SQL aggregation in Postgres, never by fetching rows into Node and summing them. Every query must exclude soft-deleted rows (`WHERE deletedAt IS NULL`). Amounts are always positive (A10), stored as `DECIMAL(14,2)` (A6), and balance is computed as Income − Expenses. Empty periods must return ₹0.00 for all three totals, never null or NaN.

## Acceptance criteria

- [ ] AC1 — Repository method `getPerioTotals(from: Date, to: Date): Promise<{income: string, expenses: string, balance: string}>` returns exact decimal strings (never floats)
- [ ] AC2 — All three totals are computed via SQL `SUM` in a single Postgres query, never multiple queries or row fetching
- [ ] AC3 — Query filters `deletedAt IS NULL` and the date range as `occurredOn >= from AND occurredOn <= to` (inclusive both ends, per A5)
- [ ] AC4 — Empty period (no transactions in range) returns `{income: "0.00", expenses: "0.00", balance: "0.00"}`, never null
- [ ] AC5 — Negative balance (expenses > income) is computed and returned as a negative string, e.g., `"-5000.00"`; it is not treated as an error
- [ ] AC6 — Decimal arithmetic is precise: `SUM` in Postgres with Decimal(14,2) columns, then converted to ISO string on return
- [ ] AC7 — Method is query-efficient: one query, no N+1, no row fetching
- [ ] AC8 — The same repository method is called by the dashboard card Server Component, the transaction-list header, and the report Server Component — no duplication

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Period with zero transactions | Returns `{income: "0.00", expenses: "0.00", balance: "0.00"}` |
| E2 | Period with only income, no expenses | Returns `{expenses: "0.00", balance: equal to income}` |
| E3 | Period with only expenses, no income | Returns `{income: "0.00", balance: negative}` |
| E4 | Expenses exceed income (negative balance) | Balance is a negative string, e.g., `"-1500.50"` |
| E5 | Period includes soft-deleted transactions | Deleted rows are excluded from all totals |
| E6 | Single transaction in period | Correctly aggregates one row |
| E7 | Many transactions (1000+) in period | Handles large aggregations; decimal precision is maintained |
| E8 | Precision: many small decimals summing to a whole | E.g., 1000 × `₹0.01` sums to `"10.00"`, not float drift |
| E9 | Precision: recurring decimal | E.g., 3 × `₹33.33` = `"99.99"`, exact string |
| E10 | Max amount transaction `₹99,99,99,999.99` | Aggregates without overflow |
| E11 | Period boundary: from and to are the same day | Correctly sums all transactions on that day |
| E12 | Period boundary: transactions on `from` date | Included in totals (inclusive) |
| E13 | Period boundary: transactions on `to` date | Included in totals (inclusive) |
| E14 | All-time totals (earliest to latest date in database) | Computed correctly as period boundaries expand |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `getPerioTotals > empty period > returns zero totals` | After seeding zero transactions in range, `getPerioTotals(from, to)` returns `{income: "0.00", expenses: "0.00", balance: "0.00"}` |
| T2 | integration | `getPerioTotals > only income > balance equals income` | Seed one income transaction ₹1000.00, zero expenses, `balance` equals `"1000.00"` |
| T3 | integration | `getPerioTotals > only expenses > balance negative` | Seed one expense ₹1500.00, zero income, `balance` equals `"-1500.00"` |
| T4 | integration | `getPerioTotals > expenses exceed income > negative balance` | Seed income ₹500.00 and expense ₹2000.00, `balance` equals `"-1500.00"` |
| T5 | integration | `getPerioTotals > soft-deleted excluded` | Seed one income ₹1000.00 (not deleted), one income ₹500.00 (soft-deleted), totals reflect only ₹1000.00 |
| T6 | integration | `getPerioTotals > single transaction` | Seed one ₹750.50 income, returns `{income: "750.50", expenses: "0.00", balance: "750.50"}` |
| T7 | integration | `getPerioTotals > many transactions 1000+ rows` | Seed 1000 transactions (mix of types), aggregates correctly |
| T8 | integration | `getPerioTotals > decimal precision 0.01 accumulation` | Seed 100 transactions of ₹10.01 each, total is exactly `"1001.00"` (not float drift) |
| T9 | integration | `getPerioTotals > decimal precision recurring thirds` | Seed 3 × ₹33.33 = exactly `"99.99"`, not ₹99.98 or ₹100.00 |
| T10 | integration | `getPerioTotals > max amount transaction` | Seed one ₹99,99,99,999.99 income, returns exact string with no overflow |
| T11 | integration | `getPerioTotals > period from == to same day` | Seed two transactions on 2026-08-15, one on 2026-08-16; from==to==2026-08-15 returns only the first two |
| T12 | integration | `getPerioTotals > boundary from date inclusive` | Seed transaction on `from` date, it is included in totals |
| T13 | integration | `getPerioTotals > boundary to date inclusive` | Seed transaction on `to` date, it is included in totals |
| T14 | integration | `getPerioTotals > query count is one` | Verify via query profiling or mock spy that only one SQL query is issued (no N+1) |
| T15 | integration | `getPerioTotals > all-time totals over entire database` | Expand period to cover all data, returns sum of all non-deleted transactions |

**Red gate:** Every test above is written and fails for the right reason (missing function or assertion failure). Commit the failing tests before writing implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**File:** `lib/repositories/transactionRepository.ts` (extends existing or creates new)

**Method signature:**
```typescript
export async function getPerioTotals(
  from: Date,
  to: Date
): Promise<{ income: string; expenses: string; balance: string }>
```

**Approach:**
- Use `prisma.$queryRaw` to execute a single SQL query:
  ```sql
  SELECT
    COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) as income,
    COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) as expenses
  FROM "Transaction"
  WHERE "deletedAt" IS NULL
    AND "occurredOn" >= $1::date
    AND "occurredOn" <= $2::date
  ```
- Coalesce the SUM results to `0` so empty periods return `0` not `NULL`
- On return, compute `balance = income - expenses` and convert both to ISO decimal strings
- Use Prisma's `Decimal` type to ensure precision; convert to string via `.toString()`

**Tests** (`lib/repositories/__tests__/transactionRepository.test.ts`):
- Integration tests against a real test Postgres instance (Testcontainers or disposable compose service)
- Seed transactions with known amounts in a transaction
- Call the method
- Assert the returned strings match expectations exactly
- Include at least one soft-deleted row per test to verify `deletedAt IS NULL` filtering
- For precision tests, use amounts like ₹0.01, ₹33.33 to catch float bugs

**Consumed by:**
- Dashboard Server Component (M5-03)
- Transaction list header Server Component (M4-03 or FR-L9)
- Reports Server Component (M6)

No client-side code calls this directly.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Repository method is a single SQL query, no N+1 or row fetching
- [ ] Returns exact decimal strings (never floats or rounded numbers)
- [ ] Empty periods return `"0.00"` not `null` or `NaN`
- [ ] Soft-deleted rows filtered via `deletedAt IS NULL` in the WHERE clause
- [ ] Date range boundaries are `>=` and `<=` (inclusive both ends)
- [ ] Integration tests run against a real Postgres, seeding and asserting on actual data
- [ ] Every test includes at least one soft-deleted row to verify filtering
- [ ] Negative balance is computed and returned correctly (not treated as an error)
- [ ] No N+1 queries — integration tests verify a single query is issued
- [ ] No unused variables, imports, or dead code
- [ ] No amounts, totals, or transaction details in logs (NFR-8)
