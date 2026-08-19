# AITJ-M6-06 — Print stylesheet and print view

| Field | Value |
|---|---|
| Milestone | M6 — Reports |
| Depends on | AITJ-M6-03, AITJ-M7-04 |
| Blocks | none |
| PRD refs | FR-R7, A11, §8.1, §3.3, §13, NFR-4 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

The report has a print view optimized for producing a PDF via the browser's native print-to-PDF (Ctrl+P / Cmd+P). It removes all navigation chrome, displays the masjid name and period in a clean header, and ensures readability in greyscale (since committees print in black and white). Income and expense categories are distinguished by means other than colour (NFR-4). The print stylesheet uses `@media print` to hide navigational elements and adjust layout; there is no headless-Chromium dependency in the container (§3.3, §8.1). The masjid display name is read from `AppSetting` (FR-S3, A11) with a fallback to "AITJ Ledger" if not yet configured (accounting for the case where M7 lands after M6).

## Acceptance criteria

- [ ] AC1 — Print view is accessible at `/reports?print=true` or via a Print button on the reports page
- [ ] AC2 — When `print=true` is set, the page renders in print-optimized mode: sidebar and navigation are hidden, full-width layout, clean typography
- [ ] AC3 — Print header displays: masjid name (from `AppSetting.masjidName`, fallback "AITJ Ledger"), period (e.g. "January 1 – 31, 2024")
- [ ] AC4 — Print header is styled prominently (larger font, centered or positioned at top) without excessive whitespace
- [ ] AC5 — All interactive elements (buttons, links) are hidden in print mode, making the page clean
- [ ] AC6 — The report body (totals, breakdown tables) is fully visible in print mode; no elements are cut off
- [ ] AC7 — A breakout table (income or expense breakdown) longer than one page repeats its header row on each subsequent page
- [ ] AC8 | Totals footer row is not orphaned at the bottom of a page (print widows/orphans control)
- [ ] AC9 — The page is readable in greyscale: income rows and expense rows are distinguished by icon/text marker (not color); contrast ≥ 4.5:1
- [ ] AC10 — Very long masjid names (up to 100 chars) do not break the print header layout; text wraps or is sized to fit
- [ ] AC11 — Currency amounts are formatted en-IN (₹1,50,000.00) in print output, exact decimal strings
- [ ] AC12 — Browser print-to-PDF produces a valid, readable PDF file (tested in Chrome and Safari per §13)
- [ ] AC13 — Print preview is functional in both Chrome and Safari (manual verification)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Masjid name not yet set (AppSetting missing or M7-04 not deployed) | Print header shows "AITJ Ledger" as fallback; no error or blank header |
| E2 | Masjid name is very long (e.g. 100 chars) | Header text wraps or scales gracefully; does not overflow or break layout |
| E3 | Custom date range spanning 5 years | Print header shows full date range (e.g. "January 1, 2020 – December 31, 2024"); entire report renders within reasonable page count |
| E4 | Income breakdown table with 20+ categories (longer than one page) | Table header repeats on subsequent pages; rows do not orphan |
| E5 | Single-row breakdown (one category) | Renders on a single page; no page break issues |
| E6 | Empty breakdown (zero income or zero expenses) | Relevant section (Income or Expense) shows "No transactions" message or headers only; does not cause layout shift or orphaning |
| E7 | Printing in Safari on macOS | Print preview and PDF output match Chrome; no rendering differences |
| E8 | Printing on iPhone or iPad | Browser print dialog works; PDF can be saved to Files or emailed |
| E9 | Very large report (10k+ transactions, 100+ categories — unlikely but edge case) | Print completes; multiple pages of tables; all data visible |
| E10 | Page size A4 vs Letter | Layout adapts to page size (CSS should handle this natively via page size settings or let browser handle defaults) |
| E11 | Print margins set to 0 by user | Header and content remain readable; no unintended cutoff (browser's print defaults apply) |
| E12 | Report with negative closing balance | Negative amount displays as −₹500.00 (minus sign) in print; contrast and readability maintained |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `print view > accessible via ?print=true URL param` | Navigate to `/reports?print=true`, page loads without error |
| T2 | e2e | `print view > print button present on reports page` | Reports page has button labeled "Print" or "Print Report" |
| T3 | e2e | `print view > clicking print button sets print param or opens print dialog` | Click Print button, URL changes to include `?print=true` or browser print dialog opens |
| T4 | e2e | `print view > sidebar and navigation hidden in print mode` | In print mode (or via browser dev tools print emulation), sidebar, tabs, and action buttons are not visible |
| T5 | e2e | `print view > header displays masjid name and period` | Print view shows masjid name (e.g. "AITJ Ledger" or custom) and period text prominently at the top |
| T6 | e2e | `print view > masjid name from AppSetting if set, else fallback` | If `AppSetting.masjidName` is set to "Al-Hana Masjid", print header shows that; if not set, shows "AITJ Ledger" |
| T7 | e2e | `print view > currency formatted as en-IN in print` | All amounts show ₹ symbol and Indian digit grouping (₹1,50,000.00) in print output |
| T8 | e2e | `print view > income and expense rows distinguished by icon or text, not color alone` | Print output (or greyscale render) shows income rows with "+" or "Income" label, expense rows with "−" or "Expense" label |
| T9 | e2e | `print view > no interactive elements visible (buttons, links)` | In print mode, Export button, period selector, and other interactive UI is hidden |
| T10 | e2e | `print view > table headers repeat on page breaks` | Income or Expense Breakdown table longer than one page has headers on second+ pages (browser print preview shows this) |
| T11 | e2e | `print view > totals row not orphaned at page bottom` | Footer row with totals is on same page as its table or moved to top of next page (not orphaned alone at bottom) |
| T12 | e2e | `print view > long masjid name does not break header layout` | Header with 100-char masjid name wraps gracefully or scales; does not overflow or distort |
| T13 | e2e | `print view > print emulation in Chrome DevTools shows no layout errors` | Open DevTools, enable print media emulation, viewport shows clean print layout |
| T14 | e2e | `print view > print emulation in Safari shows clean output` | Safari print preview (Cmd+P) shows report without layout errors or cut-off content |
| T15 | integration | `print view > masjid name defaults to "AITJ Ledger" if AppSetting not found` | If `AppSetting` table has no `masjidName` key, Server Component passes fallback "AITJ Ledger" to print layout |
| T16 | integration | `print view > masjid name read at render time` | If `AppSetting.masjidName` is updated, print view reflects the new name on next load (not cached) |
| T17 | e2e | `print view > very long report (5-year range) renders fully` | Custom range 5 years, print mode loads all pages; no data is cut off |
| T18 | e2e | `print view > PDF generated by browser print-to-PDF is readable` | Print to PDF in Chrome, open PDF, verify text is legible and layout is intact |
| T19 | e2e | `print view > print accessible from mobile viewport (360px)` | At 360px, print view is accessible; print button works; browser print dialog opens |
| T20 | manual | `print view > Chrome print-to-PDF verified visually` | Print to PDF in Chrome 127+, inspect PDF, verify header, tables, totals, greyscale readability |
| T21 | manual | `print view > Safari print-to-PDF verified visually` | Print to PDF in Safari 17+, inspect output, verify same layout and content as Chrome |

**Red gate:** all 21 tests written and failing (T20–T21 may be manual assertions). Commit failing tests before implementing.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out
- [ ] Manual verification: print preview in Chrome and Safari reviewed and signed off by QA

## Implementation notes

**Print stylesheet** (`app/(app)/reports/print.css` or inline in layout):
```css
@media print {
  /* Hide navigation and interactive elements */
  [data-print-hide],
  .sidebar,
  .navbar,
  .navigation,
  button,
  .export-buttons,
  .period-selector,
  a[href]:not([href="#"]) {
    display: none !important;
  }

  /* Full-width layout */
  body {
    margin: 0;
    padding: 0.5in;
  }

  /* Print header */
  .print-header {
    border-bottom: 1px solid #333;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    text-align: center;
  }

  .print-header h1 {
    font-size: 18pt;
    font-weight: bold;
    margin: 0 0 0.5rem 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .print-header .period {
    font-size: 12pt;
    color: #333;
    margin: 0;
  }

  /* Table styling */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    page-break-inside: avoid;
  }

  thead {
    display: table-header-group; /* Repeat header on page breaks */
  }

  tbody {
    display: table-row-group;
  }

  tr {
    page-break-inside: avoid;
  }

  td, th {
    border: 1px solid #ccc;
    padding: 0.5rem;
    text-align: left;
  }

  th {
    background-color: #f5f5f5;
    font-weight: bold;
  }

  /* Greyscale-safe icons/markers for income/expense */
  .income-marker::before {
    content: "+ ";
    font-weight: bold;
  }

  .expense-marker::before {
    content: "− ";
    font-weight: bold;
  }

  /* No orphaning of footer rows */
  tfoot {
    display: table-footer-group;
    font-weight: bold;
    page-break-inside: avoid;
  }

  /* Currency and text colors */
  body {
    color: #000;
    background: #fff;
  }

  a {
    color: #000;
    text-decoration: none;
  }

  /* Optional: page size and margins */
  @page {
    margin: 1in;
    size: A4;
  }
}
```

**Print layout component** (`components/reports/print-layout.tsx` or integrated into page):
- Receives `printMode: boolean` prop
- Renders the print header (masjid name + period) conditionally or always
- Wraps breakable sections (tables) with appropriate CSS classes
- Adds `data-print-hide` to elements that should not appear in print

**Report page modifications** (`app/(app)/reports/page.tsx`):
- Add `searchParams` to handle `?print=true`
- Conditionally render print header
- Add `<link rel="stylesheet" href="/print.css" media="print" />` or inline print CSS in a `<style>` block
- Pass masjid name from `AppSetting` (fetch server-side):
  ```typescript
  const masjidName = await prisma.appSetting.findUnique({
    where: { key: 'masjidName' },
  })?.value ?? 'AITJ Ledger';
  ```
- Pass `printMode` to layout/component

**Print button** (`components/reports/print-button.tsx`):
- Client Component
- Option 1: `<a href="?print=true" target="_blank">Print</a>` (opens print view in new window)
- Option 2: `<button onClick={() => window.open('?print=true')}>Print</button>`
- Option 3: `<button onClick={() => window.print()}>Print</button>` (triggers browser print dialog immediately; less obvious but simpler)
- Icon: printer icon (e.g. from `lucide-react`)

**Greyscale readability (NFR-4):**
- Income rows: prefix with "+" or add icon (e.g. ⊕ or 📈)
- Expense rows: prefix with "−" or add icon (e.g. ⊖ or 📉)
- No color-coding alone; use text/icon in addition to any color
- Verify by rendering in DevTools greyscale filter or converting print preview to greyscale

**Masjid name handling:**
- Fetch from `AppSetting` in server component or via a Server Action
- If not found, use fallback "AITJ Ledger"
- Pass to print layout as a prop
- If `AppSetting` is null (M7-04 not deployed), graceful fallback

**Responsive print layout:**
- Print layout is typically full-width; responsive breakpoints less relevant for print
- However, if user prints from mobile, ensure reasonable scaling
- Avoid viewport-dependent CSS; print CSS should be simpler

**Testing:**
- E2E test: navigate to `/reports?print=true`, use Playwright's print media emulation
- Integration test: fetch page with print param, parse HTML, verify print header has correct masjid name and period
- Manual test: print to PDF in Chrome and Safari, inspect output visually

**Performance (NFR-1):**
- Fetching masjid name adds one query; should complete well under 1.5s
- If `AppSetting` is not cached, consider adding an index or caching layer (simple for a single row)

**Security & edge cases:**
- Masjid name is user-editable; sanitize when storing in Settings (done in M7-04)
- Print endpoint requires authentication (same as reports page)
- No sensitive info in print output beyond what's already in report (transactions, amounts, periods)

**Browser compatibility (§13, NFR-9):**
- Chrome, Safari, Firefox, Edge (last 2 versions)
- Print-to-PDF is native; no extra library needed
- CSS `@media print` is universal support
- `display: table-header-group` for repeated headers is standard

## Definition of done

- [ ] All ACs met and all RED tests green (including manual print verification)
- [ ] Print stylesheet applied via `@media print` CSS
- [ ] Print button on reports page triggers print view
- [ ] Sidebar, navigation, and interactive elements hidden in print mode
- [ ] Print header displays masjid name (from `AppSetting` with fallback) and period
- [ ] Masjid name gracefully handles long text (wrapping, sizing)
- [ ] Income/expense rows marked by icon/text, not color alone (greyscale safe)
- [ ] Table headers repeat on page breaks
- [ ] Totals footer not orphaned
- [ ] Amounts formatted en-IN (₹1,50,000.00)
- [ ] Browser print-to-PDF works in Chrome and Safari (manual verification by QA)
- [ ] Very long reports (5-year range) render fully
- [ ] Responsive at 360px (print accessible from mobile)
- [ ] No secrets or amounts in logs
- [ ] Reviewed by review-agent → QA verified in Chrome and Safari
