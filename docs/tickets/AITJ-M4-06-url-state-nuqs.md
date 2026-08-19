# AITJ-M4-06 — URL-encoded filter, sort and page state with nuqs

| Field | Value |
|---|---|
| Milestone | M4 — Transaction list |
| Depends on | AITJ-M4-01 through AITJ-M4-05 (all filters and sort) |
| Blocks | AITJ-M4-07 (final integration) |
| PRD refs | FR-L10, §8.1 (nuqs), §10 page 5 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

All filters, sort, and page state are encoded in the URL query string so a user can bookmark, share, or reload a view (FR-L10). The app uses the `nuqs` library to manage URL-synced state without hand-rolled query-string parsing. Every filter change updates the URL and vice versa (if a user manually edits the URL or navigates back from an edit, the exact filter set is restored). Malformed or tampered query strings degrade to defaults rather than crashing.

## Acceptance criteria

- [ ] AC1 — All filter, sort, and page state is encoded in the URL query string
- [ ] AC2 — Supported query parameters: `type`, `categories` (comma-separated IDs), `search`, `datePreset`, `customFrom`, `customTo`, `sortField`, `sortDirection`, `page`
- [ ] AC3 — Changing a filter, sort, or page updates the URL without a full page reload
- [ ] AC4 — The URL is bookmarkable: copying the URL and navigating to it in another tab shows the same filtered view
- [ ] AC5 — The URL is shareable: the user can share the URL with a colleague, who sees the exact same filtered view
- [ ] AC6 — Refreshing the page (Cmd+R or F5) preserves the filter state
- [ ] AC7 — Editing a transaction and navigating back (browser back button) restores the exact filter state from before the edit
- [ ] AC8 — A malformed URL (e.g. invalid page number, non-existent category ID) degrades gracefully to defaults without crashing
- [ ] AC9 — An empty filter state (no filters selected) results in a clean URL (e.g. `/transactions` with no query string, or only the default page=1)
- [ ] AC10 — The URL state is the single source of truth; no local component state is used for filters

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | URL has type=INVALID | Parameter ignored; type defaults to null (All) |
| E2 | URL has categories=id1,id2,nonexistent | Nonexistent ID is silently ignored; filter includes id1 and id2 |
| E3 | URL has page=0 | Treated as page 1 |
| E4 | URL has page=999 (beyond last page) | Page parameter is preserved in URL but repository returns empty items; pagination shows accurate total |
| E5 | URL has page=-5 | Treated as page 1 |
| E6 | URL has page=abc | Treated as page 1 |
| E7 | URL has sortField=invalid | Sort defaults to date descending |
| E8 | URL has sortDirection=invalid | Sort direction defaults to the preset for that field |
| E9 | URL has customFrom without customTo | Parameter ignored; uses datePreset if present, otherwise no date filter |
| E10 | URL has customFrom > customTo | Filter is ignored; no date filtering applied (will be caught by server-side validation) |
| E11 | User edits a transaction and navigates back | Query string is identical to before the edit; exact state restored |
| E12 | User navigates to a different page and uses back button multiple times | Browser back button works correctly; each click restores a previous state |
| E13 | URL contains extra/unknown parameters | Extra params are ignored; no error |
| E14 | All filters off, sort by date desc, page 1 | URL is clean: `/transactions` or `/transactions?sortField=occurredOn&sortDirection=desc` |
| E15 | Mobile user shares URL via SMS to another user | URL is compact (state is in query, not fragment); other user sees the same view |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `transactions page > changing type filter updates URL` | Select "Income"; URL contains `type=INCOME` |
| T2 | e2e | `transactions page > changing category filter updates URL` | Select two categories; URL contains `categories=id1,id2` |
| T3 | e2e | `transactions page > changing search updates URL` | Search "electricity"; URL contains `search=electricity` (URL-encoded) |
| T4 | e2e | `transactions page > changing date preset updates URL` | Select "This Month"; URL contains `datePreset=thisMonth` |
| T5 | e2e | `transactions page > changing custom date range updates URL` | Set from = 2026-08-15, to = 2026-08-20; URL contains `customFrom=2026-08-15&customTo=2026-08-20` |
| T6 | e2e | `transactions page > changing sort updates URL` | Click "Amount" header; URL contains `sortField=amount&sortDirection=desc` |
| T7 | e2e | `transactions page > changing page number updates URL` | Go to page 2; URL contains `page=2` |
| T8 | e2e | `transactions page > URL is bookmarkable` | Set filters (type, category, search); copy URL; open in new tab; exact same filters applied |
| T9 | e2e | `transactions page > URL is shareable (colleague sees same view)` | Set filters; share URL; colleague clicks link; sees identical filtered results |
| T10 | e2e | `transactions page > refreshing page preserves filter state` | Apply a filter; press F5; filter and results are identical after refresh |
| T11 | e2e | `transactions page > editing transaction and navigating back restores filter state` | Apply filter; click Edit on a row; navigate back (browser back button); exact filter state restored |
| T12 | e2e | `transactions page > malformed page parameter (page=abc) defaults to 1` | URL with page=abc; page loads; repository queried with page=1 |
| T13 | e2e | `transactions page > non-existent category ID in URL is ignored` | URL has categories=nonexistent; page loads; filter is ignored; all transactions shown |
| T14 | e2e | `transactions page > invalid type parameter defaults to null (All)` | URL has type=INVALID; page loads; both income and expense shown |
| T15 | e2e | `transactions page > malformed date range (from > to) is ignored server-side` | URL with customFrom > customTo; page loads; no date filter applied (server validation prevents query) |
| T16 | e2e | `transactions page > empty filter state results in clean URL` | No filters applied; URL is `/transactions` (no query params) or minimal params |
| T17 | e2e | `transactions page > multiple back-button navigations restore previous states` | Apply filter A, navigate; apply filter B, navigate; click back; filter B restored; click back again; filter A restored |
| T18 | e2e | `transactions page > extra/unknown URL parameters are ignored` | URL has `?foo=bar&type=INCOME`; foo is ignored; type filter works |
| T19 | integration | `transactions page server component > parses type from URL correctly` | URL `?type=INCOME`; repository called with type=INCOME |
| T20 | integration | `transactions page server component > parses categories from URL correctly` | URL `?categories=id1,id2`; repository called with categoryIds=[id1,id2] |
| T21 | integration | `transactions page server component > parses search from URL correctly` | URL `?search=electricity`; repository called with searchTerm=electricity |
| T22 | integration | `transactions page server component > parses datePreset from URL correctly` | URL `?datePreset=thisMonth`; period engine resolves to { from, to }; repository called with dateRange |
| T23 | integration | `transactions page server component > parses customFrom/customTo from URL correctly` | URL `?customFrom=2026-08-15&customTo=2026-08-20`; repository called with dateRange matching those dates |
| T24 | integration | `transactions page server component > parses sort from URL correctly` | URL `?sortField=amount&sortDirection=asc`; repository called with sort={field: "amount", direction: "asc"} |
| T25 | integration | `transactions page server component > parses page from URL correctly` | URL `?page=3`; repository called with page=3 |
| T26 | integration | `transactions page server component > handles missing/invalid page gracefully` | No page param or invalid value; defaults to page=1 |
| T27 | integration | `transactions page server component > round-trip: filters applied, URL updated, page refreshed, filters restored` | Apply type=INCOME, category=id1, sort=amount desc, page=2; refresh; all parameters are identical |
| T28 | unit | `nuqs integration > URL search params serialized correctly` | type, categories, search, datePreset, customFrom, customTo, sortField, sortDirection, page all round-trip losslessly |

**Red gate:** all tests written and failing. Commit before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**File: `app/(app)/transactions/page.tsx`** (Server Component)

Parse all query parameters from `searchParams`:

```typescript
export default async function TransactionsPage(
  props: {
    searchParams: Promise<{
      type?: string;
      categories?: string;
      search?: string;
      datePreset?: string;
      customFrom?: string;
      customTo?: string;
      sortField?: string;
      sortDirection?: string;
      page?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;

  // Parse type
  const typeParam = (["INCOME", "EXPENSE"].includes(searchParams.type)
    ? searchParams.type
    : null) as TransactionType | null;

  // Parse categories
  const categoryIdsParam = searchParams.categories
    ? searchParams.categories
        .split(",")
        .filter((id) => typeof id === "string" && id.length > 0)
    : [];

  // Parse search
  const searchTermParam = searchParams.search || undefined;

  // Parse date range
  let dateRangeParam: { from: Date; to: Date } | undefined;
  if (searchParams.datePreset) {
    dateRangeParam = resolvePeriodPreset(searchParams.datePreset);
  } else if (searchParams.customFrom && searchParams.customTo) {
    dateRangeParam = {
      from: new Date(searchParams.customFrom),
      to: new Date(searchParams.customTo),
    };
  }

  // Parse sort
  const sortField = (["occurredOn", "amount"].includes(searchParams.sortField)
    ? searchParams.sortField
    : "occurredOn") as "occurredOn" | "amount";
  const sortDirection = (["asc", "desc"].includes(searchParams.sortDirection)
    ? searchParams.sortDirection
    : "desc") as "asc" | "desc";

  // Parse page
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);

  // Query repository
  const transactions = await transactionRepository.findTransactionsPaginated(
    { type: typeParam, categoryIds: categoryIdsParam, dateRange: dateRangeParam, searchTerm: searchTermParam },
    { field: sortField, direction: sortDirection },
    page
  );

  const totals = await transactionRepository.aggregateTotals({
    type: typeParam,
    categoryIds: categoryIdsParam,
    dateRange: dateRangeParam,
    searchTerm: searchTermParam,
  });

  // Pass to client component along with searchParams for filter UI sync
  return (
    <div>
      <Filters currentSearchParams={searchParams} />
      <TotalsHeader income={totals.income} expenses={totals.expenses} />
      <TransactionsTable
        items={transactions.items}
        total={transactions.total}
        page={page}
        hasNextPage={transactions.hasNextPage}
        currentSort={{ field: sortField, direction: sortDirection }}
      />
    </div>
  );
}
```

**File: `components/transactions/filters.tsx`** (Client Component)

Each filter sub-component uses `useSearchParams()` and `useRouter()` to read and update URL state:

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function TypeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentType = searchParams.get("type") || "all";

  const handleChange = useCallback(
    (type: string) => {
      const params = new URLSearchParams(searchParams);
      if (type === "all") {
        params.delete("type");
      } else {
        params.set("type", type);
      }
      params.set("page", "1"); // Reset pagination
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div>
      <RadioGroup value={currentType} onValueChange={handleChange}>
        <Label>
          <RadioGroupItem value="all" />
          All
        </Label>
        <Label>
          <RadioGroupItem value="INCOME" />
          Income
        </Label>
        <Label>
          <RadioGroupItem value="EXPENSE" />
          Expense
        </Label>
      </RadioGroup>
    </div>
  );
}
```

Similarly for CategoryFilter, SearchInput, DateRangeFilter, SortHeader.

**File: `components/transactions/pagination.tsx`** (Client Component)

Update page via URL:

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function Pagination({ current, total, hasNextPage }: /* ... */) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePrevious = () => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(current - 1));
    router.push(`?${params.toString()}`);
  };

  const handleNext = () => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(current + 1));
    router.push(`?${params.toString()}`);
  };

  // Render Previous / Next buttons
}
```

**Alternative: Use `nuqs` library directly** (if available in the stack)

The `nuqs` library simplifies URL state management:

```typescript
import { useQueryState, parseAsString, parseAsInteger } from "nuqs";

export function TypeFilter() {
  const [type, setType] = useQueryState("type", parseAsString);

  const handleChange = (newType: string) => {
    setType(newType === "all" ? null : newType);
  };

  // Render...
}
```

This is simpler and is the intended approach per §8.1. If `nuqs` is not yet installed, add it:

```bash
npm install nuqs
```

**File: `lib/hooks/use-search-state.ts`**

A shared hook for parsing and syncing URL state (if not using nuqs):

```typescript
export function useTransactionFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();

  return {
    type: parseType(searchParams.get("type")),
    categories: parseCategories(searchParams.get("categories")),
    search: searchParams.get("search") || undefined,
    datePreset: searchParams.get("datePreset") || undefined,
    customFrom: searchParams.get("customFrom") || undefined,
    customTo: searchParams.get("customTo") || undefined,
    sortField: parseSortField(searchParams.get("sortField")),
    sortDirection: parseSortDirection(searchParams.get("sortDirection")),
    page: parsePageNumber(searchParams.get("page")),
    update: (partial: Partial<FilterState>) => {
      // Merge with current params, update URL
    },
  };
}
```

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] All filter, sort, page state in URL (FR-L10)
- [ ] URL is bookmarkable and shareable (users can copy/paste/share)
- [ ] URL persists on refresh (F5 restores state)
- [ ] Back-navigation from an edit restores exact filter state
- [ ] Malformed URL degrades gracefully (invalid params ignored or defaulted)
- [ ] Clean URL when no filters applied (minimal query string)
- [ ] Round-trip: state applied → URL updated → refresh → state restored
- [ ] Server component correctly parses all URL params
- [ ] Client components (filters, sort, pagination) sync with URL on user action
- [ ] No client-only state for filters (URL is the source of truth)
- [ ] nuqs library used (if available in the stack; otherwise, manual URL handling)
- [ ] `pnpm test`, `pnpm lint`, `pnpm tsc --noEmit` all pass
