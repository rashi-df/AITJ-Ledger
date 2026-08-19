# AITJ-M4-03 — Debounced free-text search across description and category

| Field | Value |
|---|---|
| Milestone | M4 — Transaction list |
| Depends on | AITJ-M4-01 (search in repository), AITJ-M4-02 (table UI) |
| Blocks | AITJ-M4-06 (URL state includes search) |
| PRD refs | FR-L3, §8.1 (nuqs for URL state, no library specified for debounce), §10 page 5 |
| Est. | 0.5 days |
| Phase | 🔴 RED |

## Context

Users need to search transactions by description text or category name, case-insensitive. The search term is debounced (no query on every keystroke) and sent to the server to filter the transaction list. Search results are paginated and sorted like any other list view. The search box is a prominent UI element on the /transactions page and updates the URL query string so a search can be bookmarked or shared.

## Acceptance criteria

- [ ] AC1 — A search input field is visible on the /transactions page
- [ ] AC2 — Typing a search term is debounced; the repository query is triggered only after 300ms of inactivity
- [ ] AC3 — Search matches descriptions case-insensitive, matching any substring (e.g. "electric" matches "Electricity bill")
- [ ] AC4 — Search also matches category names case-insensitive and by substring
- [ ] AC5 — Matching a description matches a transaction; matching a category name matches all transactions with that category
- [ ] AC6 — Search term with special regex/SQL characters (%, _, ', ", backslash) is escaped and does not break the query
- [ ] AC7 — Clearing the search input (empty string or backspace to clear) removes the filter and shows all results
- [ ] AC8 — The search term is URL-encoded in the query string and persists across page refreshes
- [ ] AC9 — When a user enters a search term, the page resets to page 1 (does not leave them on page 5 of old results)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | User types very quickly | Debounce fires only once after typing stops; no multiple queries |
| E2 | User clears and retypes same term rapidly | Debounce prevents duplicate queries; results are fresh |
| E3 | Search term is all spaces | Treated as no filter (empty string); all results shown |
| E4 | Search term "electricity" matches "ELECTRICITY", "Electricity Bill", "ElectRICity" | Case-insensitive match confirmed |
| E5 | Search term matches category "Jumu'ah" but no descriptions | Rows with that category are returned |
| E6 | Search term matches description but category name is archived | Row still appears (archived categories show on historical rows, FR-C7) |
| E7 | Search term "%20%" (URL-encoded space and wildcard) | Unescaped and matched literally; does not become a 20-character wildcard |
| E8 | Search term "'" (single quote) | Escaped; query does not fail; returns only true matches |
| E9 | Search term is very long (500+ chars) | Query executes (no crash); returns no false positives |
| E10 | User searches, then navigates to page 3, then clears search | Page resets to 1; all results shown |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `transactions page > search input is visible and focusable` | Input field with placeholder "Search description or category..." is present and can receive focus |
| T2 | e2e | `transactions page > typing search term triggers query after 300ms debounce` | Type "electricity"; wait; verify query is called; type another char before 300ms expires; verify only one query fires |
| T3 | e2e | `transactions page > search matches description case-insensitive` | Transaction with description "Electricity Bill" created; search for "electricity"; row appears; search for "BILL"; row appears |
| T4 | e2e | `transactions page > search matches category name case-insensitive` | Category "Jumu'ah Collection"; transaction with that category; search "jum"; row appears |
| T5 | e2e | `transactions page > search is substring match (partial)` | Search "elec" matches "Electricity"; search "collec" matches "Jumu'ah Collection" |
| T6 | e2e | `transactions page > search result matches description OR category (union)` | Two transactions: one with matching description, one with matching category but non-matching description; both appear in results |
| T7 | e2e | `transactions page > search term with % character does not wildcard` | Search "%"; does not return all rows; either returns none or only those containing literal % |
| T8 | e2e | `transactions page > search term with _ character does not wildcard` | Search "_"; does not match single-char categories; literal match only |
| T9 | e2e | `transactions page > search term with single quote is escaped and matches` | Search "Can't"; query does not fail; returns rows with "Can't" in description |
| T10 | e2e | `transactions page > search term with double quote is escaped` | Search containing `"`; query executes without SQL error |
| T11 | e2e | `transactions page > search term with backslash is escaped` | Search "C:\\"; query does not fail |
| T12 | e2e | `transactions page > clearing search removes filter` | Search "electricity"; rows filtered; clear input; all results reappear |
| T13 | e2e | `transactions page > search term in URL persists on page refresh` | Search "electricity"; URL contains "search=electricity"; refresh; search term and results are restored |
| T14 | e2e | `transactions page > search resets pagination to page 1` | On page 3 of unfiltered results; search "electricity"; page resets to 1 |
| T15 | integration | `transactions repository > findTransactionsPaginated with searchTerm filters correctly` | searchTerm = "electricity"; call repository; verify only rows with "electricity" in description or category name are returned |
| T16 | integration | `transactions repository > search escapes special chars and matches literally` | searchTerm = "%test'quote"; verify rows with literal "%test'quote" are found, and SQL is not broken |
| T17 | e2e | `transactions page > search on empty database returns empty state` | Zero transactions; search anything; "No results for..." message shown |
| T18 | e2e | `transactions page > search whitespace-only term treated as no filter` | Search "   "; all results shown; same as if search were empty |

**Red gate:** all tests written and failing. Commit before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**File: `components/transactions/search-input.tsx`**

A client component with a debounced input:

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchTerm(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams);
        if (value.trim()) {
          params.set("search", value.trim());
        } else {
          params.delete("search");
        }
        params.set("page", "1"); // Reset to page 1

        startTransition(() => {
          router.push(`?${params.toString()}`);
        });
      }, 300);
    },
    [router, searchParams]
  );

  return (
    <Input
      type="text"
      placeholder="Search description or category..."
      value={searchTerm}
      onChange={(e) => handleSearch(e.target.value)}
      disabled={isPending}
      className="w-full"
    />
  );
}
```

**File: `app/(app)/transactions/page.tsx`**

Pass `searchParams.search` (if present) to the repository:

```typescript
const searchTerm = searchParams.search || undefined;
const transactions = await transactionRepository.findTransactionsPaginated(
  {
    searchTerm,
    // ... other filters
  },
  // ...
);
```

**File: `lib/repositories/transaction.repository.ts`**

The `findTransactionsPaginated` method already handles the `searchTerm` filter (from AITJ-M4-01). Ensure it:

1. Accepts `searchTerm?: string`.
2. If `searchTerm` is provided and non-empty, filters where:
   ```
   (description ILIKE '%${escapedTerm}%' OR category.name ILIKE '%${escapedTerm}%')
   ```
3. Escapes the term using Prisma's parameter binding or a manual escape function.

**Escape function** (if not already present):

```typescript
function escapeLikeWildcards(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}
```

Then use in Prisma:
```typescript
const escaped = escapeLikeWildcards(searchTerm);
where: {
  OR: [
    { description: { contains: searchTerm, mode: "insensitive" } },
    { category: { name: { contains: searchTerm, mode: "insensitive" } } },
  ],
}
```

**URL state:** The search term is handled by AITJ-M4-06 (URL state via nuqs), but the core search debouncing and filtering are implemented here.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Search input visible and debounced (300ms)
- [ ] Matches description and category case-insensitive (FR-L3)
- [ ] Special characters escaped; query does not break (FR-L3)
- [ ] Search term in URL, persists on refresh (FR-L10, verified in integration with AITJ-M4-06)
- [ ] Search resets pagination to page 1
- [ ] Clearing search removes filter
- [ ] Repository query called with searchTerm filter; matches description OR category name
- [ ] No N+1 queries; query count is 1
- [ ] `pnpm test`, `pnpm lint`, `pnpm tsc --noEmit` all pass
