# AITJ-M4-02 — Transactions page table with income and expense distinction

| Field | Value |
|---|---|
| Milestone | M4 — Transaction list |
| Depends on | AITJ-M4-01 (paginated query), AITJ-M1-01 (auth), AITJ-M2-01 (categories) |
| Blocks | AITJ-M4-03, AITJ-M4-04, AITJ-M4-06, AITJ-M4-07 |
| PRD refs | FR-L1, FR-L2, FR-L7, §10 page 5, §8.1 (TanStack Table), NFR-3, NFR-4 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

The /transactions page displays all transactions in a sortable, paginated table with five columns: Date, Type, Category, Description, Amount. Income and expense rows must be visually distinguished by both colour and a sign prefix (+ for income, − for expense), since colour alone is not sufficient for users with colour-blindness or when printed (FR-L2, NFR-4). The table is built with shadcn's TanStack Table wrapper. Sorting by date (default newest first) and amount is handled at the repository level (AITJ-M4-01); the UI delegates to server-side sort via URL query parameters.

## Acceptance criteria

- [ ] AC1 — Table renders all non-deleted transactions with columns: Date, Type (Income/Expense), Category (name), Description, Amount
- [ ] AC2 — Income rows display with a + prefix and a distinct colour (green, or another high-contrast hue); expense rows with − prefix and a distinct colour (red or another)
- [ ] AC3 — The visual distinction (colour + prefix) passes WCAG 2.1 AA colour-contrast and is distinguishable in greyscale (for printing)
- [ ] AC4 — Amount is formatted as en-IN currency (₹1,50,000.00)
- [ ] AC5 — Clicking on a column header (Date, Amount) triggers a server-side sort; current sort direction is indicated (↑/↓ or up/down chevron)
- [ ] AC6 — Sort state (field and direction) is persisted in the URL and survives a page refresh
- [ ] AC7 — Pagination controls display total row count and current page (e.g. "Showing 1–25 of 150")
- [ ] AC8 — At 360px width, the table collapses into stacked cards (handled in AITJ-M4-07)
- [ ] AC9 — On load, the page queries the repository with the current filters and sort state; no client-side re-sorting or filtering

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Empty database | Table shows no rows; "No transactions yet" message (handled in AITJ-M4-07) |
| E2 | Single row | Row displays correctly; pagination shows "Showing 1–1 of 1" |
| E3 | Amount with max precision (99999999999.99) | Renders as ₹99,99,99,99,999.99 (en-IN format, no overflow) |
| E4 | Description 500 chars | Fully visible in the table (no truncation, or truncation with tooltip); no layout break |
| E5 | Description empty | Cell is blank; no placeholder text |
| E6 | Category name with Unicode (e.g. "Jumu'ah") | Renders correctly without encoding issues |
| E7 | Transaction on boundary dates (1 Jan, 31 Dec) | Date formats correctly; no timezone drift (IST, A2) |
| E8 | Sort by date, all same date | Stability: order is deterministic (by creation time or ID, no random shuffling across page loads) |
| E9 | Sort by amount, mixed income/expense | Both types present; sorted by magnitude (all amounts positive per A10); income and expense are not separated by type |
| E10 | Currency format in browser with locale override | Format is always en-IN, never the user's locale setting |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `transactions page > renders table with five columns: date, type, category, description, amount` | Table visible; headers include "Date", "Type", "Category", "Description", "Amount" |
| T2 | e2e | `transactions page > income row displays with + prefix and green colour` | Income row found; contains "+" sign; has color: rgb(22, 163, 74) or similar green (>= WCAG AA contrast) |
| T3 | e2e | `transactions page > expense row displays with − prefix and red colour` | Expense row found; contains "−" sign; has color: rgb(220, 38, 38) or similar red (>= WCAG AA contrast) |
| T4 | e2e | `transactions page > income and expense rows distinguishable in greyscale print preview` | Print preview at 100% zoom; income row has distinct grey tone from expense row; both readable without colour |
| T5 | e2e | `transactions page > amount renders in en-IN format (₹X,XX,XXX.XX)` | Amount ₹1,50,000.00 displays (or equivalent), never 1500000.00 or $1,500,000.00 |
| T6 | e2e | `transactions page > date column shows date in format DD MMM YYYY` | Date "15 Aug 2026" visible (or similar en-IN readable format) |
| T7 | e2e | `transactions page > clicking date column header sorts by date descending (newest first)` | Initial sort by date desc; click header; rows reorder with newest first; a second click reverses to oldest first |
| T8 | e2e | `transactions page > clicking amount column header sorts by amount descending` | Initial table; click "Amount" header; rows reorder by amount high-to-low; chevron indicates sort direction |
| T9 | e2e | `transactions page > sort state (field and direction) persists in URL` | Sort by amount ascending; URL contains "sort=amount&direction=asc"; refresh page; sort is retained |
| T10 | e2e | `transactions page > pagination shows total count and current page range` | "Showing 1–25 of 150" or similar text visible |
| T11 | e2e | `transactions page > navigating pages preserves sort state` | Page 1 sorted by date desc; go to page 2; sort remains date desc; URL shows both page and sort params |
| T12 | e2e | `transactions page > table header is sticky on scroll` | At desktop, header remains visible when scrolling down (if applicable); or not applicable at current page length |
| T13 | integration | `transactions server component > queries repository with current sort and filter state` | Page loads; repository findTransactionsPaginated called once with correct sort and page params; no client-side re-sort |
| T14 | e2e | `transactions page > category name renders correctly (Unicode, apostrophes)` | Category "Jumu'ah Collection" displays correctly; no HTML entities visible |
| T15 | e2e | `transactions page > description column handles 500-char edge case without layout break` | 500-char description visible; no horizontal scroll of the page body; table width is responsive |
| T16 | e2e | `transactions page > empty description shows blank cell` | Row with no description; cell is empty, no placeholder or "N/A" |
| T17 | e2e | `transactions page > single transaction displays with correct pagination text` | One transaction; "Showing 1–1 of 1" |
| T18 | e2e | `transactions page > sort stability: two rows same date/amount ordered by creation time` | Create two income, same date, same amount, different createdAt; sort by date; earlier-created appears first consistently across page reloads |
| T19 | e2e | `transactions page > max amount (99999999999.99) renders without overflow` | Amount ₹99,99,99,99,999.99 displays in full; no truncation; table width sufficient |

**Red gate:** every test above is written and failing. Commit the failing tests before implementing the page.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**File: `app/(app)/transactions/page.tsx`**

This is a Server Component that:

1. Asserts session (via `authedAction` wrapper or session check).
2. Calls `transactionRepository.findTransactionsPaginated()` with sort and page from URL params.
3. Passes items and metadata to a client component (`<TransactionsTable />`).

**File: `components/transactions/transactions-table.tsx`**

Client component using shadcn's TanStack Table (`<DataTable />`):

1. **Columns:** Define via shadcn's column definitions:
   - Date: formatted `dd MMM yyyy` (date-fns)
   - Type: display "Income" or "Expense"
   - Category: `item.category.name`
   - Description: plain text or truncated with tooltip
   - Amount: formatted `en-IN`, prefixed with + or −

2. **Visual distinction for income/expense:**
   ```
   Income:  + sign, color: #16a34a (green-600), font-weight: 600
   Expense: − sign, color: #dc2626 (red-600), font-weight: 600
   ```
   Both must have >= 4.5:1 contrast against the background. Verify in integration or visual test.

3. **Sorting:** TanStack Table's built-in sorting is configured to update URL params (via nuqs or manual setSearchParams) and trigger a server-side re-fetch. Do not sort in the client; all sorting is server-side (AITJ-M4-06 handles URL state management).

4. **Pagination:** Display `pagination.from`, `pagination.to`, `pagination.total`. Buttons "Previous" and "Next" update page param.

5. **Formatting:**
   - Currency: `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)`
   - Date: `format(new Date(occurredOn), 'dd MMM yyyy', { locale: enIN })`
   - Amount as string: Decimal from repository is already a string; parse and format.

6. **Accessibility:** Column headers are `<th>` with `scope="col"`; sort indicators use `aria-label` and visible chevrons; description column has a unique ID for tooltip linkage.

**File: `lib/format/currency.ts`** (or similar)

Add (if not already present):

```typescript
export function formatCurrency(amount: Decimal | string): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount.toNumber();
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
}
```

**Tailwind classes:**

- Income row: `text-green-600` for the + and amount text.
- Expense row: `text-red-600` for the − and amount text.
- Verify contrast using a contrast checker or Tailwind's default color palette (should be >= 4.5:1 against white background).

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Table columns: Date, Type, Category, Description, Amount (FR-L1)
- [ ] Income rows show + prefix and green; expense rows show − prefix and red (FR-L2)
- [ ] Visual distinction passes WCAG 2.1 AA colour contrast and is distinguishable in greyscale (NFR-4)
- [ ] Amount formatted as en-IN currency (A1)
- [ ] Sort by date and amount via server (FR-L7), not client-side
- [ ] Sort state in URL (part of AITJ-M4-06, but verify integration here)
- [ ] Pagination metadata displayed (FR-L8)
- [ ] Category included in one query from repository (no N+1)
- [ ] `deletedAt: null` filter applied via repository layer
- [ ] Responsive at 360px (cards in AITJ-M4-07)
- [ ] Keyboard accessible: column headers focusable, sort direction announced
- [ ] `pnpm test`, `pnpm lint`, `pnpm tsc --noEmit` all pass
