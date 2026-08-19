# AITJ-M7-05 — Audit log viewer with user and date filters

| Field | Value |
|---|---|
| Milestone | M7 — Settings & admin |
| Depends on | AITJ-M3-03, AITJ-M7-01 |
| Blocks | none |
| PRD refs | FR-S5, §6 AuditLog model, §8.3 aggregation, NFR-3, NFR-4, NFR-8, §4 A2, §8.2 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

FR-S5 requires a UI to view the audit log, filterable by user and date. The audit log records every create, update, delete, and restore action (FR-T12). This ticket implements the Audit log section within Settings (M7-01), with a query that joins AuditLog to the User table efficiently (no N+1), server-side pagination, and filters for actor and date range (in IST, per A2). The audit log is the most security-sensitive surface: AuditLog.before and AuditLog.after JSON snapshots must never expose `passwordHash`, invite `tokenHash`, or any secret (NFR-8). Field-filtering happens at write time (M3-03), not at display time.

## Acceptance criteria

- [ ] AC1 — The Audit log section of Settings is navigable from the shell tab/section layout (M7-01)
- [ ] AC2 — A list displays audit entries with columns: Date (IST), Time, Action, Entity Type, Entity ID, Actor (User name), Details (a brief summary, e.g. "Income entry ₹5000 updated")
- [ ] AC3 — Filtering by Actor (User): a dropdown lists all users (active and inactive); selecting one shows only entries where actorId matches that user
- [ ] AC4 — Filtering by Date Range: date pickers for From and To (in IST); entries are filtered where createdAt is within the range; both boundaries are inclusive
- [ ] AC5 — Both filters are combined (AND logic): if both actor and date are selected, entries must match both criteria
- [ ] AC6 — Clearing filters shows all audit entries; a "Clear filters" button removes both selections
- [ ] AC7 — Server-side pagination: 25 rows per page; a page indicator shows "Showing X–Y of Z"; Previous/Next buttons are present
- [ ] AC8 — Sort by date (most recent first, descending) is the default; no other sort columns are exposed
- [ ] AC9 — Empty state: if audit log is empty (no entries), the page displays "No audit log entries yet."
- [ ] AC10 — Empty result: if filters yield no results, the page displays "No matching entries. Try changing your filters." with a "Clear filters" action
- [ ] AC11 — An actor who has been deactivated is shown with their name (not a user ID) in the list and in the Actor filter dropdown
- [ ] AC12 — Before and After JSON fields in the data are not displayed to the user in the UI (they are logged, but not shown). Do not display raw JSON in the audit log table/cards.
- [ ] AC13 — At 360px viewport, the audit table collapses into cards with all visible columns; buttons are ≥44px tap targets; text is readable (NFR-3)
- [ ] AC14 — All controls are labelled, keyboard-navigable, with 4.5:1 contrast (NFR-4)
- [ ] AC15 — Query count assertion in integration test: fetching a page of audit entries performs exactly one database query (a single LEFT JOIN or similar), not N+1 per row

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Filter by a user who has been deactivated | The user still appears in the Actor dropdown (they may have created entries). Selecting them shows their audit entries; their name is displayed as "[Name] (Inactive)" or similar. |
| E2 | Date range with From > To | Server-side validation rejects with "Start date must be before end date". Form shows the error; no query is executed. |
| E3 | Date range with both dates the same (e.g. From=2026-08-19, To=2026-08-19) | Entries created on 2026-08-19 (anywhere in the IST day) are returned; range is inclusive on both ends. |
| E4 | Date range spanning DST (not applicable in IST, but confirm) | IST has no DST; the range is computed in IST with no timezone conversion logic. |
| E5 | Audit log with 10,000 entries | Page 1 shows 25 rows; pagination works; the total count is displayed; no timeout or OOM. |
| E6 | Audit entry for a transaction whose entity (transaction) has been hard-deleted | Rare (would require a foreign-key constraint violation or a data cleanup process not in v1). The audit entry remains (it references `entityId`, not a foreign key to the transaction). Display shows the entity type and ID even if the entity no longer exists. Do not error if entity lookup fails. |
| E7 | Audit entry with action RESTORE (from M7-03) | The Action column shows "Restore"; entry is filtered and displayed like any other action |
| E8 | Actor is null or missing (should not happen, but audit robustness) | Join is LEFT JOIN so audit entries are returned even if the user is missing; display shows "(Unknown user)" or user ID if name is unavailable. Do not error. |
| E9 | Very large before/after JSON snapshot (e.g. a transaction with a long description) | The JSON fields are stored but not displayed in the UI; no UI layout breakage. |
| E10 | Filter by actor, navigate to page 2, then change actor filter | Page resets to 1 with the new filter applied; state is preserved in URL query string (if implemented). |
| E11 | User opens audit log, then a very high-volume action occurs (e.g. bulk import, if added later) | No special handling needed in v1; the log grows naturally. Pagination ensures the page does not load all rows. |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `settings > audit log > loads and displays entries` | /settings?tab=audit-log renders a table/card list with columns for Date, Time, Action, Entity Type, Actor, Details; at least one entry is visible (assuming audit log is not empty) |
| T2 | e2e | `settings > audit log > unauthenticated access redirects to login` | Unauthenticated GET /settings redirects to /login |
| T3 | e2e | `settings > audit log > shows CREATE action for income transaction` | Create an income transaction; navigate to audit log; verify an entry with Action="Create" / Action="Income entry created" or similar, entityType="Transaction", showing the creating user's name |
| T4 | e2e | `settings > audit log > shows UPDATE action for transaction edit` | Edit a transaction amount; navigate to audit log; verify an entry with Action="Update" showing the updating user and the entity type |
| T5 | e2e | `settings > audit log > shows DELETE action for soft-deleted transaction` | Delete a transaction; navigate to audit log; verify an entry with Action="Delete" showing the deleting user |
| T6 | e2e | `settings > audit log > shows RESTORE action for restored transaction` | Delete, then restore a transaction; navigate to audit log; verify an entry with Action="Restore" (from M7-03) |
| T7 | e2e | `settings > audit log > filter by actor and see only their entries` | User A creates a transaction, User B edits it. Select User A in the Actor filter; only User A's CREATE entry is shown. Select User B; only User B's UPDATE entry is shown. |
| T8 | e2e | `settings > audit log > filter by date range inclusive` | Create entry on 2026-08-18, another on 2026-08-19, another on 2026-08-20. Filter From=2026-08-19, To=2026-08-19; only the 2026-08-19 entry is shown. |
| T9 | e2e | `settings > audit log > filter by date range and actor combined` | Create entries: User A on 2026-08-18, User B on 2026-08-19, User A on 2026-08-19. Filter Actor=User A AND From=2026-08-19, To=2026-08-19; only User A's 2026-08-19 entry is shown. |
| T10 | e2e | `settings > audit log > clear filters shows all entries` | Apply filters, then click "Clear filters"; all entries reappear (or display changes to show unfiltered count). |
| T11 | e2e | `settings > audit log > empty state when no audit entries` | Perform a reset (or use a fresh database); audit log page shows "No audit log entries yet." |
| T12 | e2e | `settings > audit log > no results state when filters match nothing` | Filter Actor=[some user], Date=[date with no entries from that user]; page shows "No matching entries. Try changing your filters." with a "Clear filters" action. |
| T13 | e2e | `settings > audit log > pagination shows 25 rows per page` | Create 30 audit entries; page 1 shows 25 rows; page indicator shows "Showing 1–25 of 30"; Next button is enabled; page 2 shows 5 rows. |
| T14 | e2e | `settings > audit log > deactivated actor shown in list and filter` | Deactivate a user (User A), then view their audit entries. The list shows User A's entries with "(Inactive)" or similar; the Actor filter dropdown includes User A. |
| T15 | e2e | `settings > audit log > does not display raw JSON before/after snapshots` | Inspect the audit log table/cards; no raw JSON is visible; "before" and "after" fields are not rendered. |
| T16 | integration | `auditLog > single query with join fetches actor name` | Fetch one page (25 rows) of audit entries with filters applied; assert the database query count is exactly 1 (a JOIN to User, not N+1 queries for user lookups). Use query spy or transaction log. |
| T17 | integration | `auditLog > filter by actor requires valid user ID` | Call the audit-fetch action with an invalid actor ID; server validation rejects or silently finds no results. |
| T18 | integration | `auditLog > filter by date range validates From <= To` | Call the audit-fetch action with From > To; server rejects with validation error; no query is executed. |
| T19 | integration | `auditLog > date range boundaries in IST` | Set timezone to IST (A2). Create an entry at 23:50 IST on 2026-08-19. Filter From=2026-08-19, To=2026-08-19; entry is included. Filter To=2026-08-18; entry is excluded. |
| T20 | integration | `auditLog > session asserted` | Call the audit-fetch action without a session; the action rejects with "Unauthorized"; no data is returned. |
| T21 | e2e | `settings > audit log > at 360px table collapses to cards with ≥44px buttons` | Render at 360px; audit log collapses into cards; measure all buttons; verify ≥44px; no horizontal scroll. |
| T22 | e2e | `settings > audit log > keyboard navigation through pagination` | Tab through page navigation, filter controls, and entries; all are reachable; Enter triggers pagination; focus ring is visible. |

**Red gate:** All 22 tests are written, committed with failing assertions, and run to confirm they fail for the right reason.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Files to modify/create:**

1. **Repository:** `lib/repositories/audit-log.ts` (new file or add to existing)
   - Method `fetchAuditLog(filters?: { actorId?: string; dateFrom?: Date; dateTo?: Date }, page: number = 1, pageSize: number = 25)` that:
     - Returns a single-query result with AuditLog rows JOINed to User (actor).
     - Filters by actorId (exact match) if provided.
     - Filters by createdAt in the range [dateFrom, dateTo] inclusive, both in IST.
     - Returns pagination info (total count, current page, page size).
     - Uses the @@index([createdAt(sort: Desc)]) and @@index([entityType, entityId]) for efficient filtering.
     - Does NOT use the actor index for filtering (per user instructions: no index needed for actor due to A8 data volume, or add one if needed — decide and state).
   - Uses `include: { actor: { select: { id, name, isActive } } }` to fetch the actor in one query.

2. **Action:** `actions/audit-log.ts` or add to `actions/settings.ts`
   - `fetchAuditLog(filters: { actorId?: string; dateFrom?: Date; dateTo?: Date }, page: number)` Server Action that:
     - Asserts session via `authedAction`.
     - Validates filters: dateFrom <= dateTo (if both provided).
     - Calls `auditLog.fetchAuditLog(filters, page)`.
     - Returns the paginated results and metadata.

3. **Validation:** Add to `lib/validation/audit-log.ts` (new file)
   - Zod schema: actorId (optional cuid), dateFrom/dateTo (optional dates, both in IST, validated as from <= to).

4. **UI Component:** `components/settings/AuditLogSection.tsx`
   - Server Component fetches the first page of audit entries and the list of all users for the Actor filter.
   - Client component for pagination and filters:
     - Actor filter: select dropdown (or search) with all users.
     - Date range: two date pickers (From and To, in IST calendar picker).
     - "Clear filters" button.
     - Pagination: Previous/Next buttons, page indicator.
   - Renders a table/card list with columns: Date (IST), Time, Action, Entity Type, Actor, Details.
   - Empty states for no entries and no results.

5. **Routing:** Add the tab/section to Settings navigation (M7-01).

**Approach:**
- The audit log uses server-side pagination (25 rows/page) to avoid loading all rows into memory.
- Filters are validated server-side; invalid actor IDs or date ranges are rejected before executing the query.
- The actor lookup is done via a single LEFT JOIN in the query, not separate queries per row.
- Date filtering is in IST; the server computes date boundaries in IST using the `date-fns/tz` library (§8.1).
- Before/After JSON snapshots are fetched from the database but not displayed in the UI (they are audit records for backend inspection if needed, not user-facing).
- The total count is computed in the same query (e.g. using `findMany(...) + count(...)` or aggregation).

**Important:**
- Do not expose `before` and `after` JSON fields in the UI; they are logged for compliance/debugging, not display.
- Verify query count in an integration test: one query per page load, not N+1.
- Date range filtering must use IST timezone boundaries, not the server's default or the client's timezone.
- Deactivated actors still appear in filter options and in the list (FR-A9 — historical attribution is preserved).

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present (date range, actor ID validation)
- [ ] Session asserted via `authedAction` (§8.2)
- [ ] Single query with JOIN to User; query count asserted in integration test
- [ ] Before/After JSON fields are not displayed in the UI (audit records only)
- [ ] Date boundaries computed in IST (A2), not server timezone
- [ ] No N+1 queries — verified by query count test
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts, passwords, or tokens in logs (NFR-8); JSON snapshots are stored but never logged as strings
- [ ] Responsive at 360px, tap targets ≥44px (NFR-3); table becomes cards
- [ ] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off

## Open question

- **Actor index:** The audit table has @@index([entityType, entityId]) and @@index([createdAt(sort: Desc)]). Filtering by actorId has no index. Given A8's small data volume (a few thousand transactions/year, so tens of thousands of audit entries max), a sequential scan on actorId is acceptable. If audit volume grows, add @@index([actorId]) to the Audit model. State your decision in the implementation notes.
