# AITJ-M8-02 — Responsive QA from 360px to 1920px

| Field | Value |
|---|---|
| Milestone | M8 — Hardening |
| Depends on | AITJ-M1-02, AITJ-M3-01, AITJ-M4-01, AITJ-M5-01, AITJ-M6-01, AITJ-M7-01 |
| Blocks | AITJ-M8-03 |
| PRD refs | NFR-3, NFR-9, FR-L11, FR-R7, §13 Manual row |
| Est. | 2 days |
| Phase | 🔴 RED |

## Context

AITJ Ledger runs on phones (360px), tablets (768px), and desktops (1920px). NFR-3 requires fully responsive layout from 360px–1920px; tap targets ≥44px; and tables must become cards below 768px. NFR-9 specifies support for last 2 versions of Chrome, Safari, Firefox, Edge, iOS Safari, and Chrome Android. The RED phase is viewport screenshot and layout assertions at 360/768/1024/1920px that fail where a table has not collapsed or a tap target is under 44px. GREEN is the CSS and layout fixes.

## Acceptance criteria

- [ ] AC1 — Playwright viewport tests at 360px, 768px, 1024px, and 1920px capture baseline screenshots for all 8 routes; tests assert pixel-perfect match in CI
- [ ] AC2 — At 360px: transaction table (FR-L11) collapses to stacked cards showing Date, Type + Category, Amount, and row actions; sidebar is hidden, bottom tab bar appears; form inputs full-width
- [ ] AC3 — At 768px: sidebar reappears or is toggleable; table remains in card layout; charts scale but remain readable
- [ ] AC4 — At 1024px and above: table reverts to traditional row layout with horizontal scroll inside a fixed container (never page-level scroll); sidebar is full-width
- [ ] AC5 — All tap targets (buttons, links, row edit/delete actions, form inputs, select dropdowns, date picker, category picker popover) are ≥44×44px on touch viewports (mobile device pixel testing)
- [ ] AC6 — Text on small screens is readable without zoom at default font sizes; text wrap at 360px does not create orphaned words or break amounts/numbers across lines
- [ ] AC7 — Print view (FR-R7) renders full-width report with no sidebar, no tab bar; income/expense breakdown tables stack vertically on 360px; charts scale or are hidden in print
- [ ] AC8 — On 360px in landscape orientation: forms, modals, and dropdown popovers remain usable (no content clipped; scrollable if taller than viewport)
- [ ] AC9 — Form validation errors are visible at 360px; error message does not overflow input width
- [ ] AC10 — Dashboard cards (headline + all-time balance) stack vertically at 360px and horizontally at 768px+
- [ ] AC11 — Modal dialogs (delete confirmation, invite modal) are centred on all viewports; scrollable if content exceeds viewport height
- [ ] AC12 — Date picker popover (calendar) does not overflow viewport; month/year navigation is usable at 360px
- [ ] AC13 — Pagination controls (Previous, page numbers, Next) are tap-friendly at 360px; page input is >24px tall
- [ ] AC14 — Category and income/expense indicator icons/text remain visible and distinct at 360px with a 500-character description and a 50-character category name

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | 360px with 50-char category name + 500-char description + amount | Transaction card displays without overflow; text wraps; actions remain accessible |
| E2 | 360px landscape (e.g. 800×360) | Form inputs, modals, and charts remain usable within viewport or are scrollable; no horizontal scroll at page level |
| E3 | Long masjid name at 360px | Header text truncates gracefully or wraps; does not overflow navigation area |
| E4 | Empty transaction list at 360px | Empty state CTA ("Add a transaction") is >44px tall and tappable |
| E5 | 10-row transaction list at 360px | Each card is distinct and scrollable; tap actions (Edit, Delete) are well-spaced |
| E6 | Date range picker on mobile 360px | Start and end date inputs are sequential (not side-by-side); calendar picker is usable |
| E7 | Category multi-select filter at 360px | Dropdown is not wider than viewport; scrollable list of categories is visible |
| E8 | Print on mobile (requested from Safari/Chrome Mobile) | Print stylesheet removes mobile navigation; page outputs full-width A4; no horizontal clipping |
| E9 | 1920px with many transactions and categories | Table does not spill off-screen; horizontal scroll is contained within the table, not the page; sidebar and main content fit without page scroll |
| E10 | Safari on iPad (768px, pinch-zoom to 200%) | Layout reflows correctly; double-tap zoom is not disabled (no `user-scalable=no`); tap targets remain ≥44px |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `responsive > login 360px screenshot` | Visual regression test on `/login` at 360×667 matches baseline (test fails; baseline does not exist yet) |
| T2 | e2e | `responsive > dashboard 360px 768px 1024px 1920px screenshots` | Viewport comparison at 4 widths; sidebar/tab bar visibility and card layout change as expected; test fails before CSS fixes |
| T3 | e2e | `responsive > transaction table collapses to cards at 360px` | At 360px, `table` element is hidden or `display: none`; cards with `flex-col` or `grid` are visible; test fails if table is still in DOM |
| T4 | e2e | `responsive > tap target size at 360px mobile` | Every button, link, and row action has computed width and height ≥44px; test uses `locator.boundingBox()` or a DOM attribute check; fails if any element is <44px |
| T5 | e2e | `responsive > form input width at 360px` | Inputs span full available width (100%) without overflow; padding and border are included; test fails if input bleeds right edge |
| T6 | e2e | `responsive > delete modal scrollable at 360px landscape` | At 800×360, delete modal is centred and scrollable if taller than viewport; content is not clipped; test fails if modal overflows |
| T7 | e2e | `responsive > print view full-width no navigation` | Print stylesheet hides sidebar/tab bar; report renders full-width; test fails if navigation appears in print preview |
| T8 | e2e | `responsive > dashboard cards stack at 360px` | At 360px, 3 headline cards are in a single column (flex-col); at 768px+, they are 3 columns (flex-row); test fails if layout is wrong |
| T9 | e2e | `responsive > date picker popover not cut off at 360px` | Calendar picker stays within viewport bounds; does not overflow right edge or bottom; test fails if popover is clipped |
| T10 | e2e | `responsive > long description and category at 360px` | 500-char description in transaction card wraps; category name (50 chars) wraps; card height grows but does not overflow horizontally; test fails if text is cut off or overflows |
| T11 | e2e | `responsive > pagination at 360px tap-friendly` | Pagination buttons are >24px tall and >24px wide; prev/next links and page numbers are all tappable; test fails if any button is <24px |
| T12 | e2e | `responsive > Safari iPad 768px zoom to 200%` | Page reflows without breaking layout; tap targets remain ≥44px after zoom; test fails if layout breaks |

**Red gate:** Baseline screenshots do not exist; tests fail on first run. Computed tap-target sizes are <44px. Layout checks (table visibility, card layout) fail because CSS has not been applied.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] Baseline screenshots are captured and checked into version control
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

- **Viewport breakpoints:** Use Tailwind's standard breakpoints (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`). Below `md` (768px), use mobile layout; at `md`, transition to tablet; at `lg`, full desktop.
- **Transaction table/cards:** In `components/TransactionTable.tsx`, add responsive class: `hidden md:table` for table rows, `block md:hidden` for card layout. Cards at mobile use `flex flex-col gap-2` with a border or background to separate each row's fields.
- **Sidebar and tab bar:** In the app layout (`app/(app)/layout.tsx`), the sidebar is `hidden md:flex` and the bottom tab bar is `flex md:hidden` (or a toggle on tablet). Ensure the main content is full-width on mobile (no sidebar offset).
- **Form inputs:** All inputs, selects, and textareas are `w-full` on mobile; use `max-w-lg` or `max-w-2xl` on desktop to prevent them from stretching indefinitely.
- **Tap target sizing:** Buttons use `h-10 w-10` minimum (40px, but with padding achieves 44px). Row action buttons (`Edit`, `Delete`) are explicitly `h-11 w-11` or a button with `px-3 py-2` to meet 44px. Validate with `locator.boundingBox().height >= 44`.
- **Charts responsive:** Recharts charts use `width="100%"` and `height={300}` (mobile) or `height={400}` (desktop). Pass viewport width as a prop and use `@media (min-width: 768px)` to adjust height.
- **Print stylesheet:** Add to `globals.css`:
  ```css
  @media print {
    aside, nav, .bottom-tab-bar { display: none; }
    body { width: 100%; margin: 0; }
    .transaction-table { width: 100%; }
  }
  ```
- **Modal and popover positioning:** Use shadcn `Dialog` and `Popover` components which are positioned relative to viewport. Ensure `side="bottom"` or `side="auto"` for popovers on small screens to avoid being clipped.
- **Screenshot baselines:** Create `e2e/responsive.spec.ts` with `page.setViewportSize(360, 667)` for each route. On first run, use `page.screenshot()` to generate baseline PNGs. Commit baselines to `e2e/baselines/`. Subsequent runs compare against these.
- **Testing on real devices:** Use Playwright's `@playwright/test` with a `devices` option to test on Pixel 5 (412px), iPhone 12 (390px), iPad (768px). Run these in CI if possible, or manually verify on physical devices during QA.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Screenshot baselines captured and committed for all 8 routes at 4 viewport widths
- [ ] Tap target validation in CI (every button/link ≥44px)
- [ ] Sidebar hidden <768px, tab bar visible <768px
- [ ] Transaction table hidden <768px, card layout visible <768px
- [ ] Form inputs full-width on mobile, max-width on desktop
- [ ] Print stylesheet removes navigation, renders full-width
- [ ] Modal and popover stay within viewport bounds
- [ ] No horizontal page scroll on any viewport; only horizontal scroll in tables/containers with `overflow-x`
- [ ] Reviewed by review-agent → passed to qa-agent → real-device check on one Android phone and one iPhone → QA signed off
