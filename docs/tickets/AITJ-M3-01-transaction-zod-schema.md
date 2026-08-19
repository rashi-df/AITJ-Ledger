# AITJ-M3-01 — Build shared Zod transaction validation schema

| Field | Value |
|---|---|
| Milestone | M3 — Transactions |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M2-01 |
| Blocks | AITJ-M3-04, AITJ-M3-05, AITJ-M3-06, AITJ-M3-07 |
| PRD refs | FR-T1, FR-T2, FR-T3, FR-T4, FR-T5, §7, A1, A2, A5, A6, A10, §6.1 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

Every transaction validation rule (amount, type, category, date, description) is defined once in a shared Zod module, imported by client forms, server actions, and tests. This is the single source of truth for what constitutes a valid transaction entry. The schema must enforce FR-T2 (amount bounds and precision), FR-T3 (category must exist and match type and be non-archived), FR-T4 (date defaults to today in IST and respects bounds), and FR-T5 (description trimmed, max 500 chars). No validation rules appear only in the UI or only in the Server Action — the server always re-validates per §8.2.

## Acceptance criteria

- [ ] AC1 — `lib/validation/transactionSchema.ts` exports `createTransactionSchema(categoryService)` that returns a Zod object with fields: `type` (enum INCOME|EXPENSE), `amount` (coerced string/number → Decimal), `categoryId` (cuid), `occurredOn` (ISO string or Date), `description` (optional string, nullable)
- [ ] AC2 — Amount coercion accepts strings with commas, spaces, ₹ prefix, and leading zeros; rejects scientific notation (1e5), negative, zero, and values with >2 decimal places or exceeding ₹99,99,99,999.99
- [ ] AC3 — Amount validation error is exactly "Enter an amount greater than 0" for any invalid amount
- [ ] AC4 — `categoryId` validates that the ID exists, belongs to a category whose type matches the transaction type, and is not archived; error is exactly "Select a category" for all failures
- [ ] AC5 — `occurredOn` coerces strings and Date objects to ISO date strings (YYYY-MM-DD), defaults to today in IST (computed fresh on each call), rejects dates before 2000-01-01 and after today + 1 year; error is "Enter a valid date"
- [ ] AC6 — `description` is optional (undefined or null), trimmed on both ends, rejected if >500 chars after trim; error is "Description is too long (max 500)"
- [ ] AC7 — The schema's `parse()` method returns a plain object with `type`, `amount` (as a Decimal string, never a number), `categoryId`, `occurredOn` (YYYY-MM-DD string), and optional `description`
- [ ] AC8 — Discriminated union: calling the schema with type INCOME and an EXPENSE-type categoryId fails validation; same for EXPENSE

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Amount = 0 | Rejected; error "Enter an amount greater than 0" |
| E2 | Amount = -1 | Rejected; error "Enter an amount greater than 0" |
| E3 | Amount = 0.001 (3 dp) | Rejected; error "Enter an amount greater than 0" (too many decimal places also fails) |
| E4 | Amount = 0.01 (2 dp) | Accepted; stored as "0.01" (string) |
| E5 | Amount = 99999999999.99 (max) | Accepted; stored exactly as "99999999999.99" |
| E6 | Amount = 100000000000.00 (exceeds max) | Rejected; error "Enter an amount greater than 0" |
| E7 | Amount = "1,000.50" (comma) | Coerced to "1000.50"; accepted |
| E8 | Amount = "1 000.50" (space) | Coerced to "1000.50"; accepted |
| E9 | Amount = "₹500" (₹ symbol) | Coerced to "500"; accepted |
| E10 | Amount = "1e5" (scientific notation) | Rejected; error "Enter an amount greater than 0" |
| E11 | occurredOn not provided | Defaults to today in IST; must not default to UTC today |
| E12 | occurredOn = "1999-12-31" | Rejected; error "Enter a valid date" |
| E13 | occurredOn = "2000-01-01" | Accepted |
| E14 | occurredOn = today + 1 year | Accepted (future dates allowed, though UI will warn per A7) |
| E15 | occurredOn = today + 1 year + 1 day | Rejected; error "Enter a valid date" |
| E16 | occurredOn submitted at 23:50 IST on a date boundary | Must record the IST date, not the UTC date (critical: test in IST timezone) |
| E17 | description = "" (empty string) | Accepted as optional; equivalent to undefined or null |
| E18 | description = "   " (whitespace only) | Trimmed to "", accepted as equivalent to null/undefined |
| E19 | description = 500 chars exactly | Accepted |
| E20 | description = 501 chars | Rejected; error "Description is too long (max 500)" |
| E21 | description contains `"`, `,`, newlines, `<tag>` | Accepted as-is (no HTML sanitization at validation layer; escaping happens at serialization) |
| E22 | description = 500 chars of multi-byte UTF-8 (e.g. Urdu script) | Accepted; character count, not byte count, is enforced |
| E23 | categoryId does not exist in database | Rejected; error "Select a category" |
| E24 | categoryId exists but isArchived = true | Rejected; error "Select a category" |
| E25 | categoryId exists, non-archived, but type MISMATCH (type=INCOME, categoryId→EXPENSE category) | Rejected; error "Select a category" |
| E26 | type = INCOME, categoryId → INCOME category, non-archived | Accepted |
| E27 | Validation receives undefined categoryId | Rejected; error "Select a category" |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | unit | `transactionSchema › amount › accepts 0.01` | Schema parses `{ amount: "0.01" }` and returns `{ amount: "0.01" }` (string) |
| T2 | unit | `transactionSchema › amount › rejects 0` | Schema rejects `{ amount: 0 }` with error "Enter an amount greater than 0" |
| T3 | unit | `transactionSchema › amount › rejects -1` | Schema rejects `{ amount: "-1" }` with error "Enter an amount greater than 0" |
| T4 | unit | `transactionSchema › amount › rejects 0.001` | Schema rejects `{ amount: "0.001" }` with error "Enter an amount greater than 0" |
| T5 | unit | `transactionSchema › amount › accepts 99999999999.99` | Schema parses `{ amount: "99999999999.99" }` and returns exact string |
| T6 | unit | `transactionSchema › amount › rejects 100000000000.00` | Schema rejects with error "Enter an amount greater than 0" |
| T7 | unit | `transactionSchema › amount › coerces comma-separated string` | Schema parses `{ amount: "1,000.50" }` and returns `{ amount: "1000.50" }` |
| T8 | unit | `transactionSchema › amount › coerces space-separated string` | Schema parses `{ amount: "1 000.50" }` and returns `{ amount: "1000.50" }` |
| T9 | unit | `transactionSchema › amount › coerces ₹ prefix` | Schema parses `{ amount: "₹500" }` and returns `{ amount: "500" }` |
| T10 | unit | `transactionSchema › amount › rejects scientific notation` | Schema rejects `{ amount: "1e5" }` with error "Enter an amount greater than 0" |
| T11 | unit | `transactionSchema › occurredOn › defaults to today IST` | Schema with no occurredOn returns today's date in IST (YYYY-MM-DD) |
| T12 | unit | `transactionSchema › occurredOn › rejects 1999-12-31` | Schema rejects `{ occurredOn: "1999-12-31" }` with error "Enter a valid date" |
| T13 | unit | `transactionSchema › occurredOn › accepts 2000-01-01` | Schema parses `{ occurredOn: "2000-01-01" }` successfully |
| T14 | unit | `transactionSchema › occurredOn › accepts today + 1 year` | Schema parses `{ occurredOn: (today+1yr).toISOString() }` successfully |
| T15 | unit | `transactionSchema › occurredOn › rejects today + 1 year + 1 day` | Schema rejects with error "Enter a valid date" |
| T16 | unit | `transactionSchema › occurredOn › date boundary at 23:50 IST uses IST date` | Entry at 23:50 IST on 2026-08-19 defaults to 2026-08-19 (not 2026-08-20 UTC) |
| T17 | unit | `transactionSchema › description › accepts empty string` | Schema parses `{ description: "" }` successfully |
| T18 | unit | `transactionSchema › description › trims whitespace-only` | Schema parses `{ description: "   " }` and returns null or empty string |
| T19 | unit | `transactionSchema › description › accepts 500 chars` | Schema parses 500-char description successfully |
| T20 | unit | `transactionSchema › description › rejects 501 chars` | Schema rejects with error "Description is too long (max 500)" |
| T21 | unit | `transactionSchema › description › preserves special chars` | Schema parses `{ description: "Cost: ₹50, \"urgent\"\n<note>" }` as-is (no sanitization) |
| T22 | unit | `transactionSchema › description › counts UTF-8 characters correctly` | 500 Urdu characters are accepted; 501 are rejected |
| T23 | integration | `transactionSchema › categoryId › rejects non-existent ID` | Schema rejects categoryId "nonexistent" with error "Select a category" |
| T24 | integration | `transactionSchema › categoryId › rejects archived category` | Seed archived INCOME category; schema rejects its ID with error "Select a category" |
| T25 | integration | `transactionSchema › categoryId › rejects mismatched type (INCOME tx, EXPENSE cat)` | Seed EXPENSE category; schema with type=INCOME and that categoryId rejects with error "Select a category" |
| T26 | integration | `transactionSchema › categoryId › accepts valid non-archived category of correct type` | Seed non-archived INCOME category; schema with type=INCOME accepts its ID |
| T27 | integration | `transactionSchema › discriminator › INCOME type with EXPENSE categoryId fails` | Schema rejects (type=INCOME, categoryId→EXPENSE) with error "Select a category" |
| T28 | integration | `transactionSchema › discriminator › EXPENSE type with INCOME categoryId fails` | Schema rejects (type=EXPENSE, categoryId→INCOME) with error "Select a category" |
| T29 | integration | `transactionSchema › type › required and accepts INCOME` | Schema with type=INCOME and valid fields parses successfully |
| T30 | integration | `transactionSchema › type › required and accepts EXPENSE` | Schema with type=EXPENSE and valid fields parses successfully |

**Red gate:** Every test above is written and failing. Commit the failing tests before implementing the schema.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**File to create:** `lib/validation/transactionSchema.ts`

**Approach:**
- Export a factory function `createTransactionSchema(categoryRepository: any)` that returns a Zod object schema.
- The schema must be a Zod object with discriminated union by type (INCOME or EXPENSE) so that categoryId validation knows which categories are valid for that type.
- Use Zod's `coerce` and `preprocess` for amount coercion (strip commas, spaces, ₹, parse as number, validate bounds and precision).
- For `occurredOn`, default to `new Date()` formatted as ISO date string in IST timezone using `date-fns` and `@date-fns/tz`.
- For `description`, use `trim()` and min/max length.
- For `categoryId`, call `categoryRepository.findById(id)` to check existence, type match, and `isArchived` status. Import the category repository (or mock it in tests with dependency injection).
- Return exact error messages per §7 and AC above.
- Amounts must be **strings**, not numbers, in the return type.

**Repository method needed:** Assume `AITJ-M2-01` provides `categoryRepository.findById(id)` or similar; this schema will call it to validate categoryId and type match.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present (client validation alone is never sufficient — §7)
- [ ] Amount returned as Decimal string, never JS number
- [ ] Every test that checks a decimal value asserts an exact string equality, never float comparison
- [ ] IST timezone test passes (not UTC)
- [ ] `deletedAt` filter note: this schema validates, not filters; filtering is in the repository (M3-02)
- [ ] No N+1 queries — categoryId validation calls repository once per validation
- [ ] No unused variables or dead code
- [ ] No secrets, amounts, passwords in logs (NFR-8)
- [ ] Reviewed by review-agent
