# AITJ-M2-02 — Create and rename categories with case-insensitive uniqueness

| Field | Value |
|---|---|
| Milestone | M2 — Categories |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M0-06, AITJ-M0-07, AITJ-M1-01, AITJ-M2-01 |
| Blocks | AITJ-M2-04, AITJ-M2-05 |
| PRD refs | FR-C4, FR-C5, FR-C6, §7, §8.2, §10 page 7 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

Users must be able to create a new category with a name and type (FR-C4), and rename existing categories (FR-C5). Transactions reference categories by ID, so renaming updates everywhere automatically. Names are unique per type, case-insensitively (FR-C6) — "Water" and "water" cannot both be expense categories, but income "Other" and expense "Other" may coexist. Validation is defined in §7 and enforced server-side (§8.2). The database `@@unique([name, type])` with a functional index on `lower(name)` (seeded in AITJ-M0-04) is the final arbiter; no application-level pre-check can race the database.

## Acceptance criteria

- [ ] AC1 — Server Action `createCategory(input: CreateCategoryInput)` validates and creates a category, returning `{ id, name, type, isArchived, sortOrder, createdAt, updatedAt }`
- [ ] AC2 — Server Action `renameCategory(id: string, newName: string)` validates and updates, returning the updated Category
- [ ] AC3 — Both actions assert an authenticated session via `authedAction`
- [ ] AC4 — Validation schema (`ValidationSchema.categoryName`) enforces: trimmed, 1–50 chars, matches regex `^[a-zA-Z0-9\s\-&'()./،]/u` (letters, digits, space, hyphen, ampersand, quotes, parens, slash, Arabic comma), required, non-blank after trim
- [ ] AC5 — If name already exists for the same type (case-insensitive), return error "A category with this name already exists"
- [ ] AC6 — Income "Other" and expense "Other" can coexist (one per type)
- [ ] AC7 — Creating a category returns `sortOrder: 0` by default (alphabetical sorting via repository)
- [ ] AC8 — Renaming a category updates existing transactions' displayed name (ID reference proves this; test on transaction detail view)
- [ ] AC9 — Both actions write audit entries via the same transaction (NFR-2)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Create category with name `" Water "` (leading/trailing space) | Trimmed to `Water`; if `Water` exists for same type, rejected with "A category with this name already exists" |
| E2 | Create expense category `"Water"`, then try to create `"water"` | Second fails: "A category with this name already exists" |
| E3 | Create income `"Other"`, then create expense `"Other"` | Both succeed; they are separate rows (different type) |
| E4 | Create with name `"a"` (1 char) | Succeeds |
| E5 | Create with name of 50 chars, exactly (e.g. 50× 'A') | Succeeds |
| E6 | Create with name of 51 chars | Fails: validation error (max 50) |
| E7 | Create with name `""` (empty string) or only spaces `"   "` | Fails: validation error (required, 1–50 after trim) |
| E8 | Create with name containing Unicode (e.g., `"مياه"` Arabic for water) | Succeeds if regex allows non-ASCII (decide and document); if rejected, error is validation message |
| E9 | Create with name `"Electricity & Water"` (ampersand) | Succeeds |
| E10 | Rename category to a name that collides case-insensitively with existing one of same type | Fails: "A category with this name already exists"; original name unchanged |
| E11 | Rename category to the same name (already has it) | Succeeds (no-op); returns the category unchanged |
| E12 | Concurrent creation of the same name by two users | Database `@@unique` is the final arbiter; second transaction fails with constraint error; application catches and returns "A category with this name already exists" |
| E13 | Rename category to a name that exists in a *different* type (e.g., rename expense `"Electricity"` to `"Other"`, which already exists as INCOME) | Succeeds; expense "Other" and income "Other" can coexist |
| E14 | Unauthenticated user calls `createCategory` | Redirects to login (session assert) |
| E15 | User without session calls `renameCategory` | Redirects to login (session assert) |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | unit | `lib/validation/category.test.ts > categoryName schema trims and validates` | Valid: `"  Water  "` → `"Water"`; validates true |
| T2 | unit | `lib/validation/category.test.ts > categoryName schema rejects empty` | Input: `""` or `"   "`, validation fails |
| T3 | unit | `lib/validation/category.test.ts > categoryName schema enforces 1–50 char boundary` | 0 chars: invalid; 1 char: valid; 50 chars: valid; 51 chars: invalid |
| T4 | unit | `lib/validation/category.test.ts > categoryName schema allows letters, digits, spaces, hyphen, ampersand, etc` | Valid inputs: `"Maintenance & Repair"`, `"Water/Electricity"`, `"A&B"` pass validation |
| T5 | integration | `actions/categories.test.ts > createCategory requires authenticated session` | Unauthenticated call throws or redirects; test via mock session = null |
| T6 | integration | `actions/categories.test.ts > createCategory creates and returns category` | Call with valid input, assert returned object has id, name, type, isArchived=false, sortOrder=0 |
| T7 | integration | `actions/categories.test.ts > createCategory enforces case-insensitive uniqueness per type` | Create expense "Water", attempt to create expense "water", error is "A category with this name already exists" |
| T8 | integration | `actions/categories.test.ts > createCategory allows same name in different types` | Create income "Other", then create expense "Other", both succeed |
| T9 | integration | `actions/categories.test.ts > createCategory writes audit entry` | Create category, retrieve audit log, assert one CREATE entry with entityType="Category", action="CREATE", and after={name, type, ...} |
| T10 | integration | `actions/categories.test.ts > createCategory is atomic with audit` | Simulate audit write failure (mock), assert category is not created (both or nothing) |
| T11 | integration | `actions/categories.test.ts > renameCategory requires authenticated session` | Unauthenticated call throws or redirects |
| T12 | integration | `actions/categories.test.ts > renameCategory updates and returns category` | Create, call renameCategory, assert returned name matches new name |
| T13 | integration | `actions/categories.test.ts > renameCategory enforces case-insensitive uniqueness` | Create "Water" and "Electricity", attempt to rename "Electricity" to "water", fails with "A category with this name already exists" |
| T14 | integration | `actions/categories.test.ts > renameCategory allows rename to same name (idempotent)` | Rename category to its current name, succeeds, returns unchanged category |
| T15 | integration | `actions/categories.test.ts > renameCategory updates transaction references` | Create category, create transaction with it, rename category, query transaction detail, assert category name is new name (via getTransactionById or similar, latent on M3-01) |
| T16 | integration | `actions/categories.test.ts > renameCategory writes audit entry with before/after` | Rename, retrieve audit log, assert one UPDATE entry with before={name: old} and after={name: new} |
| T17 | integration | `actions/categories.test.ts > concurrent createCategory with same name races database` | Simulate two concurrent calls via Promise.all, assert one succeeds and one fails with "A category with this name already exists" (database constraint, not application pre-check) |
| T18 | integration | `actions/categories.test.ts > createCategory with name at Unicode boundaries` | Create category with Arabic/Hindi text (if regex allows), assert name stored and retrievable; if regex rejects, assert validation error |

**Red gate:** All 18 tests written, failing for the right reason (missing module, missing action, validation fails when it should, or assertion mismatch). Commit failing tests before implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

**File: `lib/validation/category.ts`** — add or update

- Export `CreateCategoryInput` and `RenameCategoryInput` Zod schemas
- `CreateCategoryInput`: `{ name: string (trimmed, 1–50, unique per type case-insensitive), type: 'INCOME' | 'EXPENSE' }`
- `RenameCategoryInput`: `{ id: cuid, newName: string (same rules as name) }`
- Schema error message for non-unique name: "A category with this name already exists"

**File: `actions/categories.ts`** — new file

- Export `async function createCategory(input: CreateCategoryInput)` — wrapped in `authedAction`
- Export `async function renameCategory(id: string, newName: string)` — wrapped in `authedAction`
- Both call repository methods from M2-01
- Both call `auditLog.create({ entityType: 'Category', entityId: id, action: 'CREATE' | 'UPDATE', actorId: session.user.id, before: ..., after: ... })` inside the same transaction as the category mutation
- Catch database unique constraint error and translate to "A category with this name already exists"
- `revalidatePath('/categories')` after successful mutation

**File: `lib/repositories/category.ts`** — extend from M2-01

- Add method `checkCategoryNameUnique(name: string, type: TransactionType, excludeId?: string)` that returns boolean (needed by validation layer, and used by actions before calling repository create/rename to provide early feedback)
- Note: The DB constraint is the final arbiter; this is convenience only and not relied upon for correctness

**UI:** Not in scope for this ticket (see M2-04). Validation and actions only.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present; client-side (form) validation alone is never sufficient
- [ ] Session asserted via `authedAction` on both actions
- [ ] Audit entries written atomically with mutations (NFR-2)
- [ ] Database `@@unique([name, type])` and case-insensitive index (from M0-04) are the constraint; application pre-checks are convenience only
- [ ] Concurrent creates are safe — database unique index is tested (T17)
- [ ] No N+1 queries — each action makes 1 repository call + 1 audit write + 1 revalidate
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts, passwords, or tokens in logs
- [ ] Reviewed by review-agent → QA signed off
