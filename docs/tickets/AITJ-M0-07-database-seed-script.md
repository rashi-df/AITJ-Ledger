# AITJ-M0-07 — Database seed script for default categories and admin account

| Field | Value |
|---|---|
| Milestone | M0 — Foundation |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M0-06 |
| Blocks | none |
| PRD refs | NFR-10, FR-C2, FR-C3, FR-A5, §12.2 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

This ticket implements the seed script (`prisma/seed.ts`) that runs at application startup to initialize the database with default categories and an admin account. The app must boot against a completely empty database and self-seed these critical records (NFR-10). The seed must be idempotent — running it multiple times must not duplicate categories or reset the admin password. The admin account is created from environment variables `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, and on first login, the admin is forced to change their password (FR-A5). The seeded categories must match the exact lists in FR-C2 (income) and FR-C3 (expense).

## Acceptance criteria

- [x] AC1 — `prisma/seed.ts` exists and is executable via `node prisma/seed.ts` or `tsx prisma/seed.ts`
- [x] AC2 — Seed creates exactly 6 income categories: Donation, Zakat, Sadaqah, Jumu'ah Collection, Membership/Contribution, Other (per FR-C2, verbatim names)
- [x] AC3 — Seed creates exactly 10 expense categories: Electricity, Water, Maintenance, Cleaning, Salary/Wages, Construction, Equipment, Events/Programs, Office Expenses, Other (per FR-C3, verbatim names)
- [x] AC4 — Seed creates an admin User with email from `SEED_ADMIN_EMAIL` env var, password hashed from `SEED_ADMIN_PASSWORD`, and `mustChangePassword: true`
- [x] AC5 — If `SEED_ADMIN_PASSWORD` is missing or shorter than 10 characters, the seed script fails loudly with a clear error message (not silently skipped)
- [x] AC6 — Seed is **idempotent**: running it twice against the same database creates no duplicate categories and does not reset the admin password
- [x] AC7 — If a user already exists (not the first boot), seed does NOT create another admin account
- [x] AC8 — If categories already exist, seed skips them (upsert-style)
- [x] AC9 — `package.json` includes a `seed` script (`tsx prisma/seed.ts` or equivalent)
- [x] AC10 — Docker container runs seed at startup before accepting traffic (verified by M0-05)
- [x] AC11 — The app starts and renders a login page even with an empty database, after seeding completes — adapted: `/login` doesn't exist until AITJ-M1-02, so this was verified instead as "the seeded admin is immediately DB-queryable by email" plus a full manual Docker verification (`docker/entrypoint.sh`: migrate → seed → `next start`, confirmed serving `/api/health` against a freshly-seeded, empty-to-start database)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Seed runs twice in a row | Second run succeeds; categories and admin are identical; no duplicates |
| E2 | Seed runs, then a new user is invited and added | Seed runs again; no new admin is created; existing categories are not re-inserted |
| E3 | `SEED_ADMIN_EMAIL` is "admin@aitj.local", `SEED_ADMIN_PASSWORD` is "WeakPwd" (7 chars) | Seed fails with error "SEED_ADMIN_PASSWORD must be at least 10 characters" before creating the user |
| E4 | `SEED_ADMIN_PASSWORD` is not set in environment | Seed fails with error "SEED_ADMIN_PASSWORD is required" |
| E5 | Database is empty; seed creates categories and admin | Attempting to log in as admin with the seeded password succeeds; login form prompts password change on first login |
| E6 | Category "Donation" already exists (perhaps manually created); seed runs | Seed succeeds; no duplicate "Donation"; category is not re-inserted |
| E7 | Seed script is run against a database with 50 existing transactions | Seed succeeds; no categories are deleted or modified; transactions are untouched |
| E8 | `SEED_ADMIN_PASSWORD` is exactly 10 characters | Seed succeeds; password is accepted and hashed correctly |
| E9 | `SEED_ADMIN_PASSWORD` contains special characters (e.g., `P@ssw0rd!`) | Seed succeeds; special characters are preserved in the hash |
| E10 | Multiple instances of the app start in parallel and both run seed | Both instances detect categories/admin already exist; no race condition or duplicate creation |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `seed.test.ts > should fail if SEED_ADMIN_PASSWORD is missing` | Run seed with `SEED_ADMIN_PASSWORD` unset in environment; script exits non-zero and logs error "SEED_ADMIN_PASSWORD is required" |
| T2 | integration | `seed.test.ts > should fail if SEED_ADMIN_PASSWORD is too short` | Run seed with `SEED_ADMIN_PASSWORD="ShortPwd"` (8 chars); script exits non-zero and logs error "must be at least 10 characters" |
| T3 | integration | `seed.test.ts > should create exactly 6 income categories` | Run seed against empty database; query income categories; assert count = 6 and names match FR-C2 exactly (Donation, Zakat, Sadaqah, Jumu'ah Collection, Membership/Contribution, Other) |
| T4 | integration | `seed.test.ts > should create exactly 10 expense categories` | Run seed against empty database; query expense categories; assert count = 10 and names match FR-C3 exactly (Electricity, Water, Maintenance, Cleaning, Salary/Wages, Construction, Equipment, Events/Programs, Office Expenses, Other) |
| T5 | integration | `seed.test.ts > should create admin user with mustChangePassword true` | Run seed with `SEED_ADMIN_EMAIL="admin@aitj.local"` and `SEED_ADMIN_PASSWORD="Correct10CharPwd"`; query User where email = "admin@aitj.local"; assert exists and `mustChangePassword = true` |
| T6 | integration | `seed.test.ts > should hash the admin password correctly` | Run seed; attempt to read the admin user's passwordHash; assert it is not equal to the plain `SEED_ADMIN_PASSWORD` (hashing is applied) |
| T7 | integration | `seed.test.ts > seed is idempotent — running twice produces no duplicates` | Run seed twice against the same database; query categories; assert count is still 6 income + 10 expense (no duplicates); query users; assert still 1 admin |
| T8 | integration | `seed.test.ts > seed does not create another admin if user exists` | Insert a different user manually; run seed; query users where isActive = true; assert count = 2 (the manual user + the seeded admin exists, but no *additional* admin was created) — actually, re-read this: if a user exists, seed should NOT create an admin. Let me fix: query for admin role or check that only the one seeded admin exists after first seed. Actually, the requirement is "if no user exists, create admin; if a user exists, don't create another admin". So: manually create User A, then run seed, then verify only User A exists (no admin was seeded). Let me rewrite this test. |
| T9 | integration | `seed.test.ts > seed does not create admin if any user exists` | Manually insert a non-admin user; run seed; query all users; assert the non-admin user is still there and no additional user (admin) was created |
| T10 | integration | `seed.test.ts > app boots with empty database after seeding` | Start the app (`next dev` or test server) with `DATABASE_URL` pointing to a fresh test database; seed runs automatically; wait for app to be healthy; navigate to `/login`; assert login page renders (a 200 response with form elements) |
| T11 | integration | `seed.test.ts > category names match FR-C2 and FR-C3 exactly (case-sensitive)` | Run seed; query categories; assert income categories are exactly ["Donation", "Zakat", "Sadaqah", "Jumu'ah Collection", "Membership/Contribution", "Other"] in some order; assert expense categories are exactly ["Electricity", "Water", "Maintenance", "Cleaning", "Salary/Wages", "Construction", "Equipment", "Events/Programs", "Office Expenses", "Other"] in some order |

**Red gate:** All 11 tests are written and fail because the seed script does not exist yet, or exists but is not idempotent, or does not validate password length, etc. Commit the failing test file and the stub seed script.

### 🟢 GREEN — implementation is done when

- [x] Every RED test passes, unchanged
- [x] `pnpm seed` executes without error (if test data seeding is needed for other tests)
- [x] `prisma/seed.ts` is idempotent and can be run multiple times safely
- [x] `pnpm test` and `pnpm lint` pass
- [x] Docker container successfully runs seed at startup (verified by M0-05 integration)
- [x] No secrets are logged (password hashes are never printed; env var names only)

## Implementation notes

- Create `prisma/seed.ts` that:
  1. Validates `SEED_ADMIN_PASSWORD` is set and at least 10 characters; fail loudly with `process.exit(1)` if not.
  2. Validates `SEED_ADMIN_EMAIL` is set; fail loudly if not.
  3. Connects to the database via Prisma (it reads DATABASE_URL from env).
  4. Checks if any User exists. If yes, skip admin creation. If no, create the admin.
  5. For each income and expense category, check if it already exists (by name and type, case-insensitively). If not, create it. If yes, skip.
  6. Exit cleanly (`process.exit(0)`) on success.
- Income categories (from FR-C2):
  ```
  Donation, Zakat, Sadaqah, Jumu'ah Collection, Membership/Contribution, Other
  ```
- Expense categories (from FR-C3):
  ```
  Electricity, Water, Maintenance, Cleaning, Salary/Wages, Construction, Equipment, Events/Programs, Office Expenses, Other
  ```
- Password hashing: use `bcrypt` (cost 12, per FR-A10) to hash the `SEED_ADMIN_PASSWORD` before storing it in the database.
- Add a `prisma.seed` field to `package.json`:
  ```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
  ```
- Alternatively, add a `seed` script to `package.json`: `"seed": "tsx prisma/seed.ts"`
- The Docker Dockerfile (M0-05) should call `node prisma/seed.js` or `pnpm seed` after migrations but before starting the server.
- Test environment: use a Testcontainers or disposable database for test runs (wired up in M0-06).
- Handle the case where the app is started multiple times concurrently (e.g., rolling deploy): use `INSERT ... ON CONFLICT DO NOTHING` or similar to avoid race conditions.

## Definition of done

- [x] All ACs met and all RED tests green
- [x] Seed script exists at `prisma/seed.ts` and is executable
- [x] `SEED_ADMIN_PASSWORD` validation fails loudly if missing or too short
- [x] Seed is idempotent: running twice produces no duplicates
- [x] Seed does not create an admin if any user already exists
- [x] Categories match FR-C2 and FR-C3 exactly (verbatim names, case-sensitive)
- [x] Admin account is created with `mustChangePassword: true` for first-login forced change
- [x] App starts and is queryable immediately after seeding completes
- [x] No secrets are logged during seed execution

## Implementation notes (dev-agent)

- Split into `prisma/seed-lib.ts` (pure, testable seeding logic — categories, admin creation, env validation) and `prisma/seed.ts` (thin script wrapper handling `process.exit`/subprocess concerns), so the logic is directly importable from tests without spawning a process per case.
- **bcrypt library**: used `bcryptjs` (pure-JS) rather than native `bcrypt`, to avoid adding a native build toolchain to the Dockerfile. CLAUDE.md specifies "bcrypt cost 12" without naming the exact package — flagged for review-agent, and for consistency, AITJ-M1-01 (`lib/auth/password.ts`) should use the same library.
- **T8/T10 test-plan deviations**: the ticket's own T8 row is a self-correcting draft ("Let me rewrite this test... Let me fix") — a duplicate/broken test description, not implementable as written; dropped it and kept the clean T9 it converges on. T10 (navigate to `/login`, assert the page renders) can't be implemented in M0 since `/login` is AITJ-M1-02's route and doesn't exist yet — substituted a DB-level "admin immediately queryable by email" assertion, plus a manual full-stack Docker verification (rebuilt the production image, ran the real entrypoint against a fresh volume, confirmed 6/10/1 rows and idempotent re-seed on restart).
- Fixed a pre-existing cross-test pollution risk: `tests/schema/constraints.test.ts` hardcodes some of the same category names ("Water", "Electricity", "Other") that seeding now genuinely creates in the shared test database. Added `afterAll` cleanup to `seed.test.ts` and switched its count assertions to filter by exact name list rather than bare `type`.

## Review notes

- **review-agent PASS (round 1)**: full suite 33/33 (including all 11 seed tests), tsc/lint clean, RED commit confirmed genuinely failing before GREEN. Idempotency verified at the implementation level — `createMany({ skipDuplicates: true })` (single round-trip, no N+1), `seedAdmin` checks `user.count()` first and also catches `P2002` for the concurrent-boot race. No secrets logged, bcrypt cost 12 confirmed. T8/T10 test-plan deviations independently confirmed justified (T8 is a self-correcting draft in the ticket source itself; T10's `/login` route doesn't exist until AITJ-M1-02). `bcryptjs` vs native `bcrypt` noted as a defensible, openly-flagged call — not blocking.
- **qa-agent BLOCKING (round 1)**: `tests/integration/seed.test.ts` hardcoded `admin@aitj.local` for its own fixtures — the exact same value as `.env.example`'s `SEED_ADMIN_EMAIL`, i.e. the real dev stack's admin account when run via `make test` against the live compose stack (not a throwaway Testcontainers DB). qa-agent reproduced live data loss: the real seeded admin row was deleted and could not be re-seeded on restart, because `seedAdmin()` correctly gates on "any User exists" (AC7) and other test files leave orphaned User rows behind, keeping that gate permanently tripped.
- **dev-agent fix (round 2)**: `tests/integration/seed.test.ts` now generates every fixture email per test run via `uniqueEmail()` (`tests/schema/fixtures.ts`'s existing precedent) instead of hardcoding `admin@aitj.local` / `manual-user@aitj.local` / `should-not-be-created@aitj.local`. The file now only ever creates and deletes rows it created itself. Verified live: reproduced qa-agent's exact scenario against the running Docker stack (`docker compose exec app pnpm exec vitest run tests/integration/seed.test.ts`, then full `pnpm test`) — no `admin@aitj.local` row is touched, `make fresh` was run to restore the real admin, and a `docker compose restart app` afterward confirms the admin survives a container restart intact.
- **Flagged follow-up, NOT fixed here (out of scope for M0-07)**: while reproducing this live, found that `tests/integration/global-setup.ts` (owned by AITJ-M0-06) unconditionally `TRUNCATE`s every app table once per `integration` project run whenever `DATABASE_URL` is already set — which it is, inside the `app` container, pointing at the live compose `db` service. This means **any** `make test`/`pnpm test`/`make ci` run against the live dev stack wipes all real data (Users, Categories, Transactions), independent of this ticket's fix — the literal-email collision only ever compounded an already-destructive mechanism. This needs its own fix in AITJ-M0-06 (e.g. gate the truncate behind an explicit "this is a disposable test database" opt-in, or refuse to run integration tests at all against a `DATABASE_URL` that already has a seeded admin) and should not be considered resolved by this round's fix.
- **Flagged follow-up, NOT fixed here (out of scope for M0-07)**: `tests/schema/models.test.ts`, `constraints.test.ts`, `relations.test.ts`, `migrate.test.ts`, `indexes.test.ts` (owned by AITJ-M0-03/AITJ-M0-04) create `User`/`Category` fixture rows via `uniqueEmail()`/`uniqueName()` but never delete them in `afterAll` — only `prisma.$disconnect()`. These rows are currently only ever cleared by the AITJ-M0-06 global truncate described above (at the *start* of the next full run), so between the end of one `make test` run and the next `make fresh`/reseed, orphaned rows keep the "any user exists" gate tripped. Belongs to the owning tickets for those test files, not to M0-07.
- **review-agent PASS (round 2)**: independently re-verified dev-agent's round-2 fix — `git show` confirmed every hardcoded literal replaced with `uniqueEmail()`; ran the real suite against the live compose stack (33/33 passing); reproduced the "admin survives `pnpm test`" claim directly; `tsc`/lint clean. Assessed the global-setup.ts truncate issue as **urgent, not a deferrable follow-up** — reproduced it live (a `pnpm test` run wiped the real admin during the review itself, restored via `migrate reset` + reseed) and explicitly recommended an immediate hotfix ahead of any M1 work, given the project is about to start writing real committee data into the same shared database.
- **Hotfix landed and merged**: per review-agent's urgent recommendation, `hotfix-test-harness-truncate-guard` (branch off `develop`, not a ticket) fixed `tests/integration/global-setup.ts` to skip the truncate whenever the `User` table is non-empty. Went through its own full review-agent (extra scrutiny given severity) → qa-agent cycle, both PASS, merged into `develop` (PR #7) before this ticket's branch was rebased onto it. This ticket's own two flagged follow-ups above are otherwise unaffected — the fixture-accumulation issue (M0-03/M0-04-owned) remains a real, still-open, non-blocking follow-up for a future ticket.
- **qa-agent BLOCKING (round 3)**: two issues found after rebasing onto the merged truncate-guard hotfix. (1) CRITICAL: `seed.test.ts`'s `afterAll` unconditionally deleted every `Category` row matching the canonical `INCOME_CATEGORIES`/`EXPENSE_CATEGORIES` name+type lists — since `seedCategories()` is idempotent (`createMany({ skipDuplicates: true })`), it never creates a *new* row when those categories already exist on a live/shared stack, so this cleanup deleted the real, permanent, pre-existing seeded categories every run. (2) Reliability: `seedAdmin()`'s "does any User exist at all" gate (AC7) is global, so once the shared dev database holds any User row (the real admin, or orphaned `tests/schema/*.test.ts` fixture rows — a known, separately-tracked M0-03/M0-04 follow-up that never deletes its own fixtures), that gate is permanently tripped and this suite's own "seeding against a real database" admin-creation assertions (T5-T7) silently stop exercising what they claim to, without failing loudly until qa reproduced it on a polluted stack.
- **dev-agent fix (round 3)**:
  - Removed the destructive `prisma.category.deleteMany(...)` from `afterAll` entirely. `seedCategories()` is non-destructive by design, so there is nothing for this suite to clean up for its category assertions — they already filter by exact canonical name, which is correct regardless of what else exists in the table.
  - Added `createIsolatedSeedSchema()`: for just the "seeding against a real database" and "app is queryable immediately after seeding" blocks (the ones that need genuine first-boot emptiness to validate AC4/AC6/T5-T7), creates a throwaway Postgres *schema* on the same database connection (`CREATE SCHEMA "seed_test_<uuid>"`, migrated independently via `prisma migrate deploy` against a `?schema=` connection URL), runs `runSeed` against it, and drops the schema in `afterAll`. This gives the tests a genuinely empty `User` table every run — immune to both the real seeded admin and any orphaned fixture rows from sibling test files — without ever reading, deleting, or risking real data. The "does not create an admin if a user already exists" and env-validation blocks are unaffected (their assertions are delta-based / gate-agnostic and don't need isolation).
  - Verified live: ran `make fresh` + `make seed` for a clean baseline (real `admin@aitj.local` + 16 canonical categories), then ran the full suite twice back-to-back inside the compose stack (`docker compose exec app pnpm test`) — 35/35 passing both times. Confirmed after both runs: the real admin (`admin@aitj.local`) and the real `Donation`/`Water`/etc. categories are untouched, and no `seed_test_*` schema is left behind (teardown ran cleanly). `tsc --noEmit`, `pnpm lint`, and `prettier --check` all clean.
  - No production code (`prisma/seed-lib.ts`, `prisma/seed.ts`) or `tests/integration/global-setup.ts` was touched — the fix is entirely within `tests/integration/seed.test.ts`.
