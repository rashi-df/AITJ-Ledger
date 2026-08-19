# AITJ-M5-01 — IST period resolution engine for all presets

| Field | Value |
|---|---|
| Milestone | M5 — Dashboard |
| Depends on | AITJ-M0-06, AITJ-M3-02 |
| Blocks | AITJ-M4-04, M6 (Reports) |
| PRD refs | FR-D3, A2, A3, A4, A5, §8.2, §8.3 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

The dashboard and transaction-list filters both need to resolve period presets (Today, This Week, This Month, This Year, Custom Range) into date boundaries. This resolution is the foundation of every report, chart, and total in the system. All boundaries must be computed in Asia/Kolkata (IST) **regardless of the server's local timezone or the client device's timezone** (A2). This is where timezone bugs hide; tests must run under multiple TZ values to ensure the logic is timezone-agnostic. The function is pure and deterministic: it takes a preset name and a reference instant, returns `{from: Date, to: Date}` representing whole IST calendar days inclusive at both ends, and never calls the system clock (A5).

## Acceptance criteria

- [ ] AC1 — All six presets resolve correctly: Today, This Week, This Month, This Year, Custom Range, All-Time
- [ ] AC2 — Period boundaries are calendar dates (DATE type, no time component); both from and to are inclusive
- [ ] AC3 — "This Week" starts on Monday and ends on Sunday of the same IST week (A3)
- [ ] AC4 — "This Year" resolves to 1 January – 31 December of the calendar year in IST (A4), not financial year
- [ ] AC5 — Custom Range rejects from > to; accepts from == to (single day); rejects spans > 5 years (§7); allows ranges entirely in the future or before any data
- [ ] AC6 — Test suite passes identically when run under TZ=UTC, TZ=Asia/Kolkata, and TZ=America/New_York — timezone bugs are surfaced immediately
- [ ] AC7 — Function signature: `resolvePeriod(preset: string, refDate: Date): {from: Date, to: Date}` — pure, no side effects, no clock calls
- [ ] AC8 — All-Time preset returns the earliest possible boundary (1 Jan 2000) to latest possible (31 Dec 9999), or can be special-cased as needed by consumers

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Today at 00:00:00 IST | {from: today, to: today} |
| E2 | Today at 23:59:59 IST | {from: today, to: today} — does not shift to tomorrow |
| E3 | Today at 23:50 IST on a UTC date change | Boundary computed in IST, not affected by UTC rollover |
| E4 | This Week on Monday | {from: Monday, to: Sunday of the same week} |
| E5 | This Week on Sunday | {from: Monday of same week, to: Sunday} |
| E6 | This Week on a day, then ref advances by 1 second | Week boundary does not shift until the next Monday in IST |
| E7 | This Month on 1st of the month | {from: 1st, to: last day of the month} |
| E8 | This Month on the last day of the month | {from: 1st, to: last day} |
| E9 | February in a leap year (29 days) | Correctly resolves Feb 1–29 |
| E10 | February in a non-leap year (28 days) | Correctly resolves Feb 1–28 |
| E11 | 31-day month (Jan, Mar, May, Jul, Aug, Oct, Dec) | Correctly resolves to the 31st |
| E12 | 30-day month (Apr, Jun, Sep, Nov) | Correctly resolves to the 30th |
| E13 | This Year on 1 January | {from: Jan 1, to: Dec 31} |
| E14 | This Year on 31 December | {from: Jan 1, to: Dec 31} |
| E15 | This Year evaluated on leap day 29 Feb | Boundaries still span full calendar year |
| E16 | Custom Range: from == to | Valid single-day range {from: date, to: date} |
| E17 | Custom Range: from > to | Rejected; input validation error |
| E18 | Custom Range: span > 5 years | Rejected per §7 |
| E19 | Custom Range: from before 2000-01-01 | Rejected per §7 |
| E20 | Custom Range: from and to both > today+1 year | Valid future range |
| E21 | Custom Range: from and to both < 2000-01-01 | Rejected |
| E22 | All-Time preset | Returns boundary covering all possible dates for consumers |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | unit | `resolvePeriod > Today > returns correct single-day range` | `resolvePeriod('Today', new Date('2026-08-15T10:30:00Z')).from.toISOString().split('T')[0]` equals `'2026-08-15'` and `to` also equals `'2026-08-15'` |
| T2 | unit | `resolvePeriod > Today > at 00:00:00 IST does not shift` | Ref at 2026-08-15T18:30:00Z (00:00 IST), boundary is 2026-08-15 |
| T3 | unit | `resolvePeriod > Today > at 23:59:59 IST does not shift` | Ref at 2026-08-16T18:29:59Z (23:59:59 IST), boundary is 2026-08-15 |
| T4 | unit | `resolvePeriod > This Week > Monday is start of week` | Ref 2026-08-17 (a Monday in IST), `from` is 2026-08-17, `to` is 2026-08-23 |
| T5 | unit | `resolvePeriod > This Week > Sunday is end of week` | Ref 2026-08-23 (a Sunday in IST), `from` is 2026-08-17 (same week Monday), `to` is 2026-08-23 |
| T6 | unit | `resolvePeriod > This Week > Wednesday mid-week` | Ref 2026-08-19 (Wednesday), `from` is 2026-08-17 (Monday), `to` is 2026-08-23 (Sunday) |
| T7 | unit | `resolvePeriod > This Month > 1st of month` | Ref 2026-08-01, `from` is 2026-08-01, `to` is 2026-08-31 |
| T8 | unit | `resolvePeriod > This Month > last day of 31-day month` | Ref 2026-08-31, `from` is 2026-08-01, `to` is 2026-08-31 |
| T9 | unit | `resolvePeriod > This Month > February leap year 29 days` | Ref 2024-02-15, `from` is 2024-02-01, `to` is 2024-02-29 |
| T10 | unit | `resolvePeriod > This Month > February non-leap year 28 days` | Ref 2025-02-15, `from` is 2025-02-01, `to` is 2025-02-28 |
| T11 | unit | `resolvePeriod > This Month > 30-day month` | Ref 2026-04-15, `from` is 2026-04-01, `to` is 2026-04-30 |
| T12 | unit | `resolvePeriod > This Year > 1 January` | Ref 2026-01-01, `from` is 2026-01-01, `to` is 2026-12-31 |
| T13 | unit | `resolvePeriod > This Year > 31 December` | Ref 2026-12-31, `from` is 2026-01-01, `to` is 2026-12-31 |
| T14 | unit | `resolvePeriod > This Year > leap day 29 February` | Ref 2024-02-29, `from` is 2024-01-01, `to` is 2024-12-31 |
| T15 | unit | `resolvePeriod > Custom Range > single day from == to` | Ref 2026-08-15 with custom {from: 2026-08-15, to: 2026-08-15}, returns {from: 2026-08-15, to: 2026-08-15} |
| T16 | unit | `resolvePeriod > Custom Range > from > to rejected` | Ref irrelevant, input {from: 2026-08-20, to: 2026-08-10} throws ValidationError |
| T17 | unit | `resolvePeriod > Custom Range > span exceeds 5 years rejected` | Input {from: 2026-01-01, to: 2031-12-31} (6 years) throws ValidationError |
| T18 | unit | `resolvePeriod > Custom Range > 5-year span accepted` | Input {from: 2026-01-01, to: 2030-12-31} returns valid range |
| T19 | unit | `resolvePeriod > Custom Range > date before 2000-01-01 rejected` | Input {from: 1999-12-31, to: 2026-08-15} throws ValidationError |
| T20 | unit | `resolvePeriod > Custom Range > future range accepted` | Input {from: 2027-06-01, to: 2027-12-31} (entire range future) returns valid range |
| T21 | unit | `resolvePeriod > Timezone invariance > TZ=UTC produces IST boundaries` | Process run under TZ=UTC, same ref date 2026-08-15T10:30Z produces same IST date boundary as TZ=Asia/Kolkata |
| T22 | unit | `resolvePeriod > Timezone invariance > TZ=America/New_York produces IST boundaries` | Process run under TZ=America/New_York, ref 2026-08-15T10:30Z produces same IST date boundary as TZ=Asia/Kolkata |
| T23 | unit | `resolvePeriod > Timezone invariance > DST boundary does not affect IST` | Ref at Nov 1 (DST end in US), IST boundary unaffected |
| T24 | unit | `resolvePeriod > IST year-round no DST > documented` | Code comment explicitly states "Asia/Kolkata observes no DST; IST ±0:00 year-round. No DST branch needed." |
| T25 | unit | `resolvePeriod > All-Time preset > returns earliest and latest` | Preset 'AllTime' returns {from: earliest boundary, to: latest boundary} as specified |

**Red gate:** Every test above is written and failing for the right reason (missing function, assertion failure on a stub). Commit the failing tests before writing implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**File:** `lib/period/resolvePeriod.ts`

**Function signature:**
```typescript
export function resolvePeriod(
  preset: 'Today' | 'ThisWeek' | 'ThisMonth' | 'ThisYear' | 'AllTime',
  customRange?: { from: Date; to: Date },
  refDate: Date = new Date()
): { from: Date; to: Date }
```

**Approach:**
- Use `date-fns` with `@date-fns/tz` to all computations in Asia/Kolkata
- For each preset, compute the IST date boundaries as `Date` objects representing whole days (time component ignored or set to UTC midnight)
- For Custom Range, validate constraints via a Zod schema and return as-is
- Use `zonedTimeToUtc` and `utcToZonedTime` from `@date-fns/tz` to convert between UTC Date and IST
- Extract the calendar date only (year, month, day in IST) and reconstruct it as UTC midnight `Date`
- Never call `new Date()` or `Date.now()` inside the function; the reference instant is injected

**Validation schema** (`lib/validation/period.ts`):
```typescript
export const customRangeSchema = z.object({
  from: z.coerce.date().min(new Date('2000-01-01')),
  to: z.coerce.date(),
  // from <= to and span <= 5 years validated with refine()
});
```

**Tests** (`lib/period/__tests__/resolvePeriod.test.ts`):
- Use Vitest's `describe` + `it` structure
- No database required; this is pure unit logic
- For TZ-invariance tests, may spawn subprocesses with TZ override (e.g., `env TZ=UTC node -e "..."`) or use a test utility that sets process.env.TZ before calling
- Table-driven test for boundaries: iterate over {preset, refDate, expectedFrom, expectedTo} tuples

**No repository or database interaction;** this is pure logic.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Function is pure: no side effects, no clock calls, no database access
- [ ] Every boundary is a whole IST calendar day; time component is never part of the comparison
- [ ] Timezone-invariance tests pass under TZ=UTC, TZ=Asia/Kolkata, TZ=America/New_York
- [ ] Custom Range validation enforces all three constraints: from <= to, span <= 5 years, from >= 2000-01-01
- [ ] Code explicitly documents why no DST handling is needed (A2, IST year-round)
- [ ] All edge cases from the Edge cases table are covered by a test
- [ ] No N+1 queries (N/A — no database access)
- [ ] No unused variables, imports, or dead code
