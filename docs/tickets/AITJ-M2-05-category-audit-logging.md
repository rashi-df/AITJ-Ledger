# AITJ-M2-05 — Category audit logging

| Field | Value |
|---|---|
| Milestone | M2 — Categories |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M0-06, AITJ-M0-07, AITJ-M1-01, AITJ-M2-01, AITJ-M2-02, AITJ-M2-03, AITJ-M2-04 |
| Blocks | none |
| PRD refs | FR-T12, §5.3 FR-T12, §6 AuditLog model, §8.2, NFR-2, NFR-8 |
| Est. | 0.5 days |
| Phase | 🔴 RED |

## Context

Every category mutation (create, rename, archive, unarchive, delete) writes an audit entry to record who did what and when, with before/after state (FR-T12). The AuditLog model (§6) is generic, with `entityType`, `entityId`, `action` (CREATE, UPDATE, DELETE), `actorId`, `before`, and `after` fields. Audit entries are written in the same database transaction as the mutation itself (NFR-2) to guarantee atomicity: either both the mutation and the audit entry commit, or neither does. Amounts and sensitive data never appear in logs (NFR-8).

## Acceptance criteria

- [ ] AC1 — Creating a category writes an AuditLog entry with `action: CREATE`, `entityType: "Category"`, `before: null`, and `after: { id, name, type, isArchived, sortOrder, createdAt, updatedAt }`
- [ ] AC2 — Renaming a category writes an AuditLog entry with `action: UPDATE`, `before: { name: oldName }`, and `after: { name: newName }`
- [ ] AC3 — Archiving a category writes an AuditLog entry with `action: UPDATE`, `before: { isArchived: false }`, and `after: { isArchived: true }`
- [ ] AC4 — Unarchiving a category writes an AuditLog entry with `action: UPDATE`, `before: { isArchived: true }`, and `after: { isArchived: false }`
- [ ] AC5 — Deleting a category writes an AuditLog entry with `action: DELETE`, `entityType: "Category"`, `before: { id, name, type, ... }` (full state), and `after: null`
- [ ] AC6 — All audit entries include `actorId` (from session), `entityId` (category id), and `createdAt` (timestamp)
- [ ] AC7 — Audit entries are written inside the same database transaction as the mutation (NFR-2); if mutation succeeds and audit fails, both roll back
- [ ] AC8 — Sensitive data (passwords, tokens) are never recorded in audit entries
- [ ] AC9 — No amounts or financial data are logged in audit entries (NFR-8)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Create a category | Audit entry: `action: CREATE`, `before: null`, `after` contains all fields |
| E2 | Rename a category | Audit entry: `action: UPDATE`, `before: { name: old }`, `after: { name: new }` (partial before/after, not full state) |
| E3 | Archive a category | Audit entry: `action: UPDATE`, `before: { isArchived: false }`, `after: { isArchived: true }` |
| E4 | Unarchive a category | Audit entry: `action: UPDATE`, `before: { isArchived: true }`, `after: { isArchived: false }` |
| E5 | Delete a category | Audit entry: `action: DELETE`, `before` contains full state, `after: null` |
| E6 | Audit write fails (DB error) | Both category mutation and audit entry roll back; action throws error to user |
| E7 | Concurrent creates by different users | Two audit entries created with different `actorId` values; both record correctly |
| E8 | View audit log filtered by entityType="Category" | All category audit entries appear; transaction and user entries are filtered out |
| E9 | View audit log filtered by entityId | Shows all mutations (CREATE, UPDATE, DELETE) for that specific category |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `actions/categories.test.ts > createCategory creates audit entry` | Create category, query AuditLog, assert one entry with action: "CREATE", before: null, after has full state |
| T2 | integration | `actions/categories.test.ts > createCategory audit includes actorId` | Create category as logged-in user, query audit entry, assert actorId matches session.user.id |
| T3 | integration | `actions/categories.test.ts > renameCategory creates audit entry with before/after` | Rename category from "Water" to "Electricity", query audit, assert before={name: "Water"}, after={name: "Electricity"} |
| T4 | integration | `actions/categories.test.ts > archiveCategory creates audit entry` | Archive category, query audit, assert action: "UPDATE", before={isArchived: false}, after={isArchived: true} |
| T5 | integration | `actions/categories.test.ts > unarchiveCategory creates audit entry` | Unarchive category, query audit, assert action: "UPDATE", before={isArchived: true}, after={isArchived: false} |
| T6 | integration | `actions/categories.test.ts > deleteCategory creates audit entry` | Delete category, query audit, assert action: "DELETE", before contains full state, after: null |
| T7 | integration | `actions/categories.test.ts > audit and mutation are atomic` | Mock auditLog.create to throw, call createCategory, assert category is not created (rollback on audit failure) |
| T8 | integration | `lib/repositories/audit.test.ts > writeAuditLog writes to AuditLog table` | Call auditLog.create(...), query AuditLog, assert row exists with correct fields |
| T9 | integration | `lib/repositories/audit.test.ts > audit entries don't contain amounts or sensitive data` | Create and audit a transaction (from M3), verify audit entry has no amount or password fields |
| T10 | integration | `app/(app)/settings/audit-log-viewer.test.tsx > filter audit by entityType Category` | Seed audit entries for categories and transactions, render audit viewer, filter by "Category", assert only category entries shown |
| T11 | integration | `app/(app)/settings/audit-log-viewer.test.tsx > filter audit by entityId` | Seed multiple category audit entries, filter by one category id, assert only that category's entries shown |
| T12 | e2e | `audit.spec.ts > audit log shows category create/update/delete trail` | Playwright: create, rename, archive, delete category, navigate to Settings → Audit Log, verify all actions appear with correct actor and timestamp |
| T13 | e2e | `audit.spec.ts > audit log timestamp is accurate` | Create category, check audit timestamp, assert within 1 second of current time |
| T14 | e2e | `audit.spec.ts > concurrent creates record different actorIds` | Playwright: simulate two users (via multiple sessions), both create a category, audit log shows both with different actorId |
| T15 | integration | `actions/categories.test.ts > archiveCategory on already-archived still writes audit` | Archive already-archived category (idempotent), query audit, assert entry written even though state unchanged |
| T16 | integration | `actions/categories.test.ts > renameCategory to same name still writes audit` | Rename category to its current name, query audit, assert entry written (even though state unchanged) |

**Red gate:** All 16 tests written, failing for the right reason. T10 and T11 may reference M7 (Settings audit viewer) which is deferred; mark as pending if not yet implemented. Commit failing tests before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**File: `actions/categories.ts`** — extend from M2-02/M2-03

- All category actions already call audit logging (added in M2-02/M2-03)
- Verify each action uses `prisma.$transaction` to wrap the category mutation and the `auditLog.create` call
- Example pattern:
  ```typescript
  const [category, auditEntry] = await prisma.$transaction([
    prisma.category.create({ data: { name, type } }),
    prisma.auditLog.create({
      data: {
        entityType: 'Category',
        entityId: createdCategory.id,
        action: 'CREATE',
        actorId: session.user.id,
        before: null,
        after: {
          id: createdCategory.id,
          name: createdCategory.name,
          type: createdCategory.type,
          isArchived: createdCategory.isArchived,
          sortOrder: createdCategory.sortOrder,
          createdAt: createdCategory.createdAt.toISOString(),
          updatedAt: createdCategory.updatedAt.toISOString(),
        },
      },
    }),
  ])
  ```
- For UPDATE (rename, archive, unarchive), include only the changed fields in `before` and `after`:
  ```
  before: { name: oldName },
  after: { name: newName }
  ```
- For DELETE, include full state in `before`:
  ```
  before: { id, name, type, isArchived, sortOrder, createdAt, updatedAt },
  after: null
  ```

**File: `lib/repositories/audit.ts`** — helper (may already exist from M3 prep)

- Export `async function auditLog(params: { entityType, entityId, action, actorId, before?, after? })` if not present
- Wrapper around `prisma.auditLog.create` for consistency

**Integration with M3 Transaction audit:** Transactions (M3) will also write audit entries. Use the same pattern and test infrastructure for both.

**Integration with M7 audit viewer:** Settings page (M7) will provide UI to filter and view audit log. This ticket ensures the data is correctly written. M7 will query and display it.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Category mutations and audit entries are atomic (tested via transaction rollback)
- [ ] All four actions (create, rename, archive/unarchive, delete) write correct audit entries
- [ ] Sensitive data is never logged (no passwords, tokens)
- [ ] Financial amounts are never logged
- [ ] Audit entries include actor, timestamp, and before/after state
- [ ] Concurrent mutations record different actors
- [ ] Idempotent operations (archive→archive, unarchive→unarchive) still write audit entries
- [ ] No N+1 queries in audit write path
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts, passwords, or tokens in code or logs
- [ ] Reviewed by review-agent → QA signed off
