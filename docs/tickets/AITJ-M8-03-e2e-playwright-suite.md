# AITJ-M8-03 — End-to-end Playwright suite for the key user flows

| Field | Value |
|---|---|
| Milestone | M8 — Hardening |
| Depends on | AITJ-M1-01, AITJ-M3-01, AITJ-M4-01, AITJ-M5-01, AITJ-M6-01, AITJ-M7-01, AITJ-M8-01, AITJ-M8-02 |
| Blocks | none |
| PRD refs | §11 key flows, §13 E2E row, NFR-9, FR-A6, FR-A7, FR-T9, FR-T11, FR-R1 |
| Est. | 2 days |
| Phase | 🔴 RED |

## Context

End-to-end tests verify the full user experience without mocking. The RED phase writes Playwright tests for §11 key user flows and §13 E2E acceptance criteria: login → add income → add expense → verify dashboard balance; filter and search the list; edit a transaction; delete with confirmation and restore; generate a report; accept an invite. These tests run at both desktop (1280px) and mobile (360px) viewports, using a real database per test, ensuring the app works from the user's perspective.

## Acceptance criteria

- [ ] AC1 — Playwright suite covers all 8 key flows from §11 and §13 E2E row at both desktop and mobile viewports
- [ ] AC2 — Login flow: user enters valid email and password, is authenticated, and redirected to dashboard; invalid credentials show generic error
- [ ] AC3 — Add income flow: user navigates to Income, enters amount, selects category, enters optional description, saves; form clears (date retained), success toast appears with Undo, dashboard totals update
- [ ] AC4 — Add expense flow: same as AC3 for expenses
- [ ] AC5 — Verify dashboard balance: after adding income and expense, dashboard headline cards show correct totals and balance; all-time balance matches sum of all transactions
- [ ] AC6 — Search and filter: user searches for a transaction by description, filters by type (Income/Expense), filters by category (multi-select), filters by date range; filtered totals update; clear filters works
- [ ] AC7 — Edit transaction: user navigates to Transactions, finds a row, clicks Edit, changes amount or category, saves; list reflects change immediately; audit log records the edit
- [ ] AC8 — Delete with confirmation and restore: user clicks Delete, sees confirmation modal with amount/category/date, confirms deletion; row disappears from all lists and totals; user navigates to Settings → Deleted transactions, finds the row, clicks Restore; row reappears with original values; dashboard totals change and then change back by the same amount
- [ ] AC9 — Generate report: user navigates to Reports, selects a period, sees totals and category breakdowns, can export as CSV and print to PDF
- [ ] AC10 — Accept invite: one user (Alice) generates an invite link, sends it to another user (Bob) via a test email or manual link copy; Bob opens the invite link in a new browser session, sets name and password, completes signup; Bob can then log in with his email and password and see the same transactions as Alice
- [ ] AC11 — Mobile viewport tests (360px) cover the same flows with mobile-specific navigation (tab bar, card layout); tap targets are reachable; modals scroll if needed
- [ ] AC12 — Every test uses a fresh database snapshot or seeded state; test isolation ensures no cross-test pollution

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Keyboard-only flow at 360px (add income without mouse) | User uses Tab, Arrow keys, Enter to navigate date picker, category select, amount input, Save button; form works entirely from keyboard |
| E2 | Delete-then-restore flow spanning sessions | User1 adds ₹1000 income, User2 deletes it; dashboard total changes; User1 sees transaction in Deleted, restores it; total changes back. Amounts must match exactly (decimal precision). |
| E3 | Invite acceptance across sessions | Invite link is valid in a completely separate browser session/incognito window; token is consumed on accept; second acceptance attempt redirects to login or shows error |
| E4 | Add then immediately undo | User adds transaction, clicks Undo in the toast within 5 seconds; transaction disappears from list and totals; dashboard reflects the undo |
| E5 | Filter with no results | User filters transactions; list shows empty state with "No results" and a "Clear filters" link; clicking it resets all filters |
| E6 | Edit transaction switching type (Income → Expense) | User edits income transaction, changes type to Expense; category is cleared; user must select a new expense category before save; error if no category selected |
| E7 | Category multi-select filter with many categories | User selects 5+ categories; filtered totals update correctly; each category's transactions are shown or hidden correctly |
| E8 | Report with date range spanning multiple years | User selects custom date range (e.g. 2024-01-01 to 2026-08-31); report shows opening balance from before start date, period totals, and closing balance; CSV export includes all rows |
| E9 | Delete modal with very long description | Delete confirmation modal displays amount, category, and a truncated description without overflow; user can still confirm or cancel |
| E10 | Print report with many categories | Print view renders all category tables full-width; page breaks are graceful; income and expense breakdown remain distinct in print (not colour-only) |
| E11 | Concurrent edit by two users | User1 and User2 both open the same transaction for editing; User1 saves first; User2's save succeeds but uses stale data (last-write-wins, which is acceptable for v1; verify in audit that both edits are recorded) |
| E12 | 360px landscape: add income with date picker | Date picker popover must not overflow viewport; calendar navigation (month/year) remains usable at 800×360 |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `e2e > authentication login valid credentials` | User logs in with correct email/password; redirected to dashboard; session cookie is set; logout succeeds |
| T2 | e2e | `e2e > authentication login invalid credentials` | User enters wrong password; error message reads "Invalid email or password" (generic, does not reveal email existence); login page remains |
| T3 | e2e | `e2e > add income flow desktop` | User navigates to /income; enters amount 5000, selects category "Donation", saves; form clears (date retained), success toast appears with Undo; dashboard totals include the new transaction |
| T4 | e2e | `e2e > add expense flow desktop` | User navigates to /expenses; enters amount 500, selects category "Electricity", saves; dashboard expenses total increases by 500 |
| T5 | e2e | `e2e > dashboard balance calculation` | After adding income 5000 and expense 500, dashboard shows Income: 5000, Expenses: 500, Balance: 4500; all-time balance matches |
| T6 | e2e | `e2e > search transactions by description` | User adds transaction with description "Ramadan program"; navigates to /transactions; enters search "Ramadan"; list filters to that transaction only; clear search shows all |
| T7 | e2e | `e2e > filter by type income expense` | User applies Type filter "Income"; list shows income only; applies "Expense"; shows expenses only; applies "All" shows both |
| T8 | e2e | `e2e > filter by category multi-select` | User selects "Donation" and "Sadaqah"; list shows transactions from both categories; deselecting a category updates the list |
| T9 | e2e | `e2e > filter by date range` | User selects date range "This Month"; list shows transactions from current month only; filtered totals header shows period sum (not all-time) |
| T10 | e2e | `e2e > edit transaction` | User adds transaction with amount 500; edits it to 750; list reflects new amount immediately; audit log shows edit with before/after values |
| T11 | e2e | `e2e > edit transaction switching type` | User edits expense transaction; changes Type to Income; category field is cleared; must select new income category or error shown; save succeeds after selection |
| T12 | e2e | `e2e > delete with confirmation modal` | User clicks Delete on a transaction; confirmation modal appears with amount/category/date; user confirms; row disappears from list, dashboard totals update |
| T13 | e2e | `e2e > restore deleted transaction` | User deletes a transaction (₹500 expense); navigates to Settings → Deleted transactions; finds it; clicks Restore; row reappears in /transactions list; dashboard expenses total decreases by 500 (balance increases back) |
| T14 | e2e | `e2e > undo toast` | User adds transaction; immediately clicks Undo link in toast (within 5 seconds); transaction disappears from list and dashboard |
| T15 | e2e | `e2e > generate report` | User navigates to /reports; selects "This Month"; report displays totals, opening/closing balance, and category tables; CSV export works; print preview shows formatted report |
| T16 | e2e | `e2e > accept invite new user signup` | Alice logs in; navigates to Settings → Users; invites bob@example.com; invite link is generated; in a new session, Bob opens the link; sets name "Bob" and password; completes signup; Bob logs in with bob@example.com; can see Alice's transactions |
| T17 | e2e | `e2e > add income mobile 360px` | Test AC3 at 360px viewport; form inputs are full-width and tappable; tab bar navigation works; success toast is visible |
| T18 | e2e | `e2e > delete restore flow assertions` | Add income ₹1000; verify dashboard balance increases by 1000; delete it; verify dashboard balance decreases by 1000; restore it; verify dashboard balance increases by 1000 (exactly the same amount); decimal precision is exact |
| T19 | e2e | `e2e > filtered totals header reflects period not page` | Add 30 transactions; filter to 5 results; header shows totals for filtered 5, not all 30; paginate to page 2; totals remain the same (showing filtered sum) |
| T20 | e2e | `e2e > keyboard navigation income entry mobile` | At 360px, user adds income using Tab, Arrow keys, Enter only; date picker navigation, category select, save all work; no mouse required |

**Red gate:** Every test fails because the app is not yet built or user flows are incomplete. Tests are syntactically correct and fail on assertion (wrong URL after login, totals do not update, etc.).

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out
- [ ] Tests run in parallel or sequentially with proper database isolation

## Implementation notes

- **Test infrastructure:** Use `@playwright/test` with a `fixtures` file (`e2e/fixtures.ts`) that seeds a fresh database per test using a Docker container or disposable compose service. Each test context gets a unique user account to avoid cross-test pollution.
- **Seeding:** Create `e2e/seed.ts` with a helper function `seedDatabase(email, password, categories)` that returns a logged-in session context. Use this in each test to set up initial data.
- **Mobile and desktop:** Use Playwright's `devices` array or viewport configuration. Run tests twice: once at `{ width: 1280, height: 800 }` (desktop) and once at `{ width: 360, height: 667 }` (mobile).
- **Multi-session tests (invite):** Use `page.context()` to create a second, independent browser context for Bob's session. Ensure cookies and session data do not leak between contexts.
- **Exact decimal assertions:** When checking amounts, assert strings: `expect(balanceText).toBe('4500.00')`, never float equality. Use the Prisma repository to fetch expected totals from the database and compare.
- **Audit trail verification:** For edit tests, query the database `auditLog` table directly to verify the edit is recorded with before/after values and correct actor ID.
- **Empty states:** Include tests for empty database, no results after filtering, etc. Verify empty state messaging matches FR-L12.
- **Dates in IST:** Use `date-fns` with `tz` in test helpers to generate dates in IST. Verify that a transaction entered at 23:50 IST lands on the correct IST date (not UTC).
- **Print verification:** For print tests, use `page.pdf()` and verify a single page is generated without errors. Do not assert visual appearance of PDF (too fragile); assert that PDF generation succeeds and contains expected text (transaction totals).
- **Error handling:** Test that validation errors are shown and prevent submission (e.g. amount 0 or negative, category mismatch). Assert error message text.
- **Rate limiting (FR-A11):** Optional for E2E (integration test may cover this better), but if including, try 6 failed logins and assert that the 6th is rate-limited.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] E2E suite covers all 8 flows from §11 and acceptance criteria from §13
- [ ] Desktop (1280px) and mobile (360px) viewports tested for each flow
- [ ] Database isolation: each test runs against a fresh snapshot; no cross-test pollution
- [ ] Decimal precision verified with string assertions (₹X.XX)
- [ ] Audit log assertions verify mutations are recorded correctly
- [ ] Print PDF generation succeeds; at least one print test verifies content
- [ ] Invite acceptance tested across independent sessions
- [ ] Delete-then-restore flow assertions verify amounts match exactly
- [ ] Filtered totals header assertions distinguish period sum from page sum
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
