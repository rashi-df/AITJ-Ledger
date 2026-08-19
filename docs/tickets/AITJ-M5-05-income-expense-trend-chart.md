# AITJ-M5-05 — Income versus expense trend chart

| Field | Value |
|---|---|
| Milestone | M5 — Dashboard |
| Depends on | AITJ-M5-01, AITJ-M5-02, AITJ-M5-04 |
| Blocks | none |
| PRD refs | FR-D6, §8.1, §8.3, A2, A6, NFR-1, NFR-3, NFR-4 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

The dashboard displays a line or bar chart showing income and expenses over time within the selected period (FR-D6). For short periods (Today, This Week), the chart aggregates by IST date (daily granularity). For long periods (This Year, or Custom Range > 60 days), it aggregates by calendar month (monthly granularity) to avoid overcrowding and to maintain readability. The chart is a Recharts client component (§8.1) receiving a pre-aggregated data payload from the server (§8.3) — the server computes all buckets and sums in SQL, never shipping raw rows to the browser. Empty periods, single-bucket periods, and categories with zero activity in a bucket all render correctly without errors. The chart respects the dark/light theme and is accessible via keyboard.

## Acceptance criteria

- [ ] AC1 — Chart renders as a line or bar chart with two series: Income (blue/green) and Expenses (red/orange)
- [ ] AC2 — For periods ≤ 60 days, the chart aggregates daily (one data point per IST calendar date)
- [ ] AC3 — For periods > 60 days, the chart aggregates monthly (one data point per calendar month in IST)
- [ ] AC4 — Each data point shows the sum of income transactions and sum of expenses transactions for that bucket, formatted as INR
- [ ] AC5 — Server computes all aggregates in SQL; the browser receives only the pre-aggregated buckets, not raw transactions
- [ ] AC6 — Empty period (no transactions) renders a message or an empty chart with axis labels; does not crash
- [ ] AC7 — Single data point (e.g., one transaction) renders correctly
- [ ] AC8 — A category with zero activity in a bucket is omitted (not shown as ₹0.00 on the chart)
- [ ] AC9 — Soft-deleted transactions are excluded from the chart
- [ ] AC10 — Chart is responsive at 360px (vertical bar chart or small line chart) and 1920px (full-width line chart)
- [ ] AC11 — Chart respects the dark/light theme (colors adjust automatically)
- [ ] AC12 — Keyboard accessible: Tab to focus; arrow keys or screen reader can navigate data points
- [ ] AC13 — Chart renders in under 1.5s on 4G with 10,000 transactions (NFR-1)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Period with zero transactions | Empty state message (e.g., "No transactions in this period") or an empty chart with axes |
| E2 | Single transaction in period | Chart shows one data point with income or expense, the other as zero |
| E3 | Period is a single day (Today, or custom from == to) | Chart shows one daily bucket |
| E4 | Period is 60 days (boundary between daily and monthly) | Chart uses daily granularity (daily if ≤ 60) |
| E5 | Period is 61 days (boundary for monthly switch) | Chart switches to monthly granularity |
| E6 | Period is 1 year (365+ days) | Chart uses monthly granularity (12 or 13 buckets depending on leap year) |
| E7 | Period has a month with zero transactions in the middle | That month is still shown as a data point with ₹0.00 for both income and expenses |
| E8 | A category appears in only one day/month of the period | That bucket shows the amount; other buckets for the category are ₹0.00 (not omitted, as category breakdown is a separate chart in M5-06) |
| E9 | Income in one bucket, expenses in a different bucket | Both are shown on their respective data points |
| E10 | Soft-deleted transaction in the middle of the period | Excluded from chart; totals reflect only non-deleted rows |
| E11 | All transactions are income (no expenses) | Expenses line/bars show ₹0.00 for all buckets |
| E12 | All transactions are expenses (no income) | Income line/bars show ₹0.00 for all buckets |
| E13 | Period with very large amounts (₹99,99,99,999.99) | Y-axis scales appropriately; no overflow or truncation |
| E14 | Mobile viewport 360px | Chart is readable; axes and legend are not cut off; bars/lines are distinguishable |
| E15 | Desktop viewport 1920px | Chart is full-width and readable; legend and axes are well-spaced |
| E16 | Dark theme | Chart colors (income blue, expense red) remain distinct and readable on dark background |
| E17 | Light theme | Chart colors remain distinct and readable on light background |
| E18 | User hovers over a data point (desktop) | A tooltip shows the exact date/month and both income and expense values |
| E19 | User navigates via keyboard to a data point | Screen reader announces the date and values |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `getTrendChartData > empty period > returns empty array` | For a period with zero transactions, `getTrendChartData(from, to)` returns `[]` or an empty structure |
| T2 | integration | `getTrendChartData > single transaction > returns one bucket` | One transaction on 2026-08-15: income ₹1000, returns `[{ date: '2026-08-15', income: '1000.00', expenses: '0.00' }]` |
| T3 | integration | `getTrendChartData > daily granularity <= 60 days > buckets by date` | Period 2026-08-01 to 2026-08-15 (15 days): returns 15 buckets, one per date |
| T4 | integration | `getTrendChartData > daily granularity > excludes days with no transactions` | Period has transactions on 1st, 3rd, 5th; if sparse, only those dates are returned (or all dates with ₹0.00 if dense format) |
| T5 | integration | `getTrendChartData > monthly granularity > 61+ days uses month buckets` | Period 2026-01-01 to 2026-12-31 (365 days): returns 12 monthly buckets (Jan–Dec) |
| T6 | integration | `getTrendChartData > monthly granularity > one data point per calendar month` | 2026: returns buckets for Jan, Feb, ..., Dec (12 total) |
| T7 | integration | `getTrendChartData > income and expense separate series` | Each bucket has both `income` and `expenses` fields; both are decimal strings |
| T8 | integration | `getTrendChartData > soft-deleted excluded` | Seed one income ₹1000 (not deleted), one income ₹500 (soft-deleted), on the same date; chart shows only ₹1000 |
| T9 | integration | `getTrendChartData > decimal precision` | Sum of many 0.01 amounts: e.g., 100 × ₹10.01 = exactly `"1001.00"`, not float drift |
| T10 | integration | `getTrendChartData > only income no expenses` | All transactions are income; each bucket has expenses = `"0.00"` |
| T11 | integration | `getTrendChartData > only expenses no income` | All transactions are expenses; each bucket has income = `"0.00"` |
| T12 | integration | `getTrendChartData > leap year February > correctly buckets Feb 29` | Feb 29 2024 data appears in the Feb bucket; no double-counting |
| T13 | e2e | `Dashboard > trend chart > renders chart element` | Chart component is rendered on the dashboard page |
| T14 | e2e | `Dashboard > trend chart > empty period shows no crash` | Period with zero transactions does not cause an error; chart shows empty or "No data" message |
| T15 | e2e | `Dashboard > trend chart > income and expense series visible` | Chart has two distinct visual series (colors, labels, or legend entries) for income and expenses |
| T16 | e2e | `Dashboard > trend chart > daily for short period` | Set period to "This Week"; chart shows daily buckets (7 points or fewer depending on week configuration) |
| T17 | e2e | `Dashboard > trend chart > monthly for long period` | Set period to "This Year"; chart shows monthly buckets (12 points) |
| T18 | e2e | `Dashboard > trend chart > tooltip on hover (desktop)` | Hover over a data point; tooltip displays the date and both income/expense values |
| T19 | e2e | `Dashboard > trend chart > keyboard accessible` | Focus chart with Tab; arrow keys navigate buckets; screen reader announces values |
| T20 | e2e | `Dashboard > trend chart > responsive mobile 360px` | At 360px, chart is visible, axes readable, series distinguishable (not by color alone if light theme) |
| T21 | e2e | `Dashboard > trend chart > responsive desktop 1920px` | At 1920px, chart is full-width, well-spaced, legend and axis labels clear |
| T22 | e2e | `Dashboard > trend chart > theme-aware dark` | In dark mode, chart colors contrast well on dark background |
| T23 | e2e | `Dashboard > trend chart > theme-aware light` | In light mode, chart colors contrast well on light background |
| T24 | e2e | `Dashboard > trend chart > load time` | With 10,000 transactions, chart renders in under 1.5s (NFR-1) |

**Red gate:** All tests written and failing. Integration tests fail because `getTrendChartData` does not exist. E2E tests fail because chart component is not rendered or data is not fetched. Commit before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Server-side data aggregation** (`lib/repositories/transactionRepository.ts`):

**Method signature:**
```typescript
export async function getTrendChartData(
  from: Date,
  to: Date
): Promise<Array<{ date: string; income: string; expenses: string }>>
```

**Approach:**
- Determine granularity: if (to - from) ≤ 60 days, use daily; else use monthly
- For daily: SQL query groups by `occurredOn` date and aggregates income/expenses
- For monthly: SQL query groups by `DATE_TRUNC('month', occurredOn)` (or `EXTRACT(YEAR, ...), EXTRACT(MONTH, ...)`) and aggregates
- Use `COALESCE(SUM(...), 0)` to handle empty buckets (return `0` not `NULL`)
- Filter `deletedAt IS NULL`
- Return ordered array of buckets: each bucket is `{date: 'YYYY-MM-DD' or 'YYYY-MM', income: 'X.XX', expenses: 'Y.YY'}`

**Example SQL for daily:**
```sql
SELECT 
  "occurredOn"::text as date,
  COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) as income,
  COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) as expenses
FROM "Transaction"
WHERE "deletedAt" IS NULL
  AND "occurredOn" >= $1::date
  AND "occurredOn" <= $2::date
GROUP BY "occurredOn"
ORDER BY "occurredOn" ASC
```

**Example SQL for monthly:**
```sql
SELECT 
  TO_CHAR(DATE_TRUNC('month', "occurredOn"), 'YYYY-MM')::text as date,
  COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) as income,
  COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) as expenses
FROM "Transaction"
WHERE "deletedAt" IS NULL
  AND "occurredOn" >= $1::date
  AND "occurredOn" <= $2::date
GROUP BY DATE_TRUNC('month', "occurredOn")
ORDER BY DATE_TRUNC('month', "occurredOn") ASC
```

**Client-side chart component** (`components/dashboard/TrendChart.tsx`):

- Accept the pre-aggregated data array as a prop
- Use Recharts `LineChart` or `ComposedChart` (line + bar) to render income and expenses
- X-axis: date or month; Y-axis: amount in INR
- Series: income (color A), expenses (color B)
- Tooltip: show date and both values on hover
- Responsive: adjust width/height based on viewport; use `ResponsiveContainer` from Recharts
- Theme-aware: read the current theme (dark/light) from a context or Tailwind class, apply colors accordingly
- Accessibility: include `aria-label` on the chart; ensure tooltips are keyboard-accessible via arrow keys

**Responsive CSS:**
- Mobile (360px): chart height reduced, font sizes smaller, legend positioned below
- Desktop (1920px): full-width chart, legend to the right or top

**Color palette** (theme-aware):
- Light theme: Income = green (#10b981 or similar), Expenses = red (#ef4444)
- Dark theme: Income = light green (#86efac), Expenses = light red (#fca5a5)
- Both must meet 4.5:1 contrast on their respective backgrounds

**Integration into Dashboard:**
- Server Component calls `getTrendChartData(from, to)` and passes the result to the `TrendChart` client component
- No props drilling; data is self-contained in the array

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Repository method `getTrendChartData` computes daily or monthly aggregates in SQL
- [ ] Server returns pre-aggregated data only; no raw transactions shipped to browser
- [ ] Daily granularity for periods ≤ 60 days; monthly for > 60 days
- [ ] Both income and expenses series render on the chart with distinct colors/patterns
- [ ] Empty periods render without error
- [ ] Soft-deleted transactions excluded
- [ ] All amounts formatted as exact decimal strings (e.g., `"1000.00"`)
- [ ] Chart is responsive at 360px and 1920px
- [ ] Dark/light theme handled automatically
- [ ] Keyboard accessible with screen reader support
- [ ] Load time under 1.5s with 10,000 transactions (NFR-1)
- [ ] No N+1 queries — single aggregation query per chart render
- [ ] No unused variables, imports, or dead code
- [ ] No transaction amounts or sensitive data in logs (NFR-8)
