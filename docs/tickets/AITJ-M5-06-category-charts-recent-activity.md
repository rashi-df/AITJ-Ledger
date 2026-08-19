# AITJ-M5-06 — Category breakdown charts and recent activity

| Field | Value |
|---|---|
| Milestone | M5 — Dashboard |
| Depends on | AITJ-M5-01, AITJ-M5-02, AITJ-M5-04 |
| Blocks | none |
| PRD refs | FR-D7, FR-D8, FR-C7, §8.1, §8.3, A6, NFR-1, NFR-3, NFR-4 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

Below the trend chart, the dashboard displays two category breakdown charts: one for income by category, one for expenses by category (FR-D7). Each chart shows the sum of transactions for that category in the selected period, formatted as INR and as a percentage of the total for that type. Archived categories with historical activity in the period still appear (FR-C7). Categories with zero activity in the period are omitted. The server pre-aggregates these sums in SQL; the browser receives only the aggregated data. At the bottom of the dashboard, the five most recent non-deleted transactions are listed in a small card with a "View all transactions" link (FR-D8). Empty periods, archived categories, and soft-deleted rows are all handled correctly. Both charts and the recent-activity list render in under 1.5s with 10,000 transactions (NFR-1).

## Acceptance criteria

- [ ] AC1 — Two pie/doughnut or bar charts on the dashboard: "Income by Category" and "Expenses by Category" for the selected period
- [ ] AC2 — Each chart shows category name, amount in INR, and percentage of total for that type
- [ ] AC3 — Server computes category totals in SQL; the browser receives pre-aggregated data only
- [ ] AC4 — Categories with zero activity in the period are omitted from the chart
- [ ] AC5 — Archived categories with historical activity in the period are included (FR-C7)
- [ ] AC6 — Empty period (no transactions) shows "No data" or an empty chart; does not crash
- [ ] AC7 — Soft-deleted transactions are excluded from all charts
- [ ] AC8 — Below the charts, a "Recent transactions" card lists the five most recent non-deleted transactions
- [ ] AC9 — Recent-transaction list shows: Date, Type, Category, Amount, Description (if present); each is a clickable row linking to the transaction detail or edit view
- [ ] AC10 — If fewer than five transactions exist, show all available
- [ ] AC11 — If the most recent transaction is soft-deleted, skip it and show the next five available
- [ ] AC12 — A "View all transactions" link at the bottom of the recent-activity card points to `/transactions`
- [ ] AC13 — Charts are responsive at 360px (vertical bars or stacked layout) and 1920px (side-by-side); tap targets ≥44px
- [ ] AC14 — Charts respect dark/light theme with distinct colors per category
- [ ] AC15 — Keyboard accessible: Tab to focus charts, arrow keys navigate segments, screen reader announces category and amount
- [ ] AC16 — Charts and recent-activity list render in under 1.5s on 4G with 10,000 transactions (NFR-1)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Period with zero transactions | Both category charts show "No data" or empty state; recent-activity shows none available |
| E2 | Only one category has activity | Chart shows one segment/bar for 100% |
| E3 | A category is archived but has activity in the period | Category still appears on the chart with the correct amount and percentage |
| E4 | An archived category has zero activity in the period | Omitted from the chart |
| E5 | A new active category and an archived active category in the same period | Both appear on the chart with correct amounts |
| E6 | Income only, no expenses in the period | Expense chart shows "No data"; income chart shows all categories |
| E7 | Expenses only, no income in the period | Income chart shows "No data"; expense chart shows all categories |
| E8 | A category with very large amount (₹99,99,99,999.99) | Formatted correctly; chart scales appropriately |
| E9 | Many categories (20+) in a period | All are displayed; chart is readable (or scrollable if needed) |
| E10 | Soft-deleted transaction in the recent-five | Excluded; the five shown are all non-deleted |
| E11 | Fewer than five non-deleted transactions exist | Recent-activity shows all available (e.g., three transactions) |
| E12 | Exactly five non-deleted transactions | Recent-activity shows all five |
| E13 | Six transactions exist; the most recent is soft-deleted | Recent-activity shows the next five non-deleted (oldest of the six is excluded) |
| E14 | Recent transaction has no description | Row displays correctly; no blank space or error |
| E15 | Recent transaction description is 500 characters | Truncated or displayed in full in a expandable way; no overflow |
| E16 | Recent transaction date is near the boundary (e.g., from or to date of the selected period) | Listed correctly if within the period; excluded if outside |
| E17 | Mobile viewport 360px | Charts stack vertically; recent-activity is a single-column list; all text is readable |
| E18 | Desktop viewport 1920px | Category charts side by side; recent-activity table or card list is full-width and well-spaced |
| E19 | Dark theme | Chart colors distinct and readable on dark background; text meets 4.5:1 contrast |
| E20 | Light theme | Chart colors distinct and readable on light background; text meets 4.5:1 contrast |
| E21 | User clicks on a category segment (desktop) | (Optional) Chart may drill down or highlight; no requirement in FR, so this is a nice-to-have |
| E22 | User navigates to a recent transaction via keyboard | Tab to focus the row; Enter opens the detail or edit view |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `getCategoryBreakdown > income categories > returns list of categories with totals` | Call `getCategoryBreakdown(from, to, 'INCOME')`, returns `[{categoryId, name, amount: string, percentage: number}, ...]` |
| T2 | integration | `getCategoryBreakdown > expense categories > returns list of categories with totals` | Call `getCategoryBreakdown(from, to, 'EXPENSE')`, returns categories for expenses only |
| T3 | integration | `getCategoryBreakdown > empty period > returns empty array` | Period with zero transactions returns `[]` (or empty structure) |
| T4 | integration | `getCategoryBreakdown > zero-activity category omitted` | Category with no transactions in period is not in the result |
| T5 | integration | `getCategoryBreakdown > archived category with activity > included` | Archived category with transactions in period is included; `isArchived` flag may be set |
| T6 | integration | `getCategoryBreakdown > percentage calculation correct` | Two categories: ₹600 and ₹400 income = ₹1000 total; percentages are 60% and 40% |
| T7 | integration | `getCategoryBreakdown > soft-deleted excluded` | Seed category with one non-deleted (₹500) and one soft-deleted (₹300) transaction; result shows ₹500 only |
| T8 | integration | `getCategoryBreakdown > multiple transactions same category` | Three income transactions in "Donation" (₹100, ₹200, ₹300) = ₹600 total; result shows one entry for Donation with ₹600 |
| T9 | integration | `getCategoryBreakdown > decimal precision` | Sum of many small amounts: 100 × ₹10.01 = ₹1001.00 (exact string, no float drift) |
| T10 | integration | `getRecentTransactions > returns five most recent` | No period filter (or all-time filter); returns five most recent non-deleted, ordered newest first |
| T11 | integration | `getRecentTransactions > excludes soft-deleted` | Seed six transactions, one soft-deleted; result shows five non-deleted |
| T12 | integration | `getRecentTransactions > fewer than five available` | Seed three transactions; result returns all three |
| T13 | integration | `getRecentTransactions > exact five available` | Seed exactly five; result returns all five |
| T14 | integration | `getRecentTransactions > most recent is soft-deleted` | Seed six non-deleted transactions; one is marked deleted; result shows the next five (oldest is excluded) |
| T15 | integration | `getRecentTransactions > ordered newest first` | Three transactions on dates 1st, 5th, 10th; result is ordered [10th, 5th, 1st] |
| T16 | integration | `getRecentTransactions > includes type, category, amount, date, description` | Result has fields: type, categoryId, categoryName, amount (string), occurredOn, description |
| T17 | e2e | `Dashboard > category charts > income and expense charts render` | Page displays "Income by Category" and "Expenses by Category" sections |
| T18 | e2e | `Dashboard > category charts > empty period shows no data` | Period with zero transactions displays "No data" or empty chart |
| T19 | e2e | `Dashboard > category charts > categories with activity display` | Seed income in "Donation" and "Zakat"; both appear on the income chart |
| T20 | e2e | `Dashboard > category charts > archived category appears` | Archive a category, add a transaction to it (before archiving); chart shows the archived category |
| T21 | e2e | `Dashboard > category charts > percentage displayed` | Chart or legend shows percentages (e.g., "Donation (60%)") |
| T22 | e2e | `Dashboard > recent transactions > list shows five most recent` | Dashboard displays a list or card of recent transactions |
| T23 | e2e | `Dashboard > recent transactions > fewer than five shown` | Seed three transactions; recent-activity shows all three |
| T24 | e2e | `Dashboard > recent transactions > soft-deleted excluded` | Seed six transactions, one soft-deleted; recent-activity shows five (the oldest, if necessary, is excluded) |
| T25 | e2e | `Dashboard > recent transactions > view all link` | Card has a "View all transactions" link pointing to `/transactions` |
| T26 | e2e | `Dashboard > recent transactions > row fields visible` | Each row shows Date, Type (Income/Expense), Category, Amount, Description |
| T27 | e2e | `Dashboard > recent transactions > clickable row` | Click on a recent transaction row; navigates to the transaction's detail or edit view |
| T28 | e2e | `Dashboard > category charts > responsive mobile 360px` | Charts and recent-activity stack vertically; all text readable |
| T29 | e2e | `Dashboard > category charts > responsive desktop 1920px` | Charts side by side; recent-activity full-width; well-spaced layout |
| T30 | e2e | `Dashboard > category charts > theme-aware dark` | Dark theme: chart colors distinct on dark background |
| T31 | e2e | `Dashboard > category charts > theme-aware light` | Light theme: chart colors distinct on light background |
| T32 | e2e | `Dashboard > category charts > keyboard accessible` | Tab to focus chart; arrow keys navigate segments; screen reader announces category and amount |
| T33 | e2e | `Dashboard > category charts > load time` | With 10,000 transactions, category charts and recent-activity render in under 1.5s |

**Red gate:** All tests written and failing. Integration tests fail because the two new repository methods do not exist. E2E tests fail because charts/recent-activity are not rendered or data is not fetched. Commit before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Server-side aggregation** (`lib/repositories/transactionRepository.ts`):

**Method 1 — Category Breakdown:**
```typescript
export async function getCategoryBreakdown(
  from: Date,
  to: Date,
  type: 'INCOME' | 'EXPENSE'
): Promise<Array<{ categoryId: string; name: string; isArchived: boolean; amount: string; percentage: number }>>
```

**Approach:**
- SQL query groups by category and aggregates the sum, filtered by type, period, and `deletedAt IS NULL`
- Compute the total for the type first
- For each category, calculate percentage = (amount / total) × 100
- Return ordered by amount descending (largest first)
- Include archived categories if they have activity in the period

**Example SQL:**
```sql
SELECT 
  c."id" as "categoryId",
  c."name",
  c."isArchived",
  COALESCE(SUM(t."amount"), 0)::text as "amount",
  COALESCE(SUM(t."amount"), 0) / NULLIF(SUM(SUM(t."amount")) OVER (), 0) * 100 as "percentage"
FROM "Category" c
LEFT JOIN "Transaction" t ON c."id" = t."categoryId" 
  AND t."deletedAt" IS NULL 
  AND t."occurredOn" >= $1::date 
  AND t."occurredOn" <= $2::date
WHERE c."type" = $3::"TransactionType"
GROUP BY c."id", c."name", c."isArchived"
HAVING COALESCE(SUM(t."amount"), 0) > 0
ORDER BY SUM(t."amount") DESC
```

**Method 2 — Recent Transactions:**
```typescript
export async function getRecentTransactions(
  limit: number = 5
): Promise<Array<{ id: string; type: TransactionType; categoryId: string; categoryName: string; amount: string; occurredOn: Date; description?: string }>>
```

**Approach:**
- Query all non-deleted transactions, ordered by `occurredOn` descending (newest first)
- Include category name via a join or `select`
- Return the top `limit` (default 5) rows
- No period filter — this is all-time recent

**Example SQL:**
```sql
SELECT 
  t."id",
  t."type",
  t."categoryId",
  c."name" as "categoryName",
  t."amount"::text,
  t."occurredOn",
  t."description"
FROM "Transaction" t
JOIN "Category" c ON t."categoryId" = c."id"
WHERE t."deletedAt" IS NULL
ORDER BY t."occurredOn" DESC, t."createdAt" DESC
LIMIT $1
```

**Client-side chart components:**

**Component 1 — CategoryCharts.tsx:**
- Accept `from` and `to` dates as props
- Fetch `getCategoryBreakdown(from, to, 'INCOME')` and `getCategoryBreakdown(from, to, 'EXPENSE')`
- Render two pie/doughnut charts using Recharts `PieChart` or bar charts `BarChart`
- Each segment/bar labeled with category name, amount, and percentage
- Empty state: "No transactions for this type in this period"
- Responsive: stack vertically on mobile, side-by-side on desktop
- Theme-aware: assign colors based on theme; ensure 4.5:1 contrast

**Component 2 — RecentTransactionsList.tsx:**
- Fetch `getRecentTransactions(5)`
- Render as a table (desktop) or stacked cards (mobile)
- Columns: Date, Type (with icon/color), Category, Amount, Description
- Each row is a link to the transaction edit view (or detail page if one exists)
- "View all transactions" link at the bottom
- Empty state: "No recent transactions"

**Integration into Dashboard:**
- Server Component (`app/(app)/dashboard/page.tsx`) calls both repository methods and passes the data to the client components
- Category charts and recent-activity list render after the trend chart

**Colors for categories** (theme-aware palette):
- Use a palette of 8–12 distinct colors that work in both light and dark themes
- Assign colors by category ID (deterministic) so the same category always gets the same color
- Example: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']
- Test contrast on both light and dark backgrounds

**Responsive layout:**
- Mobile (360px): charts stack vertically; recent-activity is a single-column list (cards)
- Tablet (768px): charts may be side-by-side or still stacked; recent-activity in a compact table or cards
- Desktop (1920px): charts side-by-side; recent-activity as a full-width table

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Repository methods `getCategoryBreakdown` and `getRecentTransactions` compute aggregates in SQL
- [ ] Server returns only pre-aggregated data; no raw transactions shipped to browser
- [ ] Zero-activity categories omitted; archived categories with activity included (FR-C7)
- [ ] Soft-deleted transactions excluded from both charts and recent-activity list
- [ ] Percentages calculated correctly on the server
- [ ] Recent-transactions ordered newest-first; exactly five (or fewer if fewer available)
- [ ] Soft-deleted transactions never appear in recent-five
- [ ] All amounts formatted as exact decimal strings
- [ ] Charts responsive at 360px and 1920px
- [ ] Dark/light theme handled with distinct colors and proper contrast
- [ ] Keyboard accessible: Tab to charts, arrow keys navigate, screen reader support
- [ ] Load time under 1.5s with 10,000 transactions (NFR-1)
- [ ] No N+1 queries — two aggregation queries per render, not one per category
- [ ] No unused variables, imports, or dead code
- [ ] No transaction amounts or sensitive data in logs (NFR-8)
