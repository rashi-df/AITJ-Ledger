# AITJ-M0-04 — Add raw migration for case-insensitive category uniqueness and type check constraint

| Field | Value |
|---|---|
| Milestone | M0 — Foundation |
| Depends on | AITJ-M0-03 |
| Blocks | AITJ-M0-07 |
| PRD refs | §6.1, FR-C6 |
| Est. | 1 day |
| Phase | 🟢 GREEN |

## Context

The Prisma schema (M0-03) defines `@@unique([name, type])` on the Category model, but PostgreSQL's default string comparison is case-sensitive. This ticket adds a raw SQL migration that enforces case-insensitive uniqueness per type (allowing both income "Other" and expense "Other" to coexist, but rejecting "Water" and "water" as expenses). Additionally, a check constraint ensures every Transaction's type matches its linked Category's type (§6.1 model notes, denormalization invariant).

## Acceptance criteria

- [x] AC1 — A raw migration (`*.sql` file in `prisma/migrations/`) is created
- [x] AC2 — The migration drops the case-sensitive `@@unique([name, type])` index and creates a functional unique index on `(LOWER(name), type)` or uses PostgreSQL `citext` extension
- [x] AC3 — A check constraint on Transaction ensures `type = category.type` (read from the joined category row or enforced via a trigger)
- [x] AC4 — The migration is idempotent: running it twice does not error
- [x] AC5 — Existing data (empty at this stage) passes the check constraint
- [x] AC6 — Category names are now unique case-insensitively per type

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Insert expense category "Water", then attempt "water" as expense | Database rejects the second insert (duplicate key on functional index) |
| E2 | Insert income category "Other", then expense category "Other" | Both succeed (different type values, so they are unique per-type pair) |
| E3 | Insert income category "Donation", then attempt income "DONATION" in uppercase | Database rejects the second insert (case-insensitive uniqueness) |
| E4 | Create a Transaction with type=INCOME linked to an expense category | Database rejects (check constraint violation) |
| E5 | Create a Transaction with type=EXPENSE linked to an income category | Database rejects (check constraint violation) |
| E6 | Run migration twice (e.g., in Docker container restart) | Migration succeeds idempotently; no errors or duplicate index warnings |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `constraints.test.ts > case-insensitive uniqueness > income "Other" + expense "Other" allowed` | Insert Category {name: "Other", type: INCOME}, then {name: "Other", type: EXPENSE}; both succeed |
| T2 | integration | `constraints.test.ts > case-insensitive uniqueness > expense "Water" then "water" rejected` | Insert Category {name: "Water", type: EXPENSE}; attempt {name: "water", type: EXPENSE}; database rejects with unique constraint violation |
| T3 | integration | `constraints.test.ts > case-insensitive uniqueness > expense "Electricity" then "ELECTRICITY" rejected` | Insert Category {name: "Electricity", type: EXPENSE}; attempt {name: "ELECTRICITY", type: EXPENSE}; database rejects |
| T4 | integration | `constraints.test.ts > type check constraint > transaction type must match category type` | Create Category {name: "Donation", type: INCOME}; attempt to insert Transaction {type: EXPENSE, categoryId: donation.id}; database rejects |
| T5 | integration | `constraints.test.ts > type check constraint > income transaction with income category succeeds` | Create Category {name: "Donation", type: INCOME}; insert Transaction {type: INCOME, categoryId: donation.id, amount: 500.00}; succeeds |
| T6 | integration | `constraints.test.ts > type check constraint > expense transaction with expense category succeeds` | Create Category {name: "Electricity", type: EXPENSE}; insert Transaction {type: EXPENSE, categoryId: electricity.id, amount: 2000.00}; succeeds |

**Red gate:** All 6 tests fail because the migration has not been run yet (functional unique index does not exist or is case-sensitive; type check constraint not yet enforced). Write the test file and commit it; do not apply the migration yet.

### 🟢 GREEN — implementation is done when

- [x] Every RED test passes, unchanged
- [x] `prisma migrate deploy` applies the migration without errors
- [x] `pnpm tsc --noEmit` and `pnpm lint` pass
- [x] No existing data is lost (currently empty, but the operation should be reversible in principle)
- [x] The migration is idempotent and can be re-run safely

## Implementation notes

- Create a new migration via `prisma migrate dev --name add_case_insensitive_unique_and_type_constraint` (or manually create a timestamped file in `prisma/migrations/`).
- In the migration SQL, either:
  - **Option A (citext):** Use PostgreSQL's `citext` extension for case-insensitive text:
    ```sql
    CREATE EXTENSION IF NOT EXISTS citext;
    ALTER TABLE "Category" ALTER COLUMN "name" TYPE citext;
    -- Then the existing @@unique([name, type]) works case-insensitively
    ```
  - **Option B (functional index):** Drop the existing unique constraint and create a functional index:
    ```sql
    ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_name_type_key";
    CREATE UNIQUE INDEX "Category_name_type_lower" ON "Category" (LOWER("name"), "type");
    ```
- Add a check constraint on Transaction:
  ```sql
  ALTER TABLE "Transaction" ADD CONSTRAINT "check_transaction_type_matches_category" 
    CHECK (
      "type" = (SELECT "type" FROM "Category" WHERE "id" = "categoryId")
    );
  ```
  (Or use a trigger if the above CHECK is too complex for Postgres.)
- Ensure the migration is stored in `prisma/migrations/` as a `.sql` file.
- Test the migration against a real PostgreSQL 16 instance (M0-06 will provide the test harness).

## Definition of done

- [x] All ACs met and all RED tests green
- [x] Migration file exists in `prisma/migrations/`
- [x] `prisma migrate deploy` applies it without error
- [x] Both case-insensitive uniqueness and type check constraints are enforced at the database level
- [x] Idempotency confirmed: running the migration twice succeeds

## Review notes

- **review-agent REJECT (round 1)**: `DROP CONSTRAINT IF EXISTS "Category_name_type_key"` was a no-op — Prisma's M0-03 `@@unique([name, type])` was emitted as a bare `CREATE UNIQUE INDEX`, not a table constraint, so it has no `pg_constraint` entry and the drop silently did nothing. The old case-sensitive index survived alongside the new functional one, and no test caught it. Fixed in `453add2`: `DROP INDEX IF EXISTS` instead, plus a new regression test asserting `Category_name_type_key` is absent from `pg_indexes` post-migration.
- **review-agent PASS (round 2)**: fix verified — migration read line-by-line, all statements idempotent (`DROP INDEX IF EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`). Full suite 18/18 passing against real Postgres 16, `tsc`/`lint` clean. Type-consistency trigger (not a CHECK constraint, since Postgres CHECK can't reference another table) confirmed correct. No app/repository code exists yet at this stage, so N+1/data-leak/Server Action rules are correctly out of scope.
- **qa-agent PASS**: all 6 ACs and 6 edge cases independently re-verified against a live Testcontainers Postgres 16 (ad hoc Prisma calls, not just the checked-in tests). Idempotency confirmed at the raw-SQL level (`psql -f` re-run twice directly), not just via Prisma's migration-tracking. Cross-ticket consistency N/A — no app code exists yet to check against. Signed off deploy-ready.
