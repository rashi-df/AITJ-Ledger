# AITJ-M5-03 — Dashboard headline cards and all-time balance

| Field | Value |
|---|---|
| Milestone | M5 — Dashboard |
| Depends on | AITJ-M5-01, AITJ-M5-02, AITJ-M3-02 |
| Blocks | M5-04, M5-05, M5-06 |
| PRD refs | FR-D1, FR-D2, FR-D4, FR-D5, §5.7, §8.1, §8.2, A1, A2, NFR-1, NFR-3, NFR-4 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

The dashboard displays three headline cards for the selected period: **Total Income**, **Total Expenses**, and **Current Balance**. Below these, the dashboard also shows the **all-time balance** (the committee's actual cash position) so users do not mistake a monthly view for the total funds. The period-selected totals come from M5-02's aggregation repository; the all-time balance is computed by the same repository method called with the widest possible date range. Income and expense amounts are formatted as `₹1,50,000.00` (A1, `en-IN`); the balance is marked negative (with a minus sign) if expenses exceed income (FR-D4), and this must render clearly without triggering an error state. The cards are responsive Server Components that fetch their own data and render within 1.5s on 4G with 10,000 transactions (NFR-1).

## Acceptance criteria

- [ ] AC1 — Dashboard Server Component renders three headline cards: "Total Income", "Total Expenses", "Current Balance" for the selected period
- [ ] AC2 — Each card displays the value formatted as INR `en-IN`, e.g., `₹1,50,000.00` (A1)
- [ ] AC3 — Current Balance = Total Income − Total Expenses; always computed, never editable
- [ ] AC4 — A negative balance is displayed clearly with a minus sign, e.g., `−₹5,000.00` or in red text; it is not an error
- [ ] AC5 — Below the period cards, an additional card shows the **all-time balance** (total income minus total expenses across all time)
- [ ] AC6 — The period balance and all-time balance are visually distinct so users cannot confuse which is which
- [ ] AC7 — Empty period (no transactions) shows `₹0.00` for all three period cards; all-time balance shows `₹0.00` if no transactions exist
- [ ] AC8 — Cards render in under 1.5s on 4G with 10,000 transactions in the database (NFR-1)
- [ ] AC9 — Responsive from 360px (stacked card layout) to 1920px (horizontal grid); tap targets ≥44px
- [ ] AC10 — Keyboard-accessible with proper ARIA labels; 4.5:1 contrast ratio (NFR-4)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Period with zero transactions | All period cards show `₹0.00`; all-time (if no data) also `₹0.00` |
| E2 | Period with only income | Expenses card shows `₹0.00`; balance equals income |
| E3 | Period with only expenses | Income card shows `₹0.00`; balance is negative |
| E4 | Negative balance (expenses > income) | Balance rendered as `−₹X,XXX.XX` in a distinct color (e.g., red) or prefixed with minus |
| E5 | All-time balance is positive, period balance is negative | Both render correctly; labels make the distinction clear |
| E6 | All-time balance is negative | Displays correctly, not treated as an error |
| E7 | Very large amounts (₹9,99,99,99,999.99) | Formatted correctly with all digits and commas |
| E8 | 1 paise (₹0.01) | Formatted as `₹0.01` |
| E9 | Period includes soft-deleted transactions | Deleted transactions excluded from all three cards and all-time |
| E10 | Dashboard on mobile (360px) | Cards stack vertically; touch targets are ≥44px |
| E11 | Dashboard on desktop (1920px) | Cards render in a horizontal grid |
| E12 | Initial load on a new database (no transactions) | All values are `₹0.00`; no crash, no blank card |
| E13 | Dashboard refreshed or user navigates away and back | Totals refetch and remain accurate |
| E14 | A transaction is created while user is viewing the dashboard | User can trigger a refresh (or data revalidates) to see the updated total |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `Dashboard > headline cards > displays three cards` | Page contains elements with "Total Income", "Total Expenses", "Current Balance" |
| T2 | e2e | `Dashboard > headline cards > income and expenses cards at 360px` | At 360px viewport, cards are visible and stacked or wrapped, not cut off |
| T3 | e2e | `Dashboard > headline cards > empty period shows ₹0.00` | With zero transactions, all three cards display `₹0.00` |
| T4 | e2e | `Dashboard > headline cards > only income shows correct balance` | Seed ₹1000 income, zero expenses; balance card shows `₹1,000.00` |
| T5 | e2e | `Dashboard > headline cards > only expenses shows negative balance` | Seed ₹500 expense, zero income; balance card shows `−₹500.00` or is marked red/negative |
| T6 | e2e | `Dashboard > headline cards > negative balance renders without error` | Negative balance does not trigger an error state, alert, or page crash |
| T7 | e2e | `Dashboard > headline cards > INR formatting en-IN` | Amounts display as `₹1,50,000.00` (comma separator in Indian style) |
| T8 | e2e | `Dashboard > all-time balance card > distinct from period card` | All-time balance card is visually separate and labeled as "All-Time Balance" or similar |
| T9 | e2e | `Dashboard > all-time balance > matches sum of all transactions` | All-time balance = sum of all income - sum of all expenses across entire database |
| T10 | e2e | `Dashboard > all-time balance > empty database shows ₹0.00` | With no transactions anywhere, all-time shows `₹0.00` |
| T11 | e2e | `Dashboard > cards > soft-deleted excluded` | Seed income ₹1000 (not deleted), ₹500 (soft-deleted); cards show only ₹1000 |
| T12 | e2e | `Dashboard > load time > under 1.5s on 4G with 10k transactions` | Measure load time with 10,000 transactions; dashboard renders and cards display values within 1.5s |
| T13 | e2e | `Dashboard > accessibility > all cards have ARIA labels` | Cards have `aria-label` or accessible text describing their purpose |
| T14 | e2e | `Dashboard > accessibility > 4.5:1 contrast on all text` | Use a contrast checker tool; all text meets WCAG AA |
| T15 | e2e | `Dashboard > accessibility > keyboard navigation > tab through cards` | Cards and interactive elements are reachable via Tab key |
| T16 | integration | `Dashboard Server Component > calls getPerioTotals for period` | Component calls repository method with correct from/to dates |
| T17 | integration | `Dashboard Server Component > calls getPerioTotals for all-time` | Component calls repository method with all-time range (or special case) |
| T18 | integration | `Dashboard Server Component > renders three card values` | Component renders income, expenses, and balance as strings |

**Red gate:** Every test is written and fails. E2E tests fail because the Dashboard component does not exist or does not render the cards. Integration tests fail because the component does not exist. Commit these failing tests before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**File:** `app/(app)/dashboard/page.tsx` (Server Component)

**Approach:**
- Fetch the period (Today/This Week/This Month/This Year/Custom) from URL search params via `nuqs` (FR-D9, M5-04 handles the persistence and default)
- Call `resolvePeriod` from M5-01 to get {from, to}
- Call `getPerioTotals(from, to)` from M5-02 to get period totals
- Call `getPerioTotals(allTimeFrom, allTimeTo)` with widest possible range for all-time balance
- Render three headline cards in a responsive grid (Tailwind, shadcn Card or custom)
- Format all amounts with `formatCurrency(value, 'en-IN')` from `lib/format/`
- Render negative balance with a minus sign or red color; neither approach alone is sufficient (NFR-4)
- Render the all-time balance card separately below or beside the period cards with clear visual distinction (label, color, layout)
- Use `revalidatePath` in the period-selection action (M5-04) to ensure cards refetch latest data

**Components:**
- `components/dashboard/HeadlineCard.tsx` — reusable card for income/expense/balance; accepts label, amount, isNegative flag
- `components/dashboard/AllTimeBalanceCard.tsx` — separate card for all-time total

**No client-side rendering** of these cards; data fetching and rendering happen on the server.

**Responsive CSS:**
- Mobile (360px): cards stack vertically, full width minus padding
- Tablet (768px): cards in a 2-column layout
- Desktop (1920px): cards in a 3-column grid or horizontal row; period cards on top, all-time below or beside

**Accessibility:**
- Each card has an `<h2>` or `<h3>` with the label
- The amount is in a `<p>` or `<span>` with appropriate semantic HTML
- Use `aria-label` if the card content alone is not sufficiently descriptive
- Ensure minimum 44px height and width for touch targets (padding can contribute)
- Test contrast with a tool like WebAIM or Lighthouse

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server Component fetches period from URL (wired by M5-04)
- [ ] Server Component calls `getPerioTotals` twice: once for period, once for all-time
- [ ] All amounts formatted as `en-IN` INR
- [ ] Negative balance rendered clearly (not an error; FR-D4 satisfied)
- [ ] All-time and period balances visually distinct and correctly labeled (FR-D5 satisfied)
- [ ] Responsive at 360px and 1920px with no text overflow or missing content
- [ ] Keyboard accessible and WCAG AA contrast (NFR-4)
- [ ] Load time under 1.5s with 10,000 transactions (NFR-1)
- [ ] Soft-deleted transactions excluded from all totals
- [ ] No unused variables, imports, or dead code
- [ ] No transaction amounts or sensitive data in logs (NFR-8)
