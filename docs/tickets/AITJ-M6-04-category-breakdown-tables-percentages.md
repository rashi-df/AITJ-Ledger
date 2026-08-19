# AITJ-M6-04 — Category breakdown tables with percentage shares

| Field | Value |
|---|---|
| Milestone | M6 — Reports |
| Depends on | AITJ-M6-01 |
| Blocks | AITJ-M6-05, AITJ-M6-06 |
| PRD refs | FR-R3, FR-R4, FR-R8, NFR-4 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

The report displays two tables: one for income category breakdown and one for expense breakdown. Each row shows category name, transaction count, total amount for that category, and percentage of total income (or total expenses). Categories with zero transactions in the period are omitted (FR-R8). Percentage calculations must be exact — specified to avoid the classic trap of percentages not summing to 100% due to rounding. The display must be accessible: income and expense rows are never distinguished by colour alone (NFR-4), and the percentage column must not divide by zero (a period with zero income or zero expenses is valid).

## Acceptance criteria

- [ ] AC1 — Two tables rendered: Income Breakdown and Expense Breakdown
- [ ] AC2 — Income table columns: Category Name, Transaction Count, Total Amount, % of Total Income
- [ ] AC3 — Expense table columns: Category Name, Transaction Count, Total Amount, % of Total Expenses
- [ ] AC4 — Rows are sorted by amount descending (largest category first)
- [ ] AC5 — Categories with zero transactions in the period are omitted from both tables
- [ ] AC6 — Archived categories with historical transactions in the period appear in their respective table (FR-C7)
- [ ] AC7 — Amounts are formatted as `₹1,50,000.00` (en-IN, A1); all values are exact decimal strings
- [ ] AC8 — Percentage values are displayed to 1 decimal place (e.g. `42.3%`); rounding strategy is largest-remainder (or explicitly document the chosen behavior)
- [ ] AC9 — When denominator (total income or total expenses) is zero, the percentage is displayed as `—` (em dash), not `NaN`, `Infinity`, or empty
- [ ] AC10 — Sum of category breakdown amounts equals the total income (or total expenses) exactly, tested at the row level
- [ ] AC11 — Two categories with the same name but different types (income "Other", expense "Other") appear in their respective sections and are never merged
- [ ] AC12 — Income rows use a visual marker (not color alone) to distinguish from expense rows (e.g. icon, text prefix, or layout separation); expense rows similarly marked (NFR-4)
- [ ] AC13 — Empty breakdown (no categories for a type) renders as "No transactions" or similar, not a blank table or error
- [ ] AC14 — Table is responsive: desktop shows full table, mobile (<768px) shows stacked cards or a scrollable table
- [ ] AC15 — Totals row or footer displays the sum of amounts in the breakdown (reconciliation check visible to the user)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Period with zero income, nonzero expenses | Income table empty or shows "No income", expense table populated; percentages in expense table sum to 100% |
| E2 | Period with nonzero income, zero expenses | Expense table empty, income table populated with percentages summing to 100% |
| E3 | Period with zero transactions (all counts zero) | Both tables empty; each shows "No transactions" message |
| E4 | Category with percentage < 0.05% (rounds to 0.0%) | Displayed as `0.0%`, not hidden or rounded to 1%; sum of percentages may total 99.9% or 100.1% (state this explicitly) |
| E5 | Category amount = ₹0.01 out of ₹10.00 total | Percentage = 0.1%; correct display without floating-point error |
| E6 | Single category with entire income (100%) | Percentage displays as `100.0%` exactly |
| E7 | Two categories: one with ₹99999999999.00, one with ₹0.99 | Large amount formatted correctly (Indian grouping: `₹99,99,99,99,999.00`); both rows visible |
| E8 | Archived category with 3 transactions in the period | Appears in breakdown; not hidden despite being archived (FR-C7) |
| E9 | Archived category with zero transactions in period | Omitted from breakdown (FR-R8) |
| E10 | Archived income "Other" and active expense "Other" | Both rows visible in their sections; "Other" is not treated as a single entity |
| E11 | Very long category name (50 chars, per §7 max) | Table cell does not break layout; text wraps or truncates with tooltip on desktop |
| E12 | Period with only one transaction (single row in breakdown) | Single row displayed; percentage = 100.0%; total row shows same amount as transaction |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `breakdown tables > income table renders with correct columns` | Load report page, Income Breakdown table has headers: Category, Count, Amount, % of Total |
| T2 | e2e | `breakdown tables > expense table renders with correct columns` | Expense Breakdown table has same column headers, referencing total expenses not income |
| T3 | e2e | `breakdown tables > categories omitted with zero transactions` | Given 3 categories seeded but only 2 used in the period, breakdown shows 2 rows (unused category omitted) |
| T4 | e2e | `breakdown tables > archived category with activity appears in breakdown` | Seeded archived category with transaction in period; breakdown includes it |
| T5 | e2e | `breakdown tables > archived category without activity omitted` | Archived category with zero transactions in period not shown |
| T6 | e2e | `breakdown tables > amounts formatted as en-IN currency` | Large amount (e.g. ₹1,50,000.00) displays with Indian digit grouping, not Western (₹150,000.00) |
| T7 | e2e | `breakdown tables > percentages displayed to 1 decimal place` | Percentage columns show values like `42.3%`, not `42.34%` or `42%` |
| T8 | e2e | `breakdown tables > percentage with zero denominator shows em dash` | Period with zero income: percentage column in income table shows `—`, not `NaN` or `0%` |
| T9 | e2e | `breakdown tables > rows sorted by amount descending` | Given categories A (₹1000), B (₹500), C (₹2000), table order is C, A, B |
| T10 | e2e | `breakdown tables > two same-name categories different types do not merge` | Income "Other" and expense "Other" each with transactions; both rows visible in their respective sections |
| T11 | integration | `breakdown tables > income amounts sum to total income` | Parse Income Breakdown table rows, sum their amounts (as Decimal), assert equals `totalIncome` from report |
| T12 | integration | `breakdown tables > expense amounts sum to total expenses` | Parse Expense Breakdown table rows, sum their amounts, assert equals `totalExpenses` |
| T13 | integration | `breakdown tables > decimal exactness: no floating-point drift` | Given transaction amounts that sum to `₹1234.56`, breakdown rows sum exactly to `1234.56`, not `1234.5600000001` or similar |
| T14 | e2e | `breakdown tables > empty income shows message` | Period with zero income: "No income transactions" or similar message shown instead of blank table |
| T15 | e2e | `breakdown tables > footer/total row displays sum` | Each table has a "Total" row at the bottom showing sum of amounts; reconciles with headline total |
| T16 | e2e | `breakdown tables > responsive: mobile view` | Render at 360px, table switches to stacked cards or horizontal scroll; all columns visible and readable |
| T17 | unit | `breakdown tables > percentage calculation: 0.1 + 0.1 + ... + 0.1 (10 times) = 1.0%` | Given 10 categories each with 0.1%, sum displayed or calculated correctly (not floating-point error) |
| T18 | unit | `breakdown tables > percentage rounding: largest-remainder or explicit behavior` | Given 3 categories with percentages 33.33%, 33.33%, 33.34% (sum = 100%), verify the rounding strategy chosen (e.g. largest-remainder assigns extra 0.01% to category with largest remainder, or accept 99.9%–100.1% drift) |

**Red gate:** all 18 tests written and failing. Commit the failing tests before implementing.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Component structure** (`components/reports/category-breakdown-table.tsx` or split into income/expense variants):
- Client Component (since it renders tables from server-passed data)
- Props: `breakdownData: CategoryBreakdown[]`, `type: 'INCOME' | 'EXPENSE'`, `total: string` (total income or total expenses)
- `CategoryBreakdown` interface from M6-01: `{ categoryId, categoryName, type, count, amount, percentOfTotal }`

**Percentage rendering logic:**
- Percentage is pre-calculated in M6-01 repository (SQL: `SUM(amount) / total * 100`)
- Repository returns numeric value, e.g. `42.3456789`
- Component rounds to 1 decimal place: `Math.round(percentOfTotal * 10) / 10` or use `toLocaleString('en-US', { maximumFractionDigits: 1 })`
- **Rounding strategy:** Document explicitly in code and test. Example: "Display to 1 dp; percentages may not sum exactly to 100.0% (e.g. 99.9% or 100.1%); this is accepted and not corrected by largest-remainder."
- If total is zero (zero income in period), display `—` (em dash, Unicode U+2014) instead of calculating percentage

**Table structure** (using TanStack Table / shadcn data-table if available from M4, or simple HTML table):
- Columns: Category Name, Transaction Count, Total Amount, Percentage
- No row actions (edit/delete) in this context; rows are read-only
- Sort by amount descending (default, or user can toggle)
- Footer row: "Total", blank, sum of amounts, blank (no percentage on footer row)

**Currency formatting:**
- `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })`

**Empty state:**
- If `breakdownData.length === 0`, display message: "No income transactions in this period" (or "No expense transactions")
- Render this inside the table or above it

**Visual distinction (NFR-4 — color + non-color markers):**
- Income rows: add a subtle background color (e.g. light green) + a "+" icon or "Income" badge in the category name column
- Expense rows: light red background + "−" icon or "Expense" badge
- Ensures color-blind users can distinguish via icon/text, not color alone

**Responsive layout:**
- Desktop (≥768px): full table with horizontal scrolling if necessary
- Mobile (<768px): render as stacked cards or a narrow table with overflow scroll
  - Alternative: use TanStack Table's column hiding; show only Name, Amount, Percentage; hide Count on very narrow screens
  - Or: cards layout with icon, category name, amount, count, percentage on separate lines

**Accessibility:**
- Table has `<caption>` or `<h3>` before it: "Income Breakdown" or "Expense Breakdown"
- Column headers are `<th>` with `scope="col"`
- Rows are `<tr>` with accessible content
- Percentage column uses `aria-label` or title to explain it is a percentage of the total
- Em dash (—) for zero-denominator case is clear (not a surprise to screen readers; use `role="img" aria-label="Not applicable"` if needed, but em dash as text is usually fine)

**Type safety:**
- Define `interface ReportCategoryBreakdown extends CategoryBreakdown { percentOfTotal: number }` (percentage as numeric, not string)

**Testing:**
- Integration test: seed 3 categories with known amounts (e.g. ₹1000, ₹500, ₹300 totaling ₹1800); verify percentages are 55.6%, 27.8%, 16.7% and sum to ~100%
- E2E test: render component with mock data, parse HTML, verify order, amounts, percentages, em dash for zero case

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Two breakdown tables (income, expense) rendered on reports page
- [ ] Data from M6-01 `getReportAggregates()` passed to tables
- [ ] Rows omit zero-activity categories; include archived with activity
- [ ] Percentages displayed to 1 dp; rounding strategy documented
- [ ] Zero-denominator case (zero income or zero expenses) displays em dash, not NaN/Infinity
- [ ] Income and expense rows visually distinct by icon/badge + subtle color, not color alone (NFR-4)
- [ ] Amounts exact decimal strings, sum reconciles to total
- [ ] Responsive at 360px, 768px, desktop
- [ ] Keyboard-navigable, 4.5:1 contrast
- [ ] Empty state message clear
- [ ] No N+1 queries (data passed from server, no client-side fetches)
- [ ] No unused imports or dead code
- [ ] Reviewed by review-agent → QA signed off
