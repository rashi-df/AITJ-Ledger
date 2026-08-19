# AITJ-M4-05 — Filtered totals header computed over the whole filter set

| Field | Value |
|---|---|
| Milestone | M4 — Transaction list |
| Depends on | AITJ-M4-01 (repository aggregation), AITJ-M4-02 (table UI), AITJ-M4-04 (filters) |
| Blocks | AITJ-M4-07 (CSS for header) |
| PRD refs | FR-L9, FR-L13, §8.3 (aggregation in SQL), NFR-1 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

The transactions page displays a header above the table showing three totals: **Total Income**, **Total Expenses**, and **Net** (Income − Expenses) for the **entire filtered set**, not just the current page of 25 rows (FR-L9). These totals are computed by SQL `SUM` aggregates applied to all rows matching the current filters, independent of pagination. A separate repository method handles this aggregation. The user can also export the entire filtered set to CSV (FR-L13), which must include all matching rows across all pages.

## Acceptance criteria

- [ ] AC1 — A header row above the transactions table displays three metrics: Total Income, Total Expenses, Net
- [ ] AC2 — Each metric is a SQL aggregate (`SUM`) over all rows matching the current filters, not a sum of the 25 rows on the page
- [ ] AC3 — The totals change instantly when filters are applied (page 1 and page 2 of the same filter set show identical totals)
- [ ] AC4 — Amounts in the header are formatted as en-IN currency (₹X,XX,XXX.XX)
- [ ] AC5 — Income total is always >= 0; Expense total is always >= 0; Net can be positive or negative
- [ ] AC6 — Net is calculated as (Total Income − Total Expenses); never summed directly from amounts
- [ ] AC7 — A CSV Export button is present; clicking it initiates a download of all transactions matching the current filters
- [ ] AC8 — CSV export includes all rows matching the filters (not just the current page)
- [ ] AC9 — CSV has columns: Date, Type, Category, Description, Amount
- [ ] AC10 — Amount column in CSV contains exact decimal strings (e.g. "1500.00"), never rounded floats

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | No transactions match the filter | Total Income = 0, Total Expenses = 0, Net = 0 |
| E2 | Page 1 shows 25 rows; page 2 shows 20 rows; totals are on page 1 | Totals on page 1 and page 2 are identical (same SQL aggregate) |
| E3 | Filter matches exactly 1 row | Totals reflect that one row's amounts |
| E4 | Filter matches exactly 25 rows | Totals are for all 25; hasNextPage is false |
| E5 | Filter matches exactly 26 rows | Page 1 totals are for all 26; page 2 totals are for all 26 (not just page 2's 1 row) |
| E6 | Filter matches 10,000 rows | SQL `SUM` completes in < 100ms; totals are accurate |
| E7 | A soft-deleted row matches the pre-delete filter | Deleted row excluded from totals and count |
| E8 | Only expense transactions, no income | Total Income = 0; Total Expenses = sum of all; Net = negative |
| E9 | Mixed income and expense types, positive and negative net | Net is positive; all three totals are present and correct |
| E10 | CSV export with description containing comma | CSV row is properly escaped (comma inside quotes) |
| E11 | CSV export with description containing quote | CSV row has quotes escaped ("quote" becomes ""quote"") |
| E12 | CSV export with description containing newline | CSV row has newline as is (within quoted field) or escaped |
| E13 | CSV export with description starting with =, +, −, @ (CSV injection) | Character is escaped or row is neutral (no formula executed) |
| E14 | CSV export ordered by sort state (e.g. date descending) | Exported CSV rows are in the same order as the displayed table |
| E15 | CSV export empty filter matches no rows | CSV has headers only; no data rows |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `transactions page > totals header displays above table` | Three metric cards visible: "Total Income", "Total Expenses", "Net" |
| T2 | e2e | `transactions page > totals header shows SQL aggregate for entire filtered set` | Page 1 with 30 matching rows shows totals for all 30; navigate to page 2; totals unchanged |
| T3 | e2e | `transactions page > total income formatted as en-IN currency` | Total Income = ₹1,50,000.00 (or equivalent) |
| T4 | e2e | `transactions page > total expenses formatted as en-IN currency` | Total Expenses = ₹1,50,000.00 |
| T5 | e2e | `transactions page > net calculated as income - expenses` | Income = 200,000, Expenses = 50,000; Net = 150,000 |
| T6 | e2e | `transactions page > net is negative when expenses > income` | Income = 50,000, Expenses = 200,000; Net = -150,000 displayed clearly |
| T7 | e2e | `transactions page > totals update instantly when filter changes` | Initial totals shown; apply a new filter; totals update immediately without page reload |
| T8 | e2e | `transactions page > totals are zero when no rows match filter` | Apply a filter matching no rows; all three totals = 0 |
| T9 | e2e | `transactions page > CSV export button is visible` | Button labeled "Export to CSV" or "Download CSV" present |
| T10 | e2e | `transactions page > CSV export downloads a file` | Click export; browser downloads a .csv file |
| T11 | e2e | `transactions page > CSV export file has columns: Date, Type, Category, Description, Amount` | Open CSV; first row contains these headers |
| T12 | e2e | `transactions page > CSV export includes all filtered rows (not just page 1)` | Filter matches 100 rows; export file contains 100 data rows (+ 1 header) |
| T13 | e2e | `transactions page > CSV export respects current sort order` | Sort by date descending; export; rows in CSV are in date-descending order |
| T14 | e2e | `transactions page > CSV export amount column contains exact decimals (no floats)` | Amount "1500.00" in CSV; not 1500 or 1500.0000000001 |
| T15 | integration | `transactions repository > aggregateTotals returns sum of income and expenses separately` | Seed 5 income (100, 200, 300) and 3 expense (50, 75, 100); totals = { income: "600.00", expenses: "225.00" } |
| T16 | integration | `transactions repository > aggregateTotals excludes soft-deleted rows` | Seed 5 income (100 each = 500); delete one; aggregateTotals returns "400.00" for income |
| T17 | integration | `transactions repository > aggregateTotals with type filter` | typeFilter = "INCOME"; totals reflect only income rows |
| T18 | integration | `transactions repository > aggregateTotals with category filter` | categoryIds = [catId]; totals reflect only that category |
| T19 | integration | `transactions repository > aggregateTotals with date range filter` | from = "2026-08-15", to = "2026-08-20"; totals include only rows in that range |
| T20 | integration | `transactions repository > aggregateTotals with combined type, category, date filters` | All three filters applied; totals match only rows satisfying all three |
| T21 | integration | `transactions repository > aggregateTotals empty filter set returns zero` | No rows seeded; aggregateTotals returns { income: "0.00", expenses: "0.00" } |
| T22 | integration | `transactions repository > aggregateTotals matches sum of all pages when paginated` | 50 rows total, paginate by 25; aggregate on full set = sum of page 1 + page 2 aggregates |
| T23 | integration | `transactions repository > aggregateTotals on 10,000 rows completes in < 50ms` | Seed 10,000; query time < 50ms (part of NFR-1 budget) |
| T24 | unit | `CSV export > description with comma is escaped` | Description = "Item, price: 100"; CSV row has "Item, price: 100" within quotes |
| T25 | unit | `CSV export > description with quote is escaped (double quote)` | Description = 'Item "premium"'; CSV row has 'Item ""premium""' |
| T26 | unit | `CSV export > description with newline preserved (or escaped)` | Description with \n; CSV row preserves or escapes newline correctly per RFC 4180 |
| T27 | unit | `CSV export > description starting with = is escaped (CSV injection prevention)` | Description = "=SUM(A1:A10)"; CSV has leading character escaped or removed |
| T28 | unit | `CSV export > CSV format complies with RFC 4180` | Headers, quoting, escaping follow standard |

**Red gate:** all tests written and failing. Commit before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**File: `lib/repositories/transaction.repository.ts`**

Add method:

```typescript
async aggregateTotals(
  filters: {
    type?: TransactionType | null;
    categoryIds?: string[];
    dateRange?: { from: Date; to: Date };
    searchTerm?: string;
  }
): Promise<{ income: Decimal; expenses: Decimal }>
```

Uses the same `where` clause as `findTransactionsPaginated`, but issues two `aggregate` queries:

```typescript
const whereClause = { /* ... same as pagination ... */ };

const incomeSum = await prisma.transaction.aggregate({
  where: { ...whereClause, type: "INCOME" },
  _sum: { amount: true },
});

const expenseSum = await prisma.transaction.aggregate({
  where: { ...whereClause, type: "EXPENSE" },
  _sum: { amount: true },
});

return {
  income: incomeSum._sum.amount ?? new Decimal(0),
  expenses: expenseSum._sum.amount ?? new Decimal(0),
};
```

Alternatively, issue a single `aggregateRaw` query if Prisma's aggregate does not group well, or use raw SQL with proper parameterization.

**File: `components/transactions/totals-header.tsx`**

A client component (or Server Component that fetches totals):

```typescript
export function TotalsHeader({
  income,
  expenses,
}: {
  income: string; // Decimal as string from repository
  expenses: string;
}) {
  const net = new Decimal(income).minus(expenses);

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader>
          <CardTitle>Total Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(income)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(expenses)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Net</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              net.isNegative() ? "text-red-600" : "text-green-600"
            }`}
          >
            {formatCurrency(net.toString())}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**File: `app/(app)/transactions/page.tsx`**

Call `aggregateTotals` with the same filter state as the pagination query:

```typescript
const totals = await transactionRepository.aggregateTotals({
  type: typeParam,
  categoryIds: categoryIdsParam,
  dateRange,
  searchTerm: searchParams.search,
});

// Pass to the page or to <TotalsHeader />
```

**File: `actions/export-transactions.ts`**

A Server Action that:

1. Asserts session.
2. Accepts filter state (type, categories, dateRange, searchTerm) and sort params.
3. Queries the repository with those filters (no pagination).
4. Formats rows as CSV (RFC 4180 compliant).
5. Returns CSV data or streams it as a file download.

```typescript
export async function exportTransactionsToCSV(
  filters: FilterState,
  sort: SortState
): Promise<string> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const transactions = await transactionRepository.findTransactionsPaginated(
    filters,
    sort,
    1 // Dummy page; fetch all via a separate "export" method or loop
  );

  // Convert to CSV
  const csv = generateCSV(transactions);
  return csv;
}
```

Actually, add a dedicated `findTransactionsForExport` method to the repository that returns all matching rows (no pagination):

```typescript
async findTransactionsForExport(
  filters: FilterState,
  sort: SortState
): Promise<TransactionWithCategory[]>
```

**File: `lib/csv/generate.ts`**

CSV generation helper (RFC 4180):

```typescript
export function generateCSV(rows: Transaction[]): string {
  const headers = ["Date", "Type", "Category", "Description", "Amount"];
  const lines = [headers.map(escapeCSVField).join(",")];

  for (const row of rows) {
    lines.push(
      [
        format(new Date(row.occurredOn), "dd MMM yyyy"),
        row.type,
        row.category.name,
        row.description || "",
        row.amount.toString(),
      ]
        .map(escapeCSVField)
        .join(",")
    );
  }

  return lines.join("\n");
}

function escapeCSVField(field: string): string {
  if (
    field.includes(",") ||
    field.includes('"') ||
    field.includes("\n") ||
    /^[=+\-@]/.test(field)
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
```

**File: `components/transactions/export-button.tsx`**

A client component:

```typescript
"use client";

import { exportTransactionsToCSV } from "@/actions/export-transactions";

export function ExportButton(filters: FilterState, sort: SortState) {
  const handleExport = async () => {
    const csv = await exportTransactionsToCSV(filters, sort);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return <Button onClick={handleExport}>Export to CSV</Button>;
}
```

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Totals header displays Income, Expenses, Net (FR-L9)
- [ ] Totals computed as SQL aggregates over entire filtered set, not just current page
- [ ] Total count and aggregate query do not each trigger a separate full scan (verify approach in implementation notes)
- [ ] Amounts formatted as en-IN currency (A1)
- [ ] Net = Income − Expenses; never summed directly
- [ ] CSV export includes all filtered rows (FR-L13)
- [ ] CSV format RFC 4180 compliant with proper escaping (commas, quotes, newlines, CSV injection)
- [ ] CSV amounts are decimal strings, never floats
- [ ] CSV respects sort order (row order matches the displayed table)
- [ ] CSV export respects all filters and sort state
- [ ] Query times: aggregate < 50ms, export < 500ms on 10,000 rows (part of NFR-1)
- [ ] `pnpm test`, `pnpm lint`, `pnpm tsc --noEmit` all pass
