# AITJ-M3-04 — Build createTransaction Server Action with type and category invariants

| Field | Value |
|---|---|
| Milestone | M3 — Transactions |
| Depends on | AITJ-M0-03, AITJ-M0-04, AITJ-M1-01, AITJ-M2-01, AITJ-M3-01, AITJ-M3-02, AITJ-M3-03 |
| Blocks | AITJ-M3-05, AITJ-M3-06 |
| PRD refs | FR-T1, FR-T2, FR-T3, FR-T4, FR-T5, §8.2, NFR-2, NFR-8 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

The `createTransaction` Server Action follows the five-step pattern (§8.2): assert session → parse with Zod → call repository inside a transaction → write audit entry in that same transaction → revalidatePath. It enforces the critical invariant that `type` must always agree with `category.type` at both the application and database layers. The action is protected by the `authedAction` wrapper, so unauthenticated calls are rejected before any validation. On success, the action returns the created transaction; any error is handled by the client (rolled back implicitly, no UI update).

## Acceptance criteria

- [ ] AC1 — Export `createTransaction(input: unknown)` as a Server Action in `app/actions/transactions.ts` using the `authedAction` wrapper
- [ ] AC2 — The action asserts a valid session via `authedAction`; unauthenticated calls throw a 401 error and do NOT reach the validation step
- [ ] AC3 — The action parses the input using the Zod schema from `lib/validation/transactionSchema.ts` (created in M3-01)
- [ ] AC4 — The action calls `transactionRepository.create(parsed, userId)` inside a Prisma transaction block
- [ ] AC5 — Inside the same transaction, the action calls `recordAudit()` with action=CREATE
- [ ] AC6 — After the transaction commits, the action calls `revalidatePath("/income")` and `revalidatePath("/expenses")` to invalidate caches (or all transaction-related paths)
- [ ] AC7 — On success, the action returns `{ success: true, data: createdTransaction }`
- [ ] AC8 — On validation error (from Zod), returns `{ success: false, error: "Validation error", details: { field: "message" } }`
- [ ] AC9 — On database error (e.g., category does not exist, onDelete: Restrict violation), returns `{ success: false, error: "Failed to create transaction" }` without revealing the internal error to the client
- [ ] AC10 — The action enforces the invariant: `transaction.type` must equal `category.type`. If they do not match, the action returns error even if Zod passed (defense in depth; should not happen if Zod works)
- [ ] AC11 — No amounts, user IDs, or sensitive data are logged; only the action name and success/failure are logged (NFR-8)
- [ ] AC12 — The response never includes the audit entry details, only the created transaction

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Unauthenticated POST to createTransaction | authedAction rejects with 401; no parsing, no DB call |
| E2 | Valid input, but category ID does not exist | Zod validation fails with "Select a category"; no DB mutation |
| E3 | Valid input, category exists but isArchived=true | Zod validation fails with "Select a category"; no DB mutation |
| E4 | Valid input, category exists, non-archived, but category.type ≠ transaction.type | Zod validation fails (discriminated union); error "Select a category" |
| E5 | All validations pass, but `userId` from session is stale (user was deactivated) | onDelete: Restrict on the createdBy relation; insert fails; action returns error |
| E6 | All validations pass, Prisma transaction succeeds, but audit write fails (permission denied) | Entire transaction rolls back; row is NOT persisted; action returns error |
| E7 | Amount = 0.10 + 0.20 precision edge case | Zod coerces and validates; repository stores decimal exactly; audit before/after captures exact string |
| E8 | Description = "Cost: ₹50, \"urgent\"\n<note>" | Stored as-is; no sanitization in action (sanitization/escaping is at serialization boundary) |
| E9 | Valid input submitted twice rapidly | Both create independently; no deduplication (idempotent key not required per PRD) |
| E10 | Concurrent creates by two users to the same category | Both succeed; no race condition (no pessimistic locking needed) |
| E11 | Date is today + 1 year + 1 day (exceeds max) | Zod validation fails; error "Enter a valid date" |
| E12 | Date is submitted at 23:50 IST on boundary; timezone is UTC-5 (user in US, IST is UTC+5:30) | Zod defaults to today IST regardless of client timezone (using server-side date-fns + @date-fns/tz) |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `createTransaction › unauthenticated call` | Call without session; throws or returns error with 401-like status |
| T2 | integration | `createTransaction › valid input › creates transaction` | Call with valid input; transaction is persisted in DB; findById returns the row |
| T3 | integration | `createTransaction › valid input › returns success true` | Response is `{ success: true, data: {...} }` |
| T4 | integration | `createTransaction › valid input › response includes id, type, amount, categoryId, occurredOn, description` | Returned data matches input (excluding server-set fields) |
| T5 | integration | `createTransaction › valid input › writes audit entry` | After create, auditLog has action=CREATE, after contains the transaction data |
| T6 | integration | `createTransaction › valid input › audit entry and transaction are atomic` | If audit write fails inside the transaction, the transaction row is NOT persisted |
| T7 | integration | `createTransaction › validation error › amount = 0` | Returns `{ success: false, error, details: { amount: "..." } }` or similar; no DB mutation |
| T8 | integration | `createTransaction › validation error › amount = 0.001` | Rejected; error details include amount |
| T9 | integration | `createTransaction › validation error › category does not exist` | Returns error with "Select a category"; no mutation |
| T10 | integration | `createTransaction › validation error › category is archived` | Returns error with "Select a category"; no mutation |
| T11 | integration | `createTransaction › validation error › type INCOME, categoryId → EXPENSE category` | Zod discriminator rejects; error "Select a category" |
| T12 | integration | `createTransaction › validation error › date = 1999-12-31` | Rejected with "Enter a valid date"; no mutation |
| T13 | integration | `createTransaction › validation error › description = 501 chars` | Rejected with "Description is too long"; no mutation |
| T14 | integration | `createTransaction › type invariant › (defense in depth) transaction.type matches category.type after DB check` | After successful create, verify in DB that type equals category.type |
| T15 | integration | `createTransaction › createdById › set to session userId` | After create, transaction.createdById equals the authenticated user's ID |
| T16 | integration | `createTransaction › amount precision › 0.1 + 0.2 stored exactly` | Create with amount "0.1", then "0.2"; both stored as exact Decimal strings in DB |
| T17 | integration | `createTransaction › amount precision › 1234567.89 survives round-trip` | Create with amount "1234567.89"; findById returns exact string |
| T18 | integration | `createTransaction › amount is Decimal string in response` | Response data.amount is a string (e.g. "1000.50"), not a number |
| T19 | e2e | `createTransaction › E2E Income page › submit form› success toast appears` | Fill form, click submit; toast shows; form clears |
| T20 | e2e | `createTransaction › E2E Expenses page › submit form › success toast appears` | Fill form, click submit; toast shows; form clears |
| T21 | e2e | `createTransaction › E2E form keeps date after clear` | Fill form with amount, category, date, description; submit; date field still shows the same date; other fields cleared |

**Red gate:** Every test above is written and failing. Commit the failing tests before implementing the action.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

**File to create:** `actions/transactions.ts` (or `app/actions/transactions.ts` depending on project layout from M0)

**Function signature:**
```typescript
export const createTransaction = authedAction(
  async (input: unknown, { session }) => {
    // 1. Parse with Zod
    const parsed = createTransactionSchema(categoryRepository).parse(input);
    
    // 2. Wrap in Prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      // 3. Create transaction
      const created = await transactionRepository.create(parsed, session.userId);
      
      // 4. Write audit (inside same tx)
      await recordAudit(tx, "Transaction", created.id, "CREATE", session.userId, undefined, {
        id: created.id,
        type: created.type,
        amount: created.amount.toString(),
        categoryId: created.categoryId,
        occurredOn: created.occurredOn.toISOString(),
        description: created.description,
        createdById: created.createdById,
      });
      
      return created;
    });
    
    // 5. Revalidate paths
    revalidatePath("/income");
    revalidatePath("/expenses");
    
    return { success: true, data: result };
  }
);
```

**Error handling:**
- Zod errors: catch and return details in a user-friendly format.
- Database errors: catch and return a generic "Failed to create transaction" without exposing internal error.
- Never log amounts or user data (NFR-8).

**Return type:** Define a union type like:
```typescript
type CreateTransactionResponse = 
  | { success: true; data: Transaction }
  | { success: false; error: string; details?: Record<string, string> };
```

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation and mutation logic in place
- [ ] authedAction wrapper used (session asserted, no unauthenticated calls)
- [ ] Mutation and audit entry atomic (Prisma transaction block)
- [ ] Revalidation paths correct (invalidates Income, Expenses caches)
- [ ] Type/category invariant enforced and tested
- [ ] Error messages user-friendly, no internal details exposed
- [ ] No amounts, passwords, or user IDs in logs (NFR-8)
- [ ] Response never includes audit entry or secrets
- [ ] E2E tests pass at 360px and desktop viewports
- [ ] Reviewed by review-agent
