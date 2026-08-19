# AITJ-M4-07 — Mobile card layout, row actions and empty states

| Field | Value |
|---|---|
| Milestone | M4 — Transaction list |
| Depends on | AITJ-M4-02 (table component), AITJ-M3-08 (delete action), AITJ-M3-05 (edit action) |
| Blocks | AITJ-M4 completion |
| PRD refs | FR-L11, FR-L12, §10 page 5, NFR-3, NFR-4, §8.1 (shadcn table) |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

On mobile (< 768px), the table collapses into stacked cards, each showing a transaction's details vertically. Every row has Edit and Delete action buttons. Empty states distinguish between "no transactions yet" (show an Add CTA) and "no results for these filters" (show a Clear Filters action). Both empty states are WCAG 2.1 AA compliant with clear messaging.

## Acceptance criteria

- [ ] AC1 — At viewport width < 768px, the table is hidden and replaced by stacked cards
- [ ] AC2 — Each card displays all transaction fields: Date, Type (with +/− prefix), Category, Description, Amount
- [ ] AC3 — Card has Edit and Delete action buttons, styled as secondary buttons or icon buttons
- [ ] AC4 — Clicking Edit navigates to the transaction detail/edit page
- [ ] AC5 — Clicking Delete shows a confirmation dialog (inherited from AITJ-M3-08) before deleting
- [ ] AC6 — Cards are full-width on mobile, with padding and spacing for readability
- [ ] AC7 — Tap targets (buttons) are >= 44px in height and width (NFR-3)
- [ ] AC8 — At viewport width >= 768px, the table is shown; cards are hidden
- [ ] AC9 — Empty database state ("No transactions yet") displays a message and a button to add a new transaction (CTA links to /income or /expenses)
- [ ] AC10 — Filtered-but-empty state ("No results for these filters") displays a message and a "Clear filters" button
- [ ] AC11 — The two empty states are visually and textually distinct so users understand the cause
- [ ] AC12 — Empty states are keyboard accessible and passed through screen readers

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Mobile user sees empty database | "No transactions yet" message; button to add income or expense |
| E2 | Mobile user applies a filter matching 0 rows | "No results for these filters"; Clear Filters button |
| E3 | Mobile user applies a search term matching 0 rows | "No results for these filters"; Clear Filters button (clears search) |
| E4 | Mobile user rotates device (landscape to portrait) | Responsive breakpoint respected; table ↔ cards transition |
| E5 | Mobile user taps Edit on a card | Navigates to edit page; all filter state preserved in URL (AITJ-M4-06) |
| E6 | Mobile user taps Delete on a card | Confirmation dialog shown (same as M3-08); after deletion, row removed from list |
| E7 | Card with very long description (500 chars) | Wrapped or truncated gracefully; no layout break |
| E8 | Card on a very narrow screen (360px) | Tap targets are still >= 44px; text is readable; no horizontal scroll |
| E9 | Card with archived category | Category name rendered (FR-C7); visually no different from active categories |
| E10 | Empty state on a very narrow screen (360px) | Message and button are readable and usable; button is >= 44px tap target |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `transactions page > at desktop (1024px), table is visible and cards hidden` | Table with headers visible; no card elements |
| T2 | e2e | `transactions page > at mobile (375px), cards are visible and table hidden` | Card elements visible for each transaction; table header hidden |
| T3 | e2e | `transactions page > responsive: rotating device 1024px → 375px shows cards` | Resize browser to 375px; table disappears; cards appear |
| T4 | e2e | `transactions page > responsive: rotating device 375px → 1024px shows table` | Resize to 1024px; cards disappear; table appears |
| T5 | e2e | `transactions page > card displays date, type (+/−), category, description, amount` | Card visible; shows "15 Aug 2026", "+", "Jumu'ah Collection", description, "₹5,000.00" |
| T6 | e2e | `transactions page > card shows income with + prefix and green colour` | Income card; "+" visible; text is green |
| T7 | e2e | `transactions page > card shows expense with − prefix and red colour` | Expense card; "−" visible; text is red |
| T8 | e2e | `transactions page > card has Edit button, clicking it navigates to edit page` | Card visible; click Edit; navigated to `/transactions/[id]/edit` (or similar) |
| T9 | e2e | `transactions page > card has Delete button, clicking it shows confirmation dialog` | Card visible; click Delete; confirmation dialog appears with amount/category/date |
| T10 | e2e | `transactions page > confirming delete on card removes it from the list` | Delete confirmation; confirm; card disappears from list; totals update |
| T11 | e2e | `transactions page > tap target (Edit/Delete buttons) is >= 44px` | Button height and width measured; both >= 44px |
| T12 | e2e | `transactions page > card with 500-char description wraps without overflow` | Long description displayed fully; card width does not exceed viewport; text is readable |
| T13 | e2e | `transactions page > at 360px, card is usable (buttons clickable, text readable)` | Viewport 360px; card visible; tap targets >= 44px; description readable |
| T14 | e2e | `transactions page > empty database shows "No transactions yet" state` | Zero transactions; message "No transactions yet" visible; button to add income or expense |
| T15 | e2e | `transactions page > empty database "Add" button navigates to income entry` | Click button; navigated to `/income` (or `/expenses` if that is the default) |
| T16 | e2e | `transactions page > filtered but empty shows "No results" state` | Apply a filter matching no rows; message "No results for these filters" visible; "Clear filters" button present |
| T17 | e2e | `transactions page > "Clear filters" button resets all filters` | Click "Clear filters"; all filters removed; full list shown |
| T18 | e2e | `transactions page > empty states are distinguishable (no transactions vs no results)` | "No transactions" and "No results" messages are textually and visually different |
| T19 | e2e | `transactions page > empty state at 360px is usable` | Empty message and button at 360px; button >= 44px; message readable |
| T20 | e2e | `transactions page > empty state is keyboard accessible` | Tab to "Add" or "Clear filters" button; Enter activates; focus visible |
| T21 | e2e | `transactions page > editing transaction on mobile preserves filter state when navigating back` | Mobile; apply filter; tap Edit; edit page shown; navigate back; exact filters restored (AITJ-M4-06) |
| T22 | e2e | `transactions page > deleting transaction on mobile preserves other transactions and state` | Mobile; delete one; refresh; remaining transactions shown; filters preserved |
| T23 | e2e | `transactions page > card archived category renders correctly` | Archive a category; transaction still shows; category name visible |
| T24 | e2e | `transactions page > mobile: pagination controls visible and usable at 375px` | Previous / Next buttons visible; tap targets >= 44px; page navigation works |
| T25 | a11y | `transactions page > empty state "Add" button is announced by screen reader` | Screen reader reads button text and purpose |
| T26 | a11y | `transactions page > card edit/delete buttons are announced` | Screen reader reads button labels |
| T27 | a11y | `transactions page > contrast ratio of card text >= 4.5:1 (WCAG AA)` | Measured; card text has sufficient contrast |
| T28 | e2e | `transactions page > empty state on mobile shows icon or visual indicator` | Empty state has an icon or visual element (in addition to text) to aid quick recognition |

**Red gate:** all tests written and failing. Commit before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**File: `components/transactions/transactions-table.tsx`** (Client Component)

Update the TanStack Table component to render conditionally:

```typescript
import { useMediaQuery } from "@/lib/hooks/use-media-query"; // or use Tailwind's hidden/block classes

export function TransactionsTable({ items, total, page, hasNextPage }: Props) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  return (
    <>
      {isMobile ? (
        <TransactionCards items={items} total={total} />
      ) : (
        <DataTable columns={columns} data={items} />
      )}
    </>
  );
}
```

**Tailwind approach** (preferred):

```typescript
export function TransactionsTable({ items, total, page, hasNextPage }: Props) {
  return (
    <>
      {/* Table: visible on md and up */}
      <div className="hidden md:block">
        <DataTable columns={columns} data={items} />
      </div>

      {/* Cards: visible on sm and below */}
      <div className="md:hidden">
        <TransactionCards items={items} total={total} />
      </div>
    </>
  );
}
```

**File: `components/transactions/transaction-cards.tsx`**

A new client component rendering cards for mobile:

```typescript
"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/format/currency";
import { Button } from "@/components/ui/button";
import { Trash2, Edit } from "lucide-react";

export function TransactionCards({ items, total }: Props) {
  const router = useRouter();

  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4 px-4 py-2">
      {items.map((transaction) => (
        <div
          key={transaction.id}
          className="border rounded-lg p-4 bg-white shadow-sm space-y-3"
        >
          {/* Date and Type */}
          <div className="flex justify-between items-start">
            <span className="text-sm text-gray-600">
              {format(new Date(transaction.occurredOn), "dd MMM yyyy")}
            </span>
            <span
              className={`font-semibold ${
                transaction.type === "INCOME"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {transaction.type === "INCOME" ? "+" : "−"}
              {transaction.type}
            </span>
          </div>

          {/* Category */}
          <div>
            <span className="text-sm text-gray-500">Category</span>
            <p className="font-medium">{transaction.category.name}</p>
          </div>

          {/* Description */}
          {transaction.description && (
            <div>
              <span className="text-sm text-gray-500">Description</span>
              <p className="text-sm">{transaction.description}</p>
            </div>
          )}

          {/* Amount */}
          <div className="flex justify-between items-end border-t pt-3">
            <span className="text-sm text-gray-500">Amount</span>
            <span
              className={`text-lg font-bold ${
                transaction.type === "INCOME"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatCurrency(transaction.amount)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/transactions/${transaction.id}/edit`)
              }
              className="flex-1 min-h-[44px]"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                // Trigger delete confirmation
              }
              className="flex-1 min-h-[44px]"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**File: `components/transactions/empty-state.tsx`**

A component with two variants:

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus } from "lucide-react";

export function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (isFiltered) {
    // "No results" state
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          No results for these filters
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Try adjusting your filters to see more transactions.
        </p>
        <Button
          onClick={() => router.push("/transactions")}
          className="min-h-[44px]"
        >
          Clear filters
        </Button>
      </div>
    );
  }

  // "No transactions yet" state
  return (
    <div className="text-center py-12 px-4">
      <Plus className="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        No transactions yet
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        Get started by recording your first transaction.
      </p>
      <div className="flex gap-3 justify-center flex-col sm:flex-row">
        <Button
          onClick={() => router.push("/income")}
          className="min-h-[44px]"
        >
          Add Income
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/expenses")}
          className="min-h-[44px]"
        >
          Add Expense
        </Button>
      </div>
    </div>
  );
}
```

**File: `app/(app)/transactions/page.tsx`**

Determine if filters are applied and pass to EmptyState:

```typescript
const isFiltered =
  typeParam !== null ||
  categoryIdsParam.length > 0 ||
  dateRangeParam !== undefined ||
  searchTermParam !== undefined;

return (
  <div>
    <Filters currentSearchParams={searchParams} />
    {transactions.items.length === 0 && (
      <EmptyState isFiltered={isFiltered} />
    )}
    {transactions.items.length > 0 && (
      <>
        <TotalsHeader income={totals.income} expenses={totals.expenses} />
        <TransactionsTable
          items={transactions.items}
          total={transactions.total}
          page={page}
          hasNextPage={transactions.hasNextPage}
        />
        <Pagination {...} />
      </>
    )}
  </div>
);
```

**File: `lib/hooks/use-media-query.ts`** (if needed)

```typescript
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
}
```

**Delete confirmation** (integrate with AITJ-M3-08)

The delete action is inherited from M3-08. On the card, clicking Delete triggers the same confirmation dialog. After confirmation, the card disappears and totals update.

**Tailwind breakpoint reminder:**

- `md` breakpoint (768px) is where table ↔ cards switch.
- Use `hidden md:block` for table, `md:hidden` for cards.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Desktop (md and up): table visible, cards hidden
- [ ] Mobile (sm and below): cards visible, table hidden
- [ ] Cards display all transaction fields (FR-L11)
- [ ] Edit and Delete buttons on each card, >= 44px (NFR-3)
- [ ] Responsive at 360px (tested)
- [ ] Edit navigates to edit page; filter state preserved (AITJ-M4-06)
- [ ] Delete shows confirmation (from AITJ-M3-08); after deletion, row removed
- [ ] Empty state "No transactions yet" vs "No results" both present and distinct (FR-L12)
- [ ] Clear Filters button works; restores full list
- [ ] Empty states keyboard accessible, screen-reader friendly (NFR-4)
- [ ] Contrast >= 4.5:1 (NFR-4)
- [ ] Card with 500-char description does not overflow
- [ ] Archived categories render on cards
- [ ] Pagination visible on mobile and usable
- [ ] `pnpm test`, `pnpm lint`, `pnpm tsc --noEmit` all pass
