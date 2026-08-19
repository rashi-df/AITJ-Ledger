# AITJ-M2-04 — Categories page with income and expense sections

| Field | Value |
|---|---|
| Milestone | M2 — Categories |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M0-06, AITJ-M0-07, AITJ-M1-01, AITJ-M2-01, AITJ-M2-02, AITJ-M2-03 |
| Blocks | AITJ-M2-05 |
| PRD refs | FR-C10, §8.2, §8.3, §10 page 7, NFR-3, NFR-4 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

The Categories page displays all categories in two sections: Income and Expense (FR-C10). Each section shows categories with their transaction count and lifetime total, computed by a single grouped SQL query in the repository (§8.3 — no N+1). Archived categories are hidden from each section but can be unarchived via an action button. Users can create, rename, archive, and delete categories from this page. The page is a Server Component fetching data once at render time, with interactive buttons triggering Server Actions (§8.2). Responsive at 360px with tap targets ≥44px (NFR-3) and keyboard accessible (NFR-4).

## Acceptance criteria

- [ ] AC1 — Route `/categories` (page 7 from §10) displays Income and Expense sections side-by-side on desktop, stacked on mobile
- [ ] AC2 — Each section lists all non-archived categories of that type from `getCategoriesWithStats(type)`, sorted by `sortOrder` then `name`
- [ ] AC3 — Each category row displays: name, transaction count (0–N), lifetime total formatted as `₹X,XX,XXX.00` (en-IN)
- [ ] AC4 — Each row has action buttons: Rename, Archive, Delete (Delete only if count = 0), Unarchive (hidden if not archived)
- [ ] AC5 — A "Create Category" button or form exists for each section (Income and Expense), opening a dialog or inline form with name input and type pre-selected
- [ ] AC6 — Successful create/rename/archive/delete/unarchive refreshes the section via `revalidatePath`; user sees updated list without page reload
- [ ] AC7 — Page title is "Categories" with a subtitle or description
- [ ] AC8 — A category with zero transactions shows count `0` and total `₹0.00`, not an error or blank
- [ ] AC9 — If no income categories exist, Income section shows a helpful message like "No income categories yet" with a CTA to create one
- [ ] AC10 — Same for Expense section if empty

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Page loads with no categories | Both Income and Expense sections show empty states with CTAs |
| E2 | One INCOME category with zero transactions | Shows `0` count and `₹0.00` total |
| E3 | Multiple categories in same section sorted correctly | Income categories sorted by sortOrder ascending, then name ascending |
| E4 | Archive button clicked on category with transactions | Category moves to archived list (section refreshes); no error |
| E5 | Delete button clicked on category with transactions | Button is disabled or error toast appears: "Cannot delete a category with transactions" |
| E6 | Delete button clicked on category with zero transactions | Category is removed; section refreshes |
| E7 | Rename button clicked, new name collides with existing one | Error toast: "A category with this name already exists"; category name unchanged |
| E8 | Unarchive button clicked on archived category | Category moves to non-archived section; section refreshes |
| E9 | Create form opened with Income pre-selected | Type field shows INCOME; creating assigns type correctly |
| E10 | Create form with Expense pre-selected | Type field shows EXPENSE; creating assigns type correctly |
| E11 | Create button clicked, form submitted empty or with only spaces | Validation error near name input: "Name is required" |
| E12 | Unauthenticated user navigates to `/categories` | Redirects to `/login` (session middleware) |
| E13 | Page viewed on mobile (360px) | Sections stack vertically; action buttons are ≥44px; text is readable |
| E14 | Page viewed on desktop (1920px) | Sections side-by-side; layout does not break; columns aligned |
| E15 | User clicks Rename, types new name, cancels | No change to database; dialog closes |
| E16 | Category name is very long (50 chars) | Displays fully or truncates with ellipsis; does not break layout |
| E17 | Both income and expense have "Other" category | Both appear correctly in their respective sections; no collision |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | unit | `app/(app)/categories/page.test.tsx > renders Categories page with heading` | Page contains heading "Categories" |
| T2 | integration | `app/(app)/categories/page.test.tsx > unauthenticated user redirected to login` | Navigate to `/categories` without session, assert redirect to `/login` |
| T3 | e2e | `categories.spec.ts > page loads and displays two sections` | Playwright: visit `/categories`, assert two sections exist (Income, Expense) |
| T4 | integration | `app/(app)/categories/page.test.tsx > loads categories without N+1` | Render page, spy on queries, assert exactly 2 queries: one `getCategoriesWithStats('INCOME')` and one for 'EXPENSE' (not one per category) |
| T5 | integration | `app/(app)/categories/page.test.tsx > empty state for no categories` | Render with no categories seeded, assert empty state messages in both sections |
| T6 | integration | `app/(app)/categories/page.test.tsx > lists non-archived income categories` | Seed 2 income and 2 expense, 1 income archived, render, assert 1 income in list and 0 in expense |
| T7 | integration | `app/(app)/categories/page.test.tsx > displays count and total per category` | Seed category with 2 transactions (`100.00` and `50.50`), render, assert category row shows `2` and `₹150.50` |
| T8 | integration | `app/(app)/categories/page.test.tsx > soft-deleted transactions excluded from count and total` | Seed category with 2 transactions, soft-delete 1, render, assert count=1 and total=amount of remaining |
| T9 | e2e | `categories.spec.ts > create income category button opens form` | Playwright: click Create Income button, assert form appears with name input focused |
| T10 | e2e | `categories.spec.ts > create category submits and refreshes list` | Playwright: create category "Sadaqah", assert it appears in Income section |
| T11 | e2e | `categories.spec.ts > rename category via dialog` | Playwright: click Rename on a category, submit new name, assert name updated in list |
| T12 | e2e | `categories.spec.ts > archive category removes it from section` | Playwright: click Archive, assert category no longer in non-archived list |
| T13 | e2e | `categories.spec.ts > delete category button disabled if count > 0` | Playwright: create category, create transaction with it, visit `/categories`, assert Delete button is disabled or shows error on click |
| T14 | e2e | `categories.spec.ts > delete category with count=0 removes it` | Playwright: create unused category, click Delete, assert category is gone |
| T15 | e2e | `categories.spec.ts > unarchive category returns it to list` | Playwright: archive a category, click Unarchive, assert it appears in non-archived list |
| T16 | e2e | `categories.spec.ts > income and expense sections coexist with same name` | Playwright: create income "Other" and expense "Other", assert both appear in their sections |
| T17 | e2e | `categories.spec.ts > page is responsive at 360px` | Playwright: set viewport to 360×640, navigate to `/categories`, assert no horizontal overflow, all buttons ≥44px |
| T18 | e2e | `categories.spec.ts > form validation errors display` | Playwright: submit empty name, assert error message "Name is required" or similar near input |

**Red gate:** All 18 tests written, failing for the right reason. For e2e, set up a test database with seed data. For integration server-component tests, mock `getCategoriesWithStats` and verify render output.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**File: `app/(app)/categories/page.tsx`** — Server Component

- Fetch non-archived INCOME categories: `await repository.getCategoriesWithStats('INCOME', { isArchived: false })`
- Fetch non-archived EXPENSE categories: `await repository.getCategoriesWithStats('EXPENSE', { isArchived: false })`
- Render two sections (Tailwind grid or flexbox, responsive)
- Each category row displays: name, count (right-aligned), total (right-aligned, currency formatted)
- Each row has action buttons (Rename, Archive, Delete, Unarchive as applicable)
- Include "Create Category" button per section, opening a dialog (shadcn Dialog)

**File: `app/(app)/categories/create-category-form.tsx`** — Client Component (shadcn Form + Zod)

- Form with `name` input and `type` select (pre-selected to INCOME or EXPENSE)
- Validation via `CreateCategoryInput` schema (from M2-02)
- On submit, call Server Action `createCategory` from `actions/categories.ts`
- On success, close dialog; on error, show toast

**File: `app/(app)/categories/rename-category-dialog.tsx`** — Client Component

- Opens when Rename clicked
- Input with current name pre-filled
- On submit, call `renameCategory` action
- Handle errors and success states

**File: `app/(app)/categories/delete-category-button.tsx`** — Client Component

- Shows Delete or a disabled state based on `transactionCount`
- On click, show confirmation dialog (if enabled): "Delete [category name]? This cannot be undone."
- Call `deleteCategory` action
- Handle errors (show toast if in-use)

**File: `app/(app)/categories/archive-category-button.tsx`** and `unarchive-category-button.tsx`** — Client Components

- Call respective actions on click
- No confirmation needed (archiving is not destructive)
- Show success toast

**Accessibility (NFR-4):**
- All buttons have `aria-label` or visible text
- Form inputs have associated `<label>` elements
- Dialog has focus management (auto-focus first input, trap focus)
- Keyboard navigation: Tab through buttons, Enter to submit, Esc to close dialog
- Color contrast: 4.5:1 for all text

**Responsiveness (NFR-3):**
- Desktop (≥768px): Income and Expense side-by-side via grid
- Mobile (<768px): stack vertically
- All tap targets ≥44px (buttons, clickable rows)
- Text legible at 360px

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Page calls `getCategoriesWithStats` exactly twice (once per type), not once per category
- [ ] Session assertion at the route level (middleware)
- [ ] No N+1 queries on page render
- [ ] Create/Rename/Archive/Delete/Unarchive all use Server Actions and trigger `revalidatePath`
- [ ] Archived categories excluded from both section queries
- [ ] Empty states clear and actionable
- [ ] Amounts formatted correctly (₹X,XX,XXX.00)
- [ ] Counts formatted as plain integers
- [ ] All buttons keyboard accessible and ≥44px
- [ ] Form validation errors display near inputs
- [ ] Responsive at 360px and 1920px; no horizontal scroll
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts (in logs), passwords, or tokens in logs
- [ ] Reviewed by review-agent → QA signed off
