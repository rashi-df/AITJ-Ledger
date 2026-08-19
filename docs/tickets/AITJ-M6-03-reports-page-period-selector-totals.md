# AITJ-M6-03 — Reports page with period selector and totals

| Field | Value |
|---|---|
| Milestone | M6 — Reports |
| Depends on | AITJ-M5-01, AITJ-M6-01, AITJ-M6-02 |
| Blocks | AITJ-M6-04, AITJ-M6-05, AITJ-M6-06 |
| PRD refs | FR-R1, FR-R2, §5.6, §10 page 6, §8.2 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

The Reports page is the main entry point for generating a period summary. It displays a period selector (Today, This Week, This Month, This Year, Custom Range — reusing the period engine from M5-01), headline totals for the selected period (total income, total expenses, net balance), opening and closing balances (from M6-02), and placeholder areas for category breakdown tables (M6-04) and export buttons (M6-05). The page is a Server Component that fetches data via the repository methods from M6-01 and M6-02, ensuring the user always sees current totals.

## Acceptance criteria

- [ ] AC1 — Page exists at route `/reports` (per §10 page 6), accessible only to authenticated users
- [ ] AC2 — Period selector allows: Today, This Week, This Month, This Year, Custom Range; defaults to This Month
- [ ] AC3 — Selected period is reflected in the URL query string (persists on refresh, shareable) using `nuqs` (per §8.1)
- [ ] AC4 — Headline cards display: Total Income, Total Expenses, Net Balance for the selected period; amounts are formatted as `₹1,50,000.00` (en-IN, per A1)
- [ ] AC5 — Opening and closing balances are displayed prominently; closing = opening + period net (FR-R5)
- [ ] AC6 — Negative balances are displayed clearly without error (e.g. `−₹500.00`, FR-D4)
- [ ] AC7 — Page handles Custom Range date pickers with validation: from ≤ to, span ≤ 5 years (per §7 Validation rules)
- [ ] AC8 — Empty report state (zero transactions in selected period) renders gracefully: totals show ₹0.00, balances reconcile, breakdown tables show empty state
- [ ] AC9 — Page is fully responsive at 360px (tabs/stacked layout), 768px, and desktop
- [ ] AC10 — Keyboard-navigable: tab through period selector, date pickers, and action buttons; period selector is a combobox or accessible menu
- [ ] AC11 — Meets WCAG 2.1 AA contrast (4.5:1 text, 3:1 graphics) and visible focus rings

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Period with zero transactions | All totals ₹0.00, opening == closing, empty-state UI for breakdown tables, no crash |
| E2 | Custom Range: from date = to date | Single day; accepted, report generated correctly |
| E3 | Custom Range: from > to | Validation error below the form: "Start date must be before end date" (per §7) |
| E4 | Custom Range: span > 5 years | Validation error: "Range must not exceed 5 years" (per §7) |
| E5 | Custom Range: very early date (2000-01-01) | Accepted; report shows earliest transactions with opening balance ₹0.00 |
| E6 | Custom Range: future date (today + 1 year) | Accepted per §7; may include future-dated transactions that were entered (FR-T7 warns on entry but doesn't prevent) |
| E7 | User navigates away and back to Reports, same period selected | Period persists in URL; report regenerated with current data (fresh totals if new transactions were added) |
| E8 | Period boundary in IST: last moment of period (23:59:59 UTC = earlier in IST on same calendar day for UTC-ahead zones, but IST is UTC+5:30, so this is not the edge case — edge is transaction at 23:50 IST on last day, which is the same occurrence date) | Transaction on last day of period is included; opening balance of next period reflects this |
| E9 | Very long Custom Range (5 years): 1825+ days | Page still renders; report data loads (NFR-1 target: < 1.5s on 10k transactions) |
| E10 | This Year on 1 Jan (earliest day of year) | Shows entire calendar year to date (only 1 Jan if no other dates have passed); opening balance is all prior year transactions |
| E11 | This Month on first day of month | Shows only transactions on that day (typically zero); opening balance is prior month + prior years |
| E12 | This Week on Monday (week start per A3) | Shows Monday–Sunday of that week |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `reports page > renders at /reports route` | Navigate to `/reports` (authenticated), page loads without 404 or redirect |
| T2 | e2e | `reports page > period selector defaults to This Month` | Period selector shows "This Month" selected; query string contains period preset or dates for this month |
| T3 | e2e | `reports page > displays headline totals for selected period` | Given a seeded dataset with known income and expenses, "Total Income", "Total Expenses", and "Net Balance" cards show exact amounts |
| T4 | e2e | `reports page > formats currency as en-IN (₹ symbol, 1,50,000.00)` | Amount display includes ₹ symbol and uses Indian digit grouping, not Western comma grouping |
| T5 | e2e | `reports page > displays opening and closing balances` | Cards or sections labeled "Opening Balance" and "Closing Balance" are visible; values reconcile (closing = opening + net) |
| T6 | e2e | `reports page > switching to This Week updates totals` | Select "This Week" from selector, page reloads, totals change to reflect week's transactions only |
| T7 | e2e | `reports page > switching to This Year updates totals` | Select "This Year", totals reflect calendar year (1 Jan–31 Dec in IST) |
| T8 | e2e | `reports page > Custom Range date pickers are functional` | Click on Custom Range, two date pickers appear; select a from-date and to-date, totals update |
| T9 | e2e | `reports page > Custom Range validates from ≤ to` | Set from > to (e.g. Feb 1 to Jan 31), attempt to apply, validation error message appears |
| T10 | e2e | `reports page > Custom Range validates span ≤ 5 years` | Set range > 5 years, validation error appears: "Range must not exceed 5 years" |
| T11 | e2e | `reports page > empty period shows ₹0.00 for all totals` | Select a date range with no transactions, all totals display ₹0.00, no NaN or error state |
| T12 | e2e | `reports page > negative balance displayed clearly` | Create period where expenses > income, closing balance shows as negative (e.g. `−₹500.00`), no error or crash |
| T13 | e2e | `reports page > period persists in URL (nuqs)` | Navigate to `/reports?period=custom&from=2024-01-01&to=2024-01-31`, refresh page, same period is selected |
| T14 | e2e | `reports page > responsive at 360px` | Render at 360px viewport, period selector and cards stack vertically, no overflow, all text readable |
| T15 | e2e | `reports page > keyboard navigation: tab through period selector and buttons` | Use keyboard only (Tab, Enter, arrow keys), navigate and select period, focus is visible at each step |
| T16 | integration | `reports > totals from page match repository` | Given a dataset, load `/reports?period=thisMonth`, parse displayed totals, assert they equal `getReportAggregates()` result from repository (verifies data flow from repository to UI) |
| T17 | integration | `reports > opening/closing balances reconcile` | Assert closing = opening + period net, using values displayed on page and repository calculations |

**Red gate:** all 17 tests written and failing. Commit the failing tests before implementing.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Page structure** (`app/(app)/reports/page.tsx`):
- Server Component; fetches data server-side
- URL state via `nuqs` (§8.1): query string encodes period preset or custom dates
- Layout: header with period selector, then headline cards, then placeholder sections for breakdown tables and export buttons

**Period selector component** (`components/period-selector.tsx` or reuse from M5):
- Buttons or dropdown menu: Today, This Week, This Month, This Year, Custom
- Custom Range opens a modal or collapsible section with two date pickers (react-day-picker via shadcn Popover+Calendar, per §8.1)
- On selection, update `nuqs` query parameters; page re-renders with new data
- Validation via Zod schema from §7 (date range rules)

**Data fetching:**
- `const period = resolvePeriod(preset, nuqs)` — calls M5-01 period engine
- `const aggregates = await reportRepository.getReportAggregates(period)` — M6-01
- `const opening = await reportRepository.getOpeningBalance(period.from)` — M6-02
- `const closing = await reportRepository.getClosingBalance(period)` — M6-02
- Pass data to UI components for display

**Headline cards component:**
- Display totalIncome, totalExpenses, netBalance using shadcn Card
- Format using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`
- Apply text color: income green (or neutral), expenses red (or neutral), net depends on sign (red if negative)

**Responsive layout:**
- Desktop: 3–4 columns (income, expenses, net, all-time balance)
- Tablet (≥768px): 2–3 columns
- Mobile (<768px): stacked vertical cards

**Empty state:**
- If all totals are ₹0.00 and no transactions in period, display a message: "No transactions in this period." with a link to add an income or expense

**Accessibility:**
- Period selector combobox or menu with ARIA labels
- Date pickers labeled "From" and "To"
- Card headings use `<h2>` or `<h3>` hierarchy
- Error messages are announced (aria-live if using Toast, or inline with role="alert")
- Contrast: text on cards meets 4.5:1; disabled states 3:1 or clear visual indicator

**Integration test:**
- Seed 5+ transactions (mix of types and categories) in a known date range
- Request `/reports?period=thisMonth` (or similar)
- Parse HTML response; extract displayed totals
- Assert they match `reportRepository.getReportAggregates()` for the same period
- Verifies end-to-end data flow

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Page is accessible at `/reports` route, authenticated only
- [ ] Period selector uses same M5-01 period engine as dashboard; identical date resolution
- [ ] All totals and balances from repository methods (M6-01, M6-02); no duplication
- [ ] URL query state persists period selection (nuqs)
- [ ] Validation error messages clear and actionable
- [ ] Responsive at 360px, 768px, desktop
- [ ] Keyboard-navigable, 4.5:1 contrast, visible focus
- [ ] Empty state handled gracefully
- [ ] Negative balances displayed clearly
- [ ] No N+1 queries (single fetch per component)
- [ ] Server-side data fetching; no sensitive info in client props
- [ ] No console errors or warnings
- [ ] Reviewed by review-agent → QA signed off at mobile, tablet, desktop
