# AITJ-M6-05 — CSV export of the report

| Field | Value |
|---|---|
| Milestone | M6 — Reports |
| Depends on | AITJ-M6-01, AITJ-M6-02, AITJ-M6-03 |
| Blocks | none |
| PRD refs | FR-R6, A1, §6.1, NFR-1 |
| Est. | 0.5 days |
| Phase | 🔴 RED |

## Context

The report can be exported as CSV (FR-R6), providing a portable summary for spreadsheet tools, backup, or hand-off to an accountant. The CSV must be safe (injection prevention), accurate (decimal exactness, not floats), and Excel-compatible (UTF-8 BOM, INR-formatted amounts). Descriptions and category names may contain commas, quotes, or newlines — these must be escaped correctly. Values beginning with `=`, `+`, `-`, or `@` are neutralised to prevent formula injection. The export file covers both the headline totals and the category breakdowns.

## Acceptance criteria

- [ ] AC1 — An export button on the Reports page triggers a CSV download
- [ ] AC2 — CSV filename is `report-{period}.csv` (e.g. `report-2024-01-to-2024-01-31.csv` for custom range, `report-2024-this-month.csv` for presets)
- [ ] AC3 — CSV content includes: period header, headline totals (income, expenses, net balance), opening balance, closing balance, income category breakdown table, expense category breakdown table
- [ ] AC4 — All amounts are exact decimal strings (e.g. `1234.56`), never floats or pre-formatted currency (Excel must be able to parse and sum them)
- [ ] AC5 — CSV is properly escaped: values with commas, quotes, or newlines are quoted; internal quotes are doubled (RFC 4180)
- [ ] AC6 — Injection prevention: values starting with `=`, `+`, `-`, or `@` are prefixed with a single quote (`'`) or wrapped in quotes
- [ ] AC7 — File is UTF-8 encoded; a UTF-8 BOM (byte order mark: `EF BB BF`) is prepended for Excel compatibility with non-ASCII category names and rupee formatting
- [ ] AC8 — Empty breakdown (period with zero income or zero expenses) exports headers only for that section, not a zero-byte file
- [ ] AC9 — Soft-deleted transactions are excluded from all exported totals and breakdowns
- [ ] AC10 — File is downloadable via HTTP response with `Content-Disposition: attachment; filename="..."` and `Content-Type: text/csv; charset=utf-8`

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Category name containing comma (e.g. "Maintenance, repairs") | Quoted in CSV: `"Maintenance, repairs"` |
| E2 | Description containing quote (e.g. "Said "hello"") | Escaped as `"Said ""hello"""` (quotes doubled inside quoted field) |
| E3 | Description containing newline | Quoted: `"Line 1\nLine 2"` (newline preserved, field quoted) |
| E4 | Description containing comma + quote + newline | All three: quoted, quotes doubled, newline preserved |
| E5 | Category or description starting with `=` | Field quoted or prefixed with `'=...` to prevent Excel formula injection |
| E6 | Category starting with `+` (e.g. "+Other") | Handled as injection risk; prefixed or quoted |
| E7 | Category starting with `-` (e.g. "−Salary") | Handled as injection risk |
| E8 | Category starting with `@` | Handled as injection risk |
| E9 | Very large amount near ₹99999999999.99 | Exported as exact decimal string `99999999999.99`, not scientific notation |
| E10 | Amount with many decimal places (e.g. ₹1234.5678 after rounding, or stored as ₹1234.57) | Exported as `1234.57` (exact Decimal string) |
| E11 | Empty report (zero transactions in period) | CSV has headers and totals row (all zeros), breakdown sections have headers but no data rows |
| E12 | Period with only income, no expenses | CSV includes expense breakdown section with headers but no data rows |
| E13 | Category with ₹0 amount (soft-deleted all its transactions after entry) | Not exported if it has zero amount in the period; omitted like any zero-activity category |
| E14 | Non-ASCII characters in category name (e.g. Urdu/Malayalam) | Encoded in UTF-8 with BOM; remains readable in Excel |
| E15 | File download on mobile browser | Response headers allow save-as; file opens or saves depending on browser/OS |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `csv export > export button present on reports page` | Reports page has button labeled "Export as CSV" or similar |
| T2 | e2e | `csv export > clicking export button triggers download` | Click button, browser's download behavior is triggered (check response headers) |
| T3 | e2e | `csv export > filename includes period` | Downloaded file named `report-{period}.csv` with correct period string |
| T4 | integration | `csv export > generates valid CSV with RFC 4180 escaping` | Request export endpoint, parse response as CSV, verify it is valid (no parsing errors) |
| T5 | integration | `csv export > amounts are exact decimal strings, not floats` | Parse CSV, read amount column, verify values like `1234.56` (not `1234.5600000001` or `1.234e3`) |
| T6 | integration | `csv export > includes headline totals` | CSV body contains rows for Total Income, Total Expenses, Net Balance with correct values |
| T7 | integration | `csv export > includes opening and closing balances` | CSV contains rows for Opening Balance and Closing Balance |
| T8 | integration | `csv export > includes income breakdown with headers` | CSV has section "Income Breakdown" with headers: Category, Count, Amount, Percentage |
| T9 | integration | `csv export > includes expense breakdown with headers` | CSV has section "Expense Breakdown" with same headers |
| T10 | integration | `csv export > category names with commas are quoted` | Given category "Maintenance, repairs", CSV row for that category has field `"Maintenance, repairs"` |
| T11 | integration | `csv export > descriptions with quotes are escaped` | Given description "Said "hello"", CSV field is `"Said ""hello"""` |
| T12 | integration | `csv export > descriptions with newlines are quoted` | Given description spanning lines, CSV field is quoted and newline is preserved |
| T13 | integration | `csv export > injection prevention: "=" prefix` | Given amount or category starting with `=`, CSV field is quoted or prefixed to prevent formula evaluation (e.g. `"=1234"` or `'=1234`) |
| T14 | integration | `csv export > injection prevention: "+" and "-" prefixes` | Given values starting with `+` or `-`, CSV field is quoted or prefixed |
| T15 | integration | `csv export > injection prevention: "@" prefix` | Given category or description starting with `@`, CSV field is quoted or prefixed |
| T16 | integration | `csv export > UTF-8 BOM present` | First three bytes of CSV file are `EF BB BF` (UTF-8 BOM) |
| T17 | integration | `csv export > soft-deleted transactions excluded` | Given period with 1 non-deleted and 1 soft-deleted transaction, CSV totals reflect only the non-deleted one |
| T18 | integration | `csv export > empty breakdown omitted or headers only` | Given period with zero income, income section has headers but no data rows (not a blank file) |
| T19 | integration | `csv export > large amounts formatted without scientific notation` | Amount near ₹99999999999.99 exported as `99999999999.99`, not `9.99999999999e10` |
| T20 | integration | `csv export > non-ASCII category names preserved` | Given category name in non-Latin script (e.g. Urdu), CSV file contains the name readable in UTF-8 |

**Red gate:** all 20 tests written and failing. Commit the failing tests before implementing.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Export button component** (`components/reports/export-csv-button.tsx`):
- Client Component; button element with onClick handler
- Calls a Server Action `exportReportAsCSV(period: Period)` or a route handler (see below)
- Button text: "Export as CSV" or "⬇ Download CSV"

**Route handler** (`app/api/reports/export-csv/route.ts` or similar):
- `POST` endpoint (or GET with query params for period)
- Asserts session (authenticated only)
- Validates period via Zod schema (from-date, to-date, preset)
- Calls `reportRepository.getReportAggregates(period)` → M6-01
- Calls `reportRepository.getOpeningBalance(period.from)` and `getClosingBalance(period)` → M6-02
- Builds CSV string with headers and rows
- Returns response with headers:
  ```
  Content-Type: text/csv; charset=utf-8
  Content-Disposition: attachment; filename="report-{period}.csv"
  ```

**CSV structure:**
```
Period,2024-01-01 to 2024-01-31
Total Income,1500.00
Total Expenses,500.00
Net Balance,1000.00
Opening Balance,200.00
Closing Balance,1200.00

Income Breakdown
Category,Transaction Count,Total Amount,% of Total
Donation,2,1000.00,66.7
Jumu'ah Collection,1,500.00,33.3

Expense Breakdown
Category,Transaction Count,Total Amount,% of Total
Electricity,1,500.00,100.0
```

**CSV generation:**
- Use a library like `csv-stringify` (Node.js) or hand-roll with careful escaping
- Or use native `Intl` formatting if needed, but amounts must remain as decimal strings
- Escape logic:
  - Wrap field in quotes if it contains comma, quote, or newline
  - Double internal quotes: `"` → `""`
  - If first char is `=`, `+`, `-`, or `@`, prefix with `'` (single quote) OR wrap in quotes
- Add UTF-8 BOM at the start: `﻿`

**Filename generation:**
```typescript
const periodLabel = 
  preset === 'today' ? `today-${dateString}` :
  preset === 'thisWeek' ? `week-${startDate}-${endDate}` :
  preset === 'thisMonth' ? `month-${year}-${month}` :
  preset === 'thisYear' ? `year-${year}` :
  preset === 'custom' ? `${from}-to-${to}` :
  'report';
const filename = `report-${periodLabel}.csv`;
```

**Error handling:**
- If period validation fails, return 400 Bad Request with error message
- If repository fails, return 500 Internal Server Error (log the error, do not expose to client)

**Testing:**
- Integration test: mock `reportRepository` with known data, call route handler, parse response, verify CSV structure
- E2E test: navigate to reports page, click export button, verify file downloads, parse CSV in test, assert headers and data
- Unit test: CSV escaping logic (if extracted to a utility function)

**Performance (NFR-1):**
- Export should complete in < 1.5s for 10k transactions (single query to get aggregates, response building is fast)
- Streamed response if dataset is very large (unlikely for a single-masjid ledger)

**Security:**
- Route is authenticated (session required)
- Input validation via Zod (period)
- No secrets in CSV
- Injection prevention (formula escaping)
- Amounts never logged

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Export button on reports page is functional
- [ ] Route handler or Server Action correctly exports CSV
- [ ] CSV is RFC 4180 compliant (quoted fields, escaped quotes)
- [ ] Amounts are exact decimal strings
- [ ] Injection prevention implemented for `=`, `+`, `-`, `@`
- [ ] UTF-8 BOM present
- [ ] File download headers correct (`Content-Disposition`, `Content-Type`)
- [ ] Soft-deleted transactions excluded
- [ ] Response is fast (< 1.5s for 10k transactions)
- [ ] Non-ASCII characters preserved
- [ ] No amounts or sensitive data in logs
- [ ] Reviewed by review-agent → QA tested on desktop and mobile browsers
