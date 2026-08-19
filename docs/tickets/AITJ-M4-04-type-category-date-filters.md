# AITJ-M4-04 — Type, category and date-range filters

| Field | Value |
|---|---|
| Milestone | M4 — Transaction list |
| Depends on | AITJ-M4-01 (repository filtering), AITJ-M4-02 (table UI), AITJ-M5-01 (period engine for date presets) |
| Blocks | AITJ-M4-05, AITJ-M4-06 |
| PRD refs | FR-L4, FR-L5, FR-L6, §7 (date range validation), §8.1 (date-fns for IST), NFR-3 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

The /transactions page allows users to filter by transaction type (All / Income / Expense), one or more categories, and a date range. Date range offers quick presets (Today, This Week, This Month, This Year, Custom) using the same period logic as the dashboard (FR-L6, shared with M5-01). If M4 lands before M5, the period engine is a separate, reusable module that M4 depends on. Filters are applied server-side via the repository layer and are URL-encoded for shareability and bookmarking.

## Acceptance criteria

- [ ] AC1 — A Type filter with options: "All", "Income", "Expense"
- [ ] AC2 — A Category filter allowing zero, one, or multiple categories to be selected
- [ ] AC3 — Categories listed are non-archived and ordered by type (Income, then Expense)
- [ ] AC4 — An archived category used by historical transactions is still filterable and displays on rows (FR-C7)
- [ ] AC5 — A Date Range filter with presets: Today, This Week, This Month, This Year, Custom
- [ ] AC6 — Custom date range opens a date picker with start and end date inputs
- [ ] AC7 — Date boundaries are inclusive at both ends (a transaction on the exact from-date and to-date is included)
- [ ] AC8 — Date boundaries are computed in Asia/Kolkata (IST), not UTC or the user's local timezone (A2)
- [ ] AC9 — Selecting a filter instantly triggers a server query with page reset to 1
- [ ] AC10 — Multiple filter selections are combined (type AND categories AND date range, all must match)
- [ ] AC11 — Clicking a filter option again toggles it off; an empty filter selection (e.g. no categories checked) means "no filter on this dimension"
- [ ] AC12 — All filter state is URL-encoded and persists across refreshes (handled by AITJ-M4-06)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | No filters selected (type = All, no categories, no date range) | Shows all transactions |
| E2 | Type = Income, no category filter | Shows all income transactions of all categories |
| E3 | Type = Expense, one category selected | Shows only expenses in that category |
| E4 | Multiple categories selected (e.g. 2 of 10) | Shows transactions in any of the selected categories (OR) |
| E5 | All categories selected (all 10 checked) | Functionally same as no category filter; all transactions shown |
| E6 | Category that has no transactions in the current filter | Checkbox is present and filterable, but 0 results |
| E7 | Category is archived but has historical transactions | Category still appears in the filter list and can be selected; transactions from before archival display |
| E8 | Category ID that does not exist (tampered URL) | Filter is silently ignored; results show unfiltered (or only by other filters) |
| E9 | Date range: from = to (single day) | Transactions on that exact date included |
| E10 | Date range: from > to (inverted) | Validation rejects this; error shown; no query issued. Per §7, this is a form validation error. |
| E11 | Date range spanning more than 5 years | Per §7, validation rejects; error shown. Date range must be <= 5 years. |
| E12 | Date range where from/to are before 2000-01-01 | Validation rejects per §7; error shown |
| E13 | Custom date range picker, from and to have different times (if time input is visible) | Times are ignored; only the date part is used (A5, DATE type, no time component) |
| E14 | Preset "This Year" in December | Correctly resolves to 1 Jan – 31 Dec of the current calendar year (A4, client answer Q5) |
| E15 | Preset "This Week" at DST boundary | Correctly resolves in IST (A2); DST does not affect IST |
| E16 | Preset "Today" at midnight IST | Transaction dated today (in IST) is included; boundary is correct |
| E17 | Custom range, user clicks "Clear" or closes without selecting | Previous filters preserved; no change |
| E18 | All three filters combined (type + category + date) | Results match all three predicates; pagination shows accurate total |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `transactions page > type filter shows options: All, Income, Expense` | Dropdown or radio group with three options visible |
| T2 | e2e | `transactions page > type filter All shows both income and expense` | Select "All"; table shows mix of income and expense rows |
| T3 | e2e | `transactions page > type filter Income shows income only` | Select "Income"; all rows have type = "Income"; no expense rows |
| T4 | e2e | `transactions page > type filter Expense shows expense only` | Select "Expense"; all rows have type = "Expense" |
| T5 | e2e | `transactions page > category filter displays all non-archived categories` | Checkbox list visible; count matches seeded non-archived categories |
| T6 | e2e | `transactions page > category filter: selecting one category filters to that category` | 10 categories seeded; select 1; results show only that category |
| T7 | e2e | `transactions page > category filter: selecting multiple categories (OR)` | Select 2 of 10 categories; results include transactions from both categories |
| T8 | e2e | `transactions page > category filter: toggling all on then off reverts to no filter` | Select all 10; results show all; deselect all; results show all |
| T9 | e2e | `transactions page > category filter: archived category still appears if it has historical transactions` | Archive a category with transactions; reload filters; category still visible in list |
| T10 | e2e | `transactions page > category filter: selecting archived category includes historical transactions` | Archived category with 5 past transactions; select it; 5 rows appear |
| T11 | e2e | `transactions page > category filter: non-existent category ID (tampered URL) ignored` | URL contains `category=invalid-id`; filter is silently ignored; results unfiltered by category |
| T12 | e2e | `transactions page > date filter shows presets: Today, This Week, This Month, This Year, Custom` | Five buttons/options visible |
| T13 | e2e | `transactions page > date filter Today shows transactions from today only` | Select Today; verify transaction from today is included; transaction from yesterday is excluded |
| T14 | e2e | `transactions page > date filter This Week shows Mon–Sun of current week` | Select This Week; verify dates span a 7-day period; Monday is the start |
| T15 | e2e | `transactions page > date filter This Month shows all transactions this calendar month` | Select This Month; verify date range is 1st – last day of current month |
| T16 | e2e | `transactions page > date filter This Year shows Jan 1 – Dec 31 of current calendar year` | Select This Year; verify range is 2026-01-01 – 2026-12-31 (not Apr–Mar per Q5) |
| T17 | e2e | `transactions page > date filter Custom opens date picker` | Click Custom; two date inputs appear |
| T18 | e2e | `transactions page > custom date range: from and to are inclusive both ends` | Set from = 2026-08-15, to = 2026-08-20; transactions on exactly 2026-08-15 and 2026-08-20 are included |
| T19 | e2e | `transactions page > custom date range: excludes dates outside range` | from = 2026-08-15, to = 2026-08-20; transaction on 2026-08-14 is excluded |
| T20 | e2e | `transactions page > custom date range: from > to shows validation error` | from = 2026-12-31, to = 2026-01-01; error message displayed; no query issued |
| T21 | e2e | `transactions page > custom date range: span > 5 years shows validation error` | from = 2020-01-01, to = 2026-01-01 (6 years); error shown per §7 |
| T22 | e2e | `transactions page > custom date range computed in IST` | Preset boundaries (today, week, month, year) reflect IST, not UTC or local browser time |
| T23 | e2e | `transactions page > selecting filter instantly queries and resets to page 1` | On page 3; select a filter; page resets to 1; new results shown |
| T24 | e2e | `transactions page > combining type + category + date filters (all three)` | Type = Income, one category, This Month; results match all three |
| T25 | integration | `transactions repository > filter by type only` | type = "INCOME"; all results have type = "INCOME"; total correct |
| T26 | integration | `transactions repository > filter by categories (multiple)` | categoryIds = [id1, id2]; all results have one of those categories |
| T27 | integration | `transactions repository > filter by date range` | from = 2026-08-15, to = 2026-08-20; all results have occurredOn in range inclusive |
| T28 | integration | `transactions repository > combined type, category, date filter` | All three predicates applied; results match all |
| T29 | integration | `transactions repository > empty filters (type null, categoryIds empty, dateRange null)` | Returns all transactions |
| T30 | integration | `transactions repository > from > to returns empty (no error)` | from > to; items = [], total = 0 |

**Red gate:** all tests written and failing. Commit before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**File: `components/transactions/filters.tsx`**

A client component exposing three filter sub-components: TypeFilter, CategoryFilter, DateRangeFilter.

Each sub-component:
- Reads current filter state from URL params (via nuqs or manually).
- Updates URL params on selection.
- Triggers server-side query via URL change (the page Server Component re-fetches).

**TypeFilter:**
```typescript
const typeOptions = [
  { label: "All", value: null },
  { label: "Income", value: "INCOME" },
  { label: "Expense", value: "EXPENSE" },
];
```

Use a shadcn SegmentedControl or RadioGroup.

**CategoryFilter:**

Fetch the list of non-archived categories from the repository or a dedicated action:

```typescript
const categories = await categoryRepository.findNonArchived();
```

Display as a `<Popover>` or `<Dialog>` with checkboxes. Selected categories are stored in URL as comma-separated IDs: `?categories=id1,id2,id3`.

**DateRangeFilter:**

Use the period engine (from AITJ-M5-01 or a standalone module):

```typescript
import { resolvePeriodPreset } from "@/lib/period";

const presets = ["today", "thisWeek", "thisMonth", "thisYear"];
const resolved = resolvePeriodPreset("thisMonth"); // { from: Date, to: Date }
```

For Custom, display a date-range picker using shadcn's Popover + Calendar (date-fns).

**File: `lib/repositories/transaction.repository.ts`**

Update `findTransactionsPaginated` to accept filters:

```typescript
filters: {
  type?: TransactionType | null;
  categoryIds?: string[];
  dateRange?: { from: Date; to: Date };
  searchTerm?: string;
}
```

Build Prisma `where` clause:

```typescript
const where: Prisma.TransactionWhereInput = {
  deletedAt: null,
  ...(type && { type }),
  ...(categoryIds?.length && { categoryId: { in: categoryIds } }),
  ...(dateRange && {
    occurredOn: {
      gte: dateRange.from,
      lte: dateRange.to,
    },
  }),
  ...(searchTerm && {
    OR: [
      { description: { contains: searchTerm, mode: "insensitive" } },
      { category: { name: { contains: searchTerm, mode: "insensitive" } } },
    ],
  }),
};
```

**File: `lib/period/index.ts`** (if not already present; or use existing from M5-01 early)

Define:

```typescript
export function resolvePeriodPreset(
  preset: "today" | "thisWeek" | "thisMonth" | "thisYear" | null,
  baseDate: Date = new Date()
): { from: Date; to: Date } {
  const tz = "Asia/Kolkata";
  // Implementation using date-fns + @date-fns/tz
  // Ensures IST boundaries (A2)
}
```

**File: `app/(app)/transactions/page.tsx`**

Parse filter params from `searchParams`:

```typescript
const typeParam = searchParams.type || null;
const categoryIdsParam = searchParams.categories
  ? searchParams.categories.split(",")
  : [];
const datePreset = searchParams.datePreset || null;
const customFrom = searchParams.from || null;
const customTo = searchParams.to || null;

// Resolve date range
let dateRange: { from: Date; to: Date } | undefined;
if (datePreset) {
  dateRange = resolvePeriodPreset(datePreset);
} else if (customFrom && customTo) {
  dateRange = { from: new Date(customFrom), to: new Date(customTo) };
}

// Validate date range
if (dateRange && dateRange.from > dateRange.to) {
  // Handle error: render validation message
}

const transactions = await transactionRepository.findTransactionsPaginated(
  {
    type: typeParam,
    categoryIds: categoryIdsParam.filter(Boolean),
    dateRange,
    searchTerm: searchParams.search,
  },
  // ...
);
```

**File: `lib/validation/transaction-filters.ts`**

Add a Zod schema for date-range validation:

```typescript
export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
}).refine(
  (data) => data.from <= data.to,
  { message: "Start date must be before end date", path: ["from"] }
).refine(
  (data) => {
    const diffYears = (data.to.getFullYear() - data.from.getFullYear());
    return diffYears <= 5;
  },
  { message: "Date range must not exceed 5 years", path: ["from"] }
);
```

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Type filter: All / Income / Expense (FR-L4)
- [ ] Category filter: multi-select, includes archived if used (FR-L5, FR-C7)
- [ ] Date range filter: presets + custom, inclusive boundaries, IST-aware (FR-L6, A2)
- [ ] Date range validation: from <= to, span <= 5 years (§7)
- [ ] Filters combined with AND logic; pagination reset on filter change
- [ ] Date presets use period engine (from M5-01 or standalone)
- [ ] URL state for all filters (implemented in AITJ-M4-06)
- [ ] Repository filters applied correctly; no client-side post-filtering
- [ ] `pnpm test`, `pnpm lint`, `pnpm tsc --noEmit` all pass
