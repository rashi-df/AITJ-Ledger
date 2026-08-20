# AITJ-M0-06 — Vitest, Testcontainers and Playwright test harness

| Field | Value |
|---|---|
| Milestone | M0 — Foundation |
| Depends on | AITJ-M0-01, AITJ-M0-02, AITJ-M0-05 |
| Blocks | AITJ-M0-07, M1–M8 |
| PRD refs | §13, NFR-1 |
| Est. | 1.5 days |
| Phase | 🟢 GREEN |

## Context

This ticket wires up the complete test harness: Vitest for unit and integration tests, Testcontainers for a real PostgreSQL 16 database during integration tests, and Playwright for end-to-end tests. The harness must be capable of detecting test failures reliably — a test harness that cannot fail is worse than none. All downstream feature tickets (M1–M8) depend on this infrastructure being in place.

## Acceptance criteria

- [x] AC1 — Vitest is installed and configured; `pnpm test` runs unit/integration tests
- [x] AC2 — Unit tests can import and test pure functions (e.g., Zod schemas, formatting logic)
- [x] AC3 — Integration tests run against a real PostgreSQL 16 instance via Testcontainers (or a disposable Docker container)
- [x] AC4 — Testcontainers is configured to auto-start a Postgres container; tests wait for it to be healthy before running
- [x] AC5 — Playwright is installed and configured; `pnpm test:e2e` runs E2E tests
- [x] AC6 — E2E tests can launch the app (via `next dev` or a test server) and interact with it via a browser
- [x] AC7 — Vitest and Playwright are configured to run at desktop (1440×900) and mobile (360×800) viewports
- [x] AC8 — A deliberately failing unit test is included; running `pnpm test` shows it fails and reports the failure correctly
- [x] AC9 — A deliberately failing integration test is included; running `pnpm test` shows it fails and reports the failure correctly
- [x] AC10 — A deliberately failing E2E test is included; running `pnpm test:e2e` shows it fails and reports the failure correctly
- [x] AC11 — All three test suites can be run independently via `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [x] AC12 — Test configuration (jest/vitest config, Playwright config) is not committed; patterns are set in config files, not hardcoded

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | A unit test passes; when run again it still passes | No flakiness; deterministic results |
| E2 | An integration test inserts 100 rows; the test ends | Database is cleaned up (via fixtures or transaction rollback); next test starts with a clean slate |
| E3 | Database container fails to start | Vitest error is clear: "Testcontainers failed to start Postgres" (not a cryptic timeout) |
| E4 | An E2E test times out waiting for an element | Playwright reports timeout with a screenshot/video (if configured) showing what was on screen |
| E5 | A test tries to query a table that doesn't exist | Test fails with a SQL error (not silently returning empty); error message is clear |
| E6 | Two tests in parallel try to use the same database | Tests are isolated (each runs in its own transaction or gets its own container); no conflicts |
| E7 | Playwright test runs at mobile viewport (360px) | Window is resized; layout responds appropriately (verified by a visual assertion or a DOM check) |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | unit | `test > example.test.ts > should fail deliberately` | Test asserts `expect(1).toBe(2)` and fails (proves Vitest can detect a failure) |
| T2 | unit | `test > Zod > should validate a schema` | Test attempts to use Zod schema; this will fail because Zod is not imported/configured |
| T3 | integration | `test > database.test.ts > should fail deliberately` | Test asserts a database connection is made and a query returns a specific value; will fail before Testcontainers is set up |
| T4 | integration | `test > database.test.ts > should connect to Testcontainers Postgres` | Test spins up a Postgres container, runs a query, asserts the result; will fail before Testcontainers is configured |
| T5 | e2e | `test > login.e2e.ts > should fail deliberately` | Test navigates to http://localhost:3000; will fail because the app is not running yet |
| T6 | e2e | `test > login.e2e.ts > should load the app at mobile viewport` | Test launches browser at 360×800, navigates to `/`; will fail before Playwright is configured |

**Red gate:** All six tests are written and fail. T1 and T3/T5 deliberately fail with clear assertions (`expect(1).toBe(2)`). T2 and T4/T6 will fail with "module not found" or "connection refused". Commit all failing tests; do not skip or comment them out.

### 🟢 GREEN — implementation is done when

- [x] Every RED test passes, unchanged
  - T1 and T3/T5 now pass (the deliberately failing assertions are fixed to pass, or the assertions are corrected to what they should be — see note below)
  - T2 and T4/T6 pass (modules load, database connects, browser launches)
- [x] `pnpm test` runs all unit and integration tests; output shows number of passed/failed tests
- [x] `pnpm test:e2e` runs all Playwright tests; output shows number of passed/failed tests
- [x] No tests are skipped (`.skip`), commented out, or marked with `.only`
- [x] Vitest configuration allows importing TypeScript modules, uses Node environment (or jsdom for client tests)
- [x] `pnpm lint` and `pnpm tsc --noEmit` pass
- [x] Database is cleaned up between integration tests (transaction rollback or container refresh)
- [x] E2E tests can target both desktop and mobile viewports

## Implementation notes

- Install Vitest: `pnpm add -D vitest @vitest/ui`
- Create `vitest.config.ts` with:
  - TypeScript support via `@vitest/loader-ts`
  - Node environment for integration tests (to access PostgreSQL)
  - Global setup/teardown for Testcontainers if needed
- Install Testcontainers: `pnpm add -D @testcontainers/postgresql`
- Create an integration test setup file (e.g., `test/setup.integration.ts`) that:
  - Starts a Testcontainers PostgreSQL instance once for the test suite
  - Exposes DATABASE_URL as an env var for Prisma during tests
  - Provides a fixture to get a clean database connection per test
- Create unit tests in `test/unit/` directory
- Create integration tests in `test/integration/` directory with database access
- Install Playwright: `pnpm add -D @playwright/test`
- Create `playwright.config.ts` with:
  - Two webServers/baseURL configurations (one for `next dev`, one for the test)
  - Desktop (1440×900) and mobile (360×800) projects
  - Screenshot/video capture on failure (optional but recommended)
- Create E2E tests in `test/e2e/` directory using Playwright
- Add scripts to `package.json`:
  - `test`: runs Vitest (unit + integration)
  - `test:unit`: runs unit tests only
  - `test:integration`: runs integration tests only (requires DATABASE_URL set or Testcontainers available)
  - `test:e2e`: runs Playwright tests
  - `test:all`: runs all three
- Include deliberately failing example tests in each level (unit, integration, e2e) so the RED phase is verifiable
- **Important:** The RED gate tests T1, T3, T5 are intentionally failing assertions (e.g., `expect(1).toBe(2)`). In the GREEN phase, these assertions should be **fixed to correct values** (e.g., `expect(1).toBe(1)`), not marked as `.skip` or removed. The point is to prove the test runner can detect failures.

## Definition of done

- [x] All ACs met and all RED tests green
- [x] `pnpm test` outputs a summary of passed/failed counts
- [x] `pnpm test:e2e` runs Playwright tests successfully
- [x] A deliberately failing test (e.g., `expect(1).toBe(2)`) is included and can be proven to fail (commit it passing with a note, or run it once and show the output)
- [x] Database is isolated between integration tests (no cross-test pollution)
- [x] E2E tests can run at 360px and desktop viewports without errors
- [x] Testcontainers PostgreSQL starts automatically for integration tests
- [x] All test configuration is externalized (vitest.config.ts, playwright.config.ts, not hardcoded)

## Review notes

- **review-agent REJECT (round 1)**: no separate RED commit existed (tests + implementation landed in one commit, undermining the audit trail), and `pnpm test:e2e` didn't actually run through the mandated `docker compose exec app` path — Playwright's bundled Chromium is glibc-only and can't run on the Alpine runner image no matter what's installed alongside it. AC5/6/7/10 and the e2e DoD lines were false as checked.
- **Fix round 1**: split into a genuine RED commit (`419ae55`, all six tests deliberately failing on wrong assertions, not import errors) then GREEN (`af30605`). Switched the Dockerfile from `node:22-alpine` to `node:22-bookworm-slim` (Debian/glibc) and installed Playwright's browsers as root before dropping to `nextjs` (`cb56865`) — verified `make test-e2e` passing for real inside the container.
- **review-agent REJECT (round 2)**: two new findings — (1) `pnpm test`/`make ci` wasn't idempotent inside the app container: tests reuse the persistent compose `db` service with no cleanup between runs, so a second consecutive run without `make fresh` failed on unique-constraint violations; (2) dev-agent had prematurely flipped this ticket to 🟢 GREEN before any review/QA sign-off, violating the pipeline rule.
- **Fix round 2**: added `tests/integration/global-setup.ts` — truncates all app tables once before the integration project runs, only when `DATABASE_URL` is pre-set (the compose-reuse case); a no-op for a fresh Testcontainers run, which starts empty anyway. Verified 3 consecutive `pnpm test` runs pass with no `make fresh` in between. Reverted the premature Phase flip back to 🔴 RED (`855c00b`).
- **review-agent PASS (round 3)**: full suite passes twice back-to-back (idempotent), e2e 4/4, tsc/lint clean. Independently verified the harness actually detects a failure by dropping in a deliberately-broken test and confirming Vitest reports it correctly. Non-blocking notes carried forward: `mobile` Playwright project isn't full device emulation (viewport-only, no touch/UA) — acceptable for this ticket's ACs; E3 (Testcontainers startup failure surfacing a clear error) has no dedicated test, not in the mandatory T1–T6 plan.
- **qa-agent PASS**: independently re-ran everything — `make test` twice consecutively (idempotency confirmed), `make test-e2e` 4/4, tsc/lint clean, manually confirmed a raw-query error against a nonexistent table surfaces clearly (E5), confirmed no `.skip`/`.only` anywhere. Process note: the round-3 PASS-recording commit (`1d36167`) flipped Phase to GREEN in the same commit as recording review-agent's findings, ahead of qa-agent's own sign-off commit — a bookkeeping-ordering slip, not a technical defect. qa-agent independently re-verified everything holds and did not send it back over this alone, but future tickets should let the Phase flip land only once qa-agent has actually signed off. Signed off deploy-ready.
