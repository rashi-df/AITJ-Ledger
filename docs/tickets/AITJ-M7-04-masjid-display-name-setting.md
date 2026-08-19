# AITJ-M7-04 — Masjid display name setting

| Field | Value |
|---|---|
| Milestone | M7 — Settings & admin |
| Depends on | AITJ-M0-03, AITJ-M6-06 |
| Blocks | AITJ-M6-06 |
| PRD refs | FR-S3, §4 A11, §10 page 8, §5.6 FR-R7, NFR-3, NFR-4, §7 validation |
| Est. | 0.5 days |
| Phase | 🔴 RED |

## Context

FR-S3 requires a UI in Settings to set and edit the masjid's display name. The name is stored in the `AppSetting` key/value table (key="masjidName") and defaults to "AITJ Ledger" per A11. The name is used in page headers, dashboard, and printed reports (FR-R7). It must be editable without a redeploy so the committee can apply the formal name once decided. M6-06 reads the masjid name from AppSetting for the print header, so this ticket depends on the setting being readable and blocks M6-06 being fully testable until the setting is editable and persisted.

## Acceptance criteria

- [ ] AC1 — The Masjid name section of Settings is navigable from the shell tab/section layout (M7-01)
- [ ] AC2 — A form displays the current masjid name in a text input; the name defaults to "AITJ Ledger" if no AppSetting row exists yet
- [ ] AC3 — The form includes a Save button; on submit, the `updateMasjidName` Server Action is called
- [ ] AC4 — On successful save, a toast confirms "Masjid name updated" and the new name is reflected in the page header and dashboard (if visible on the same page)
- [ ] AC5 — Empty or whitespace-only input is rejected with "Name is required"
- [ ] AC6 — Leading and trailing whitespace is trimmed before saving; internal whitespace is preserved
- [ ] AC7 — Very long input (e.g. 500+ chars) is rejected with "Name is too long (max 255)" or similar
- [ ] AC8 — HTML and script characters (e.g. `<script>`, `&`, `"`) are escaped when rendered in headers and reports (output-context escaping, not input sanitization)
- [ ] AC9 — The masjid name is reflected in the Dashboard header, report headers, and print view without a page reload (cache invalidation via `revalidatePath`)
- [ ] AC10 — Two users editing the masjid name concurrently: the last-write wins; no merge conflict. Both users see the updated name on their next refresh.
- [ ] AC11 — At 360px viewport, the form input and button are tap targets ≥44px; text is readable (NFR-3)
- [ ] AC12 — The form control is labelled, keyboard-navigable, with 4.5:1 contrast (NFR-4)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | AppSetting row with key="masjidName" does not exist yet | The input shows the default "AITJ Ledger"; on save, a new AppSetting row is inserted |
| E2 | Masjid name is "   " (whitespace only) | Server-side validation trims and rejects "Name is required" |
| E3 | Masjid name is "\tAITJ\n" (with tabs and newlines) | Trimmed to "AITJ"; internal tabs are replaced or preserved per the Zod schema (decide and document) |
| E4 | Masjid name contains HTML: "<strong>AITJ Ledger</strong>" | Input is accepted and stored as-is; output in page headers uses escaping so `<` and `>` appear as entities in HTML (not executable) |
| E5 | Masjid name contains quotes: "AITJ \"Main\" Masjid" | Input is accepted; output escaping ensures quotes do not break HTML attributes or CSV fields |
| E6 | Masjid name is very long (255 chars exactly) | Accepted and stored |
| E7 | Masjid name is very long (256+ chars) | Rejected with "Name is too long (max 255)" |
| E8 | Two concurrent saves with different names | Last-write wins. Both users see the final name on refresh; no merge or version conflict. |
| E9 | User changes masjid name, then navigates to Reports → print view | The print header shows the new name immediately (no cache stale issue) |
| E10 | Masjid name changes from "AITJ Ledger" to "My Masjid" to "Another Masjid" | Each change is atomic; no partial updates. Dashboard and reports reflect the latest name. |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `settings > masjid name > loads and displays form` | /settings?tab=masjid-name renders a form with a text input showing "AITJ Ledger" (default) and a Save button |
| T2 | e2e | `settings > masjid name > unauthenticated access redirects to login` | Unauthenticated GET /settings redirects to /login |
| T3 | e2e | `settings > masjid name > save new masjid name and see in dashboard header` | Clear the input, enter "My Masjid", save; toast confirms "Masjid name updated"; the header shows "My Masjid" (if visible on the settings page or after navigation to dashboard) |
| T4 | e2e | `settings > masjid name > empty input rejected with error` | Clear the input, click Save; form shows "Name is required"; page does not navigate away |
| T5 | e2e | `settings > masjid name > whitespace-only input rejected` | Enter "   ", click Save; form shows "Name is required" (after trimming) |
| T6 | e2e | `settings > masjid name > very long input (256 chars) rejected` | Enter 256 characters, click Save; form shows "Name is too long (max 255)" |
| T7 | e2e | `settings > masjid name > whitespace trimmed on save` | Enter " AITJ Ledger " (with spaces), save; the input shows "AITJ Ledger" (trimmed); stored value is trimmed |
| T8 | e2e | `settings > masjid name > HTML characters accepted and escaped in header` | Enter "<script>alert('xss')</script>", save; the header renders the text safely (no JavaScript execution); inspect HTML shows entities |
| T9 | e2e | `settings > masjid name > navigate to reports and see new name in print header` | Set masjid name to "Test Masjid", navigate to /reports, view print preview or inspect HTML; the print header contains "Test Masjid" |
| T10 | integration | `updateMasjidName > inserts new AppSetting row if none exists` | Call updateMasjidName action with name "My Masjid"; verify AppSetting row with key="masjidName", value="My Masjid" is created |
| T11 | integration | `updateMasjidName > updates existing AppSetting row` | Set masjid name to "Masjid A", then call updateMasjidName with "Masjid B"; verify the row is updated, not duplicated |
| T12 | integration | `updateMasjidName > trims whitespace server-side` | Call updateMasjidName with " Name "; verify stored value is "Name" (trimmed) |
| T13 | integration | `updateMasjidName > rejects empty after trim` | Call updateMasjidName with "   "; the action rejects; AppSetting row is unchanged |
| T14 | integration | `updateMasjidName > rejects names longer than 255 chars` | Call updateMasjidName with 256 characters; the action rejects; AppSetting row is unchanged |
| T15 | integration | `updateMasjidName > session asserted` | Call updateMasjidName action without a session; the action rejects with "Unauthorized"; AppSetting row unchanged |
| T16 | e2e | `settings > masjid name > at 360px form input and button are ≥44px` | Render at 360px; measure input and Save button; verify ≥44px; no horizontal scroll |
| T17 | e2e | `settings > masjid name > keyboard navigation and focus ring` | Tab to the input and Save button; focus ring is visible; Enter submits |
| T18 | integration | `dashboard > reads masjid name from AppSetting` | Fetch dashboard data; verify the returned masjid name matches the current AppSetting value (or "AITJ Ledger" if none) |

**Red gate:** All 18 tests are written, committed with failing assertions, and run to confirm they fail for the right reason.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**Files to modify/create:**

1. **Repository:** `lib/repositories/app-settings.ts` (new file or add to existing)
   - Method `getMasjidName()` — fetches AppSetting with key="masjidName", returns the value or "AITJ Ledger" if not found.
   - Method `updateMasjidName(name: string)` — upserts AppSetting with key="masjidName".

2. **Action:** `actions/settings.ts` or new file `actions/update-masjid-name.ts`
   - `updateMasjidName(name: string)` Server Action that:
     - Asserts session via `authedAction`.
     - Validates name: trimmed, 1–255 chars, no HTML/script logic (input is stored as-is, output escaping handles display).
     - Calls `appSettings.updateMasjidName(trimmedName)`.
     - Calls `revalidatePath` for /, /reports, and /settings to ensure all pages see the updated name.

3. **Validation:** Add to `lib/validation/app-settings.ts` (new file)
   - Zod schema: `masjidNameSchema = z.string().trim().min(1).max(255)`.

4. **UI Component:** `components/settings/MasjidNameSection.tsx`
   - Server Component fetches current masjid name via `appSettings.getMasjidName()`.
   - Client form component bound to `updateMasjidName` action.
   - Form includes input and Save button.

5. **Dashboard and Reports:** Consume masjid name from the repository in the header rendering.
   - Dashboard page (Server Component): calls `appSettings.getMasjidName()` for the header.
   - Report print view (Server Component): same.
   - Ensure output is HTML-escaped when rendered in the DOM.

6. **Routing:** Add the tab/section to Settings navigation (M7-01).

**Approach:**
- The masjid name is stored in AppSetting as a simple key/value pair; no history or versioning needed.
- Input is trimmed; output is escaped at the rendering layer (not sanitized on input).
- The dashboard, reports, and all headers fetch the name fresh from the repository, so changes are immediately visible on next navigation without special cache-busting.
- Concurrent writes are last-write-wins; the AppSetting upsert is atomic at the database level.

**Important:**
- Do not sanitize or strip HTML from input — store as-is and escape on output (context-appropriate escaping: HTML entities in HTML context, quotes in CSV, etc.).
- Trim only leading/trailing whitespace; preserve internal structure.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present (required, max 255 chars, trimmed)
- [ ] Session asserted via `authedAction` (§8.2)
- [ ] Input is stored untouched after trim; output is HTML-escaped in rendering
- [ ] Repository method `getMasjidName()` returns default "AITJ Ledger" if AppSetting does not exist
- [ ] `revalidatePath` covers /, /reports, /settings and any other header-bearing pages
- [ ] No N+1 queries — AppSetting is fetched once per request, or cached appropriately
- [ ] No unused variables, imports, or dead code
- [ ] Responsive at 360px, tap targets ≥44px (NFR-3)
- [ ] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
