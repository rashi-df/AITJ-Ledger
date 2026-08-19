# AITJ-M0-03 — Define Prisma schema and initial migration

| Field | Value |
|---|---|
| Milestone | M0 — Foundation |
| Depends on | AITJ-M0-01, AITJ-M0-02 |
| Blocks | AITJ-M0-04, AITJ-M0-07 |
| PRD refs | §6, A5, A6 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

This ticket defines the Prisma schema (§6 of the PRD) — the complete data model for users, categories, transactions, invites, audit logs, and app settings. The schema is the single source of truth for the database structure. All models, fields, indexes, and relationships must be reproduced exactly as specified in §6. Prisma migrations will be created to apply this schema to a PostgreSQL 16 database.

## Acceptance criteria

- [ ] AC1 — `prisma/schema.prisma` contains all models from §6: User, Invite, Category, Transaction, AuditLog, AppSetting
- [ ] AC2 — All fields, types, and relations match §6 exactly (enum TransactionType, enum AuditAction, all field constraints)
- [ ] AC3 — All indexes from §6 are present (e.g., @@index on transactions for efficient queries)
- [ ] AC4 — Relations are correctly bidirectional and enforce referential integrity
- [ ] AC5 — `onDelete: Restrict` is applied to the Transaction → Category relation (FR-C7)
- [ ] AC6 — `Decimal(14,2)` is used for Transaction.amount, rejecting 3+ decimal places and storing ₹99,99,99,999.99 exactly
- [ ] AC7 — Transaction.occurredOn is `@db.Date` (no time component, per A5)
- [ ] AC8 — A migration file is generated and can be applied to a real PostgreSQL 16 database
- [ ] AC9 — `prisma db push` or `prisma migrate deploy` applies the schema without errors
- [ ] AC10 — The database is queryable immediately after migration; a smoke test can insert and read a row

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Attempt to insert a Transaction with an amount of 0 | Database allows it (validation is application-level, per §7); a later M1 validator rejects it |
| E2 | Insert 1234567.89 into amount (DECIMAL(14,2)) | Database stores exactly `1234567.89`; fetching via Prisma returns `Decimal('1234567.89')` |
| E3 | Attempt to insert 1234567.999 into amount | Database rejects (more than 2 decimal places) |
| E4 | Insert a date in the future (e.g. 2027-08-19) into occurredOn | Database allows it (per A7, future dates are allowed; UI warns) |
| E5 | Attempt to delete a category in use by a transaction | Database rejects (onDelete: Restrict enforced at DB level) |
| E6 | Multiple users create transactions in the same second | No conflict; createdAt is unique per row, indexed for efficiency |
| E7 | Empty database state | All tables exist and are empty; no default rows are present yet (seeding happens in M0-07) |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `schema > migrate.test.ts > migration should be applicable` | Running `prisma migrate deploy` against a fresh Testcontainers PostgreSQL 16 database succeeds |
| T2 | integration | `schema > migrate.test.ts > all tables should exist` | After migration, querying `information_schema.tables` confirms User, Category, Transaction, Invite, AuditLog, AppSetting tables exist |
| T3 | integration | `schema > models.test.ts > User model` | Create a User, read it back; createdAt is set; email is unique |
| T4 | integration | `schema > models.test.ts > Category model` | Create a Category with type INCOME; read it back; fields match (name, type, isArchived, sortOrder) |
| T5 | integration | `schema > models.test.ts > Transaction model` | Create a Transaction with amount `1234.56`; Prisma returns `Decimal('1234.56')` not `1234.56` (number) |
| T6 | integration | `schema > models.test.ts > Transaction.amount precision` | Insert amount `99999999999.99`; fetch it back; assert exact string match `"99999999999.99"` (not rounded/truncated) |
| T7 | integration | `schema > models.test.ts > Transaction.occurredOn is DATE` | Insert a Transaction with occurredOn = 2026-08-19; database stores date only (no time); fetch and assert date is correct |
| T8 | integration | `schema > constraints.test.ts > onDelete Restrict` | Create a Category, create a Transaction using it, attempt to delete the Category; database rejects with a constraint violation (not a cascade delete) |
| T9 | integration | `schema > indexes.test.ts > Transaction indexes exist` | Query `information_schema.statistics` and confirm indexes on (deletedAt, occurredOn), (deletedAt, type, occurredOn), and (deletedAt, categoryId) exist |
| T10 | integration | `schema > relations.test.ts > Transaction.category relation` | Create a Category, create a Transaction linked to it via categoryId; read Transaction with `include: { category: true }`; category is populated |
| T11 | integration | `schema > relations.test.ts > User relations` | Create a User, create an Invite with that User as invitedBy; read Invite with `include: { invitedBy: true }`; invitedBy is populated |

**Red gate:** All 11 tests are written and fail because the schema does not exist yet (Prisma client cannot connect, tables do not exist, or migrations are not applied). Commit the failing test files and the empty schema stub.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `prisma generate` succeeds (Prisma client is generated)
- [ ] `prisma migrate dev --name init` creates a migration file without errors
- [ ] `pnpm tsc --noEmit` and `pnpm lint` pass
- [ ] No data loss or unexpected schema changes

## Implementation notes

- Create `prisma/schema.prisma` from scratch (or copy the template from §6 verbatim).
- Set `datasource db` to PostgreSQL with environment variable `DATABASE_URL`.
- Define enums `TransactionType` and `AuditAction` exactly as specified in §6.
- Define all six models (User, Invite, Category, Transaction, AuditLog, AppSetting) with every field, type, and index from §6.
- Use `@db.Decimal(14, 2)` for amounts (Prisma maps this to PostgreSQL DECIMAL).
- Use `@db.Date` for occurredOn (PostgreSQL DATE type, no time component).
- Ensure all relations are bidirectional and use correct field references.
- Run `prisma migrate dev --name init` to generate the initial migration.
- Write integration tests using Testcontainers or a disposable compose stack (M0-06 will wire this up formally).
- Do not create any seed data in this ticket (seeding happens in M0-07).

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] `prisma/migrations/` contains the initial migration file
- [ ] Schema matches §6 exactly — every model, field, index, and relation
- [ ] Database can be created and is queryable
- [ ] No migrations fail on apply
- [ ] Integration tests confirm constraints work at the database level
