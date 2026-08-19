# AITJ-M3-03 — Build audit log writer bound to mutation transactions

| Field | Value |
|---|---|
| Milestone | M3 — Transactions |
| Depends on | AITJ-M0-03, AITJ-M0-04 |
| Blocks | AITJ-M3-04, AITJ-M3-07, AITJ-M3-08 |
| PRD refs | FR-T12, NFR-2, §6, §8.2 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

Every transaction mutation (create, update, delete, restore) writes an audit entry recording the actor, timestamp, action, and before/after values. The audit entry is written inside the same database transaction as the mutation, guaranteeing atomicity (NFR-2): either both commit or both roll back, so the ledger is never inconsistent between a row and its audit trail. The audit entry is structured per the AuditLog model (§6): `entityType` (always "Transaction"), `entityId`, `action` (CREATE, UPDATE, DELETE, RESTORE), `actorId`, `before`, `after` (JSON), and `createdAt`.

## Acceptance criteria

- [ ] AC1 — `lib/repositories/auditLogRepository.ts` exports `recordAudit(prismaClient, entityType, entityId, action, actorId, before?, after?)` that creates an AuditLog row
- [ ] AC2 — `recordAudit()` must be called inside a Prisma transaction (passed as the `prismaClient` parameter), so the audit entry and the mutation commit or fail together
- [ ] AC3 — `before` and `after` are JSON objects (not stringified); Prisma stores them in the `Json` column type
- [ ] AC4 — `before` object must never contain `passwordHash` or any secret; audit entry fails if before/after contain secrets
- [ ] AC5 — For CREATE action, `before` is null (or omitted) and `after` contains the created transaction data (type, amount, categoryId, occurredOn, description, createdById, id)
- [ ] AC6 — For UPDATE action, `before` and `after` both contain the full transaction state (old and new values)
- [ ] AC7 — For DELETE action, `before` contains the full transaction state before deletion; `after` is null (or omitted)
- [ ] AC8 — For RESTORE action, `before` contains the deleted state; `after` contains the restored state
- [ ] AC9 — Amounts in audit before/after are Decimal strings (e.g. "1000.50"), not numbers
- [ ] AC10 — Timestamps (createdAt, updatedAt) in before/after are ISO strings, not Date objects
- [ ] AC11 — The audit entry `createdAt` is set to the current server timestamp at the moment of recording
- [ ] AC12 — Audit entries are never updated or deleted; they are immutable once written

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | `before` contains `passwordHash` field (should never happen in transaction audit, but guard anyway) | recordAudit rejects with an error; does not persist the entry |
| E2 | `after` contains `createdBy.passwordHash` via a relation | recordAudit rejects; passwords never leave the repository layer |
| E3 | Action is CREATE, before is passed anyway | before is ignored; after is the source of truth |
| E4 | Action is DELETE, after is passed anyway | after is ignored; before is the source of truth |
| E5 | Mutation commits but audit write fails (e.g., DB permission denied) | The entire transaction rolls back; the mutation row does NOT persist |
| E6 | entityType = "Transaction", entityId = valid cuid | Audit entry created successfully |
| E7 | entityType = invalid value (not "Transaction", "Category", "User") | recordAudit rejects (may be caught by schema or schema omitted; state decision) |
| E8 | actorId is null or missing | recordAudit rejects; actor is required |
| E9 | Audit is called outside a Prisma transaction (raw db.query) | Function still works but will not be atomic (this is a usage error; document requirement) |
| E10 | Two mutations to the same transaction within a transaction block | Both audit entries are written; both commit or both roll back |
| E11 | Description contains `"`, `<`, `&`, newlines, multi-byte UTF-8 in audit before/after | Stored as-is in JSON; no escaping in repository layer (escaping happens at serialization) |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `auditLogRepository › recordAudit › CREATE action` | After create transaction, audit entry exists with action=CREATE, before=null, after contains all fields |
| T2 | integration | `auditLogRepository › recordAudit › UPDATE action` | After update, audit entry has action=UPDATE, before=old state, after=new state |
| T3 | integration | `auditLogRepository › recordAudit › DELETE action` | After soft delete, audit entry has action=DELETE, before=deleted state, after=null |
| T4 | integration | `auditLogRepository › recordAudit › RESTORE action` | After restore, audit entry has action=RESTORE, before=deleted state, after=restored state |
| T5 | integration | `auditLogRepository › recordAudit › stores actorId` | Audit entry actorId matches the userId passed |
| T6 | integration | `auditLogRepository › recordAudit › stores timestamp` | Audit entry createdAt is within 1 second of now |
| T7 | integration | `auditLogRepository › recordAudit › stores entityType and entityId` | Audit entry has entityType="Transaction" and entityId matching the transaction |
| T8 | integration | `auditLogRepository › recordAudit › amount is Decimal string` | Audit after.amount is a string like "1000.50", not a number |
| T9 | integration | `auditLogRepository › recordAudit › timestamp fields are ISO strings` | Audit after.createdAt is ISO string, not Date object |
| T10 | integration | `auditLogRepository › recordAudit › mutation and audit commit together` | Seed transaction, update with auditLogRepository inside Prisma tx; both commit |
| T11 | integration | `auditLogRepository › recordAudit › atomicity: audit write fails, mutation rolls back` | Mock audit write failure; transactionRepository.create calls recordAudit inside tx; if audit fails, transaction row is NOT persisted |
| T12 | integration | `auditLogRepository › recordAudit › rejects passwordHash in before` | Call recordAudit with before.passwordHash; fails to persist |
| T13 | integration | `auditLogRepository › recordAudit › rejects passwordHash in after` | Call recordAudit with after.passwordHash; fails to persist |
| T14 | integration | `auditLogRepository › recordAudit › does not sanitize description (escaping is at serialization)` | Audit after.description = "Cost: <tag>, \"urgent\"\n"; stored as-is in JSON |
| T15 | integration | `auditLogRepository › recordAudit › idempotence: multiple calls same data result in multiple entries` | Call recordAudit twice with same data; both entries exist (no deduplication) |

**Red gate:** Every test above is written and failing. Commit the failing tests before implementing.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.
- [ ] Integration tests run against a real PostgreSQL instance.

## Implementation notes

**File to create:** `lib/repositories/auditLogRepository.ts`

**Approach:**
- Export `recordAudit(prisma: PrismaClient, entityType: string, entityId: string, action: AuditAction, actorId: string, before?: any, after?: any): Promise<AuditLog>`
- The function receives the Prisma client from the caller; this ensures the caller controls the transaction scope.
- Use `prisma.auditLog.create()` to insert the row.
- Validate that `before` and `after` do NOT contain `passwordHash` or other secrets before persisting. Use a whitelist approach (list allowed fields) or a blacklist (reject passwordHash and any field matching /.secret|.password|.token/i). State which approach is chosen.
- Convert Decimal objects to strings using `.toString()`.
- Do NOT stringify JSON; pass objects directly to Prisma, which handles JSON serialization.
- Call should look like:
  ```typescript
  await recordAudit(
    prisma,
    "Transaction",
    transaction.id,
    "CREATE",
    userId,
    undefined,
    { id, type, amount: amount.toString(), categoryId, occurredOn, description, createdById }
  )
  ```
- The Server Action (M3-04) will wrap the repository call and transaction together.

**Repository method name:** Repository may call this directly: `transactionRepository.create(data, userId)` will internally call `recordAudit()` inside a transaction block (see M3-02).

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side audit layer established and tested
- [ ] Secrets (passwordHash, tokens) are never persisted in audit entries
- [ ] Amounts stored as Decimal strings in JSON
- [ ] Atomicity test passes: if audit write fails, mutation rolls back
- [ ] Integration tests run on real Postgres
- [ ] No N+1 queries
- [ ] No unused variables or dead code
- [ ] No secrets or amounts in application logs (NFR-8)
- [ ] Reviewed by review-agent
