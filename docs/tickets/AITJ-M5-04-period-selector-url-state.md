# AITJ-M5-04 — Period selector with URL persistence

| Field | Value |
|---|---|
| Milestone | M5 — Dashboard |
| Depends on | AITJ-M5-01, AITJ-M0-06 |
| Blocks | AITJ-M5-03, M4-04 (list date filters) |
| PRD refs | FR-D3, FR-D9, FR-L6, §8.1, §8.2, A2, A3, A4 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

The dashboard and transaction-list pages both need a period selector that lets users choose Today, This Week, This Month, This Year, or Custom Range. The selected preset must persist in the URL query string (FR-D9, FR-L10) so the view can be bookmarked, shared, and survives a page refresh or back-navigation. The default on a first visit is "This Month" (FR-D3). Malformed or tampered query parameters degrade gracefully to the default rather than crashing. The selector is a client component using `nuqs` for URL state management; when the preset changes, the dashboard and charts automatically refetch (via `revalidateTag` or equivalent) and display the new period's totals.

## Acceptance criteria

- [ ] AC1 — Dashboard renders a period selector with five radio buttons or a dropdown: Today, This Week, This Month, This Year, Custom Range
- [ ] AC2 — Default selection on first visit (no URL params) is "This Month"
- [ ] AC3 — Selected preset is persisted in URL as a query parameter, e.g., `?period=ThisMonth` or similar
- [ ] AC4 — Custom Range shows date pickers for "From" and "To" when selected
- [ ] AC5 — Custom Range dates are also persisted in the URL, e.g., `?period=Custom&from=2026-08-01&to=2026-08-31`
- [ ] AC6 — Changing the preset triggers a data refetch for the dashboard cards, charts, and list (via server revalidation tag or similar)
- [ ] AC7 — A malformed URL parameter (e.g., `?period=InvalidPreset` or `?from=not-a-date`) degrades to "This Month" without crashing
- [ ] AC8 — "Custom Range" with from > to shows a validation error inline; does not submit or refetch
- [ ] AC9 — Responsive at 360px (radio buttons stack, or dropdown collapses) and 1920px; tap targets ≥44px
- [ ] AC10 — Keyboard accessible: Tab through selector, Enter/Space to select, arrow keys if using radio/select component

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | First visit, no URL params | Selector shows "This Month" selected by default |
| E2 | URL contains `?period=ThisMonth` | Selector reflects the persisted choice |
| E3 | URL contains `?period=Today` | Selector shows Today; cards and charts refetch for today's data |
| E4 | URL contains `?period=InvalidPreset` | Degrades to "This Month" without error or crash |
| E5 | URL contains `?period=Custom&from=2026-08-01&to=2026-08-31` | Selector shows Custom Range; date fields are populated |
| E6 | URL contains `?period=Custom&from=2026-08-31&to=2026-08-01` (reversed) | Validation error shown; no refetch or state change |
| E7 | URL contains `?period=Custom&from=not-a-date` | Malformed date degrades to "This Month" |
| E8 | User selects This Week on a Monday | URL updates; cards show 1 week of data |
| E9 | User selects This Week on a Sunday | URL updates; cards show 1 week ending on Sunday |
| E10 | User selects This Year | URL updates; cards show 1 Jan – 31 Dec for the current calendar year |
| E11 | User selects Custom Range and enters `2025-01-01` to `2026-12-31` | Validates span ≤ 5 years; updates URL and refetches |
| E12 | User enters a 6-year Custom Range | Shows inline validation error; URL does not update |
| E13 | Mobile viewport 360px | Selector is fully accessible; radio buttons or dropdown fits without horizontal scroll |
| E14 | User bookmarks a dashboard URL with `?period=Custom&from=2026-06-01&to=2026-08-31` | On revisit, the bookmark restores the exact same period and data |
| E15 | User shares the bookmarked URL with another authenticated user | The other user sees the same period and totals |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `Dashboard > Period selector > renders five presets` | Page contains labels or buttons for Today, This Week, This Month, This Year, Custom Range |
| T2 | e2e | `Dashboard > Period selector > default is This Month` | On first visit (no URL params), "This Month" is selected/highlighted |
| T3 | e2e | `Dashboard > Period selector > clicking This Month updates URL` | Click "This Month" button; URL updates to `?period=ThisMonth` (or equivalent encoding) |
| T4 | e2e | `Dashboard > Period selector > clicking Today updates URL and refetches` | Click "Today"; URL updates and dashboard cards refetch for today's data |
| T5 | e2e | `Dashboard > Period selector > clicking This Week updates URL` | Click "This Week"; URL updates and cards show this week's totals |
| T6 | e2e | `Dashboard > Period selector > URL persistence > reload with saved URL` | Set URL to `?period=ThisMonth`, reload page; selector still shows "This Month" |
| T7 | e2e | `Dashboard > Period selector > malformed preset degrades to default` | Visit `?period=InvalidPreset`; selector shows "This Month", no error |
| T8 | e2e | `Dashboard > Period selector > Custom Range > shows date pickers when selected` | Select "Custom Range"; two date input fields appear ("From" and "To") |
| T9 | e2e | `Dashboard > Period selector > Custom Range > updates URL with dates` | Enter from=2026-08-01, to=2026-08-31; URL updates to `?period=Custom&from=2026-08-01&to=2026-08-31` |
| T10 | e2e | `Dashboard > Period selector > Custom Range > from > to shows validation error` | Enter from=2026-08-31, to=2026-08-01; inline error appears, URL not updated |
| T11 | e2e | `Dashboard > Period selector > Custom Range > from == to valid single day` | Enter from=2026-08-15, to=2026-08-15; URL updates and cards show data for one day |
| T12 | e2e | `Dashboard > Period selector > Custom Range > 5-year span accepted` | Enter from=2026-01-01, to=2030-12-31; validation passes, URL updates |
| T13 | e2e | `Dashboard > Period selector > Custom Range > 6-year span rejected` | Enter from=2026-01-01, to=2031-12-31; validation error, URL not updated |
| T14 | e2e | `Dashboard > Period selector > malformed date degrades to default` | Visit `?period=Custom&from=not-a-date&to=2026-08-31`; selector shows "This Month" |
| T15 | e2e | `Dashboard > Period selector > bookmark URL > restores same period` | Bookmark dashboard with `?period=Custom&from=2026-01-01&to=2026-03-31`; open bookmark later; selector shows Custom Range with the same dates |
| T16 | e2e | `Dashboard > Period selector > mobile 360px > readable and accessible` | At 360px, selector is visible, buttons/options are tap-friendly (≥44px), no horizontal scroll |
| T17 | e2e | `Dashboard > Period selector > keyboard navigation > Tab through selector` | Focus selector with Tab; arrow keys (if radio) or Tab cycle through options; Enter/Space selects |
| T18 | e2e | `Dashboard > Period selector > shared URL > another user sees same period` | User A bookmarks `?period=Custom&from=2026-06-01&to=2026-08-31`; User B visits same URL; sees same totals and period |
| T19 | integration | `Period selector state > nuqs syncs URL to local state` | Verify nuqs integration: changing local state updates URL query params |
| T20 | integration | `Period selector state > reading URL params > applies to cards` | Verify cards re-render when URL params change (via revalidate tag or similar) |

**Red gate:** All tests written and failing. E2E tests fail because the selector component does not exist or does not update the URL. Integration tests fail because nuqs integration or state sync is not wired. Commit before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**File:** `components/dashboard/PeriodSelector.tsx` (Client Component using `use client`)

**Approach:**
- Import `useQueryState` from `nuqs` to manage URL-synced state
- Export a state variable `period` that reads from `?period` query param
- Export state setter that updates the URL
- Provide presets as an enum or const array: Today, ThisWeek, ThisMonth, ThisYear, Custom
- When a preset is selected, update the URL; the dashboard Server Component watches the query param and refetches
- For Custom Range, show two date input fields; validate before updating the URL
- Validation: reject from > to, reject span > 5 years, reject from < 2000-01-01
- On validation error, show inline message (e.g., in a toast or under the date fields); do NOT update the URL
- If URL contains a malformed preset or date, `useQueryState` returns the fallback or `null`; set local state to "ThisMonth" (the default)

**Server-side counterpart:**
- Dashboard Server Component (`app/(app)/dashboard/page.tsx`) reads `searchParams.period` via `useSearchParams()` or similar
- Pass the period preset to `resolvePeriod()` to get date boundaries
- Pass boundaries to `getPerioTotals()` to fetch period totals
- Charts and cards automatically re-render when the Server Component re-runs (Next.js revalidation)

**Validation schema** (Zod, in `lib/validation/period.ts`):
```typescript
export const periodPresetSchema = z.enum(['Today', 'ThisWeek', 'ThisMonth', 'ThisYear', 'Custom', 'AllTime']);
export const customRangeSchema = z.object({
  from: z.coerce.date().min(new Date('2000-01-01')),
  to: z.coerce.date(),
}).refine(data => data.from <= data.to, {
  message: "Start date must be before end date",
  path: ["from"],
}).refine(data => {
  const span = new Date(data.to).getTime() - new Date(data.from).getTime();
  const days = span / (1000 * 60 * 60 * 24);
  const years = days / 365.25;
  return years <= 5;
}, {
  message: "Date range must not exceed 5 years",
  path: ["to"],
});
```

**UI:** (shadcn Radio or Tabs or a Popover+Calendar for dates)
- Use shadcn `RadioGroup` for presets or `Tabs` if the design prefers
- Use shadcn `Popover` + `Calendar` (date-fns) for Custom Range date pickers
- Display validation errors inline using shadcn `Alert` or a simple `<p className="text-red-500">`

**Responsive:**
- Mobile (360px): radio buttons stack vertically; date pickers are full width
- Desktop: radio buttons in a row or tab strip; date pickers side by side

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Period selector renders all five presets plus Custom Range option
- [ ] `nuqs` integration wires URL query params to component state
- [ ] Default is "This Month" on first visit (no params)
- [ ] Changing preset updates URL and triggers Server Component refetch
- [ ] Custom Range validates: from ≤ to, span ≤ 5 years, from ≥ 2000-01-01
- [ ] Malformed URL params degrade to "This Month" without error
- [ ] Validation errors shown inline; URL not updated if validation fails
- [ ] Responsive at 360px and 1920px; tap targets ≥44px
- [ ] Keyboard accessible: Tab through options, Enter/Space to select
- [ ] Bookmarked and shared URLs restore the same period on re-visit
- [ ] No unused variables, imports, or dead code
- [ ] No date values or query params logged in sensitive contexts (NFR-8)
