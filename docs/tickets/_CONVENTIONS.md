# Ticket authoring conventions — AITJ Ledger

Binding rules for anyone (human or agent) writing or amending a ticket.

## Identity

- ID format: `AITJ-M<milestone>-<nn>` — e.g. `AITJ-M3-04`. Two digits, zero-padded, sequential within the milestone.
- Filename: `<ID>-<kebab-title>.md` in `docs/tickets/`.
- One ticket = one vertical, independently testable slice. If a ticket cannot be demonstrated on its own, it is too small; if it needs more than ~2 days, split it.

## Grounding — the hard rule

**Every requirement in a ticket must trace to a PRD ID.** The `PRD refs` field is not decoration. If a behaviour is not in `docs/PRD.md`, it does not go in a ticket. Do not invent:

- fields not in the §6 Prisma schema,
- validation rules not in the §7 table,
- libraries not in the §8.1 stack,
- routes not in the §10 page table,
- anything listed in §3.2 (out of scope) — notably: no payment method, no roles beyond the single Committee User, no historical import, no multi-masjid.

If the PRD is genuinely silent on something a ticket needs, add it under a `## Open question` heading in that ticket rather than inventing an answer.

## Fixed decisions (from §4, all client-confirmed)

| | |
|---|---|
| Currency | INR ₹, `en-IN`, e.g. `₹1,50,000.00` (A1) |
| Timezone | Asia/Kolkata; all period boundaries in IST (A2) |
| Week | Monday–Sunday (A3) |
| "This Year" | Calendar year, 1 Jan – 31 Dec (A4) |
| Dates | `DATE`, no time component (A5) |
| Amounts | `DECIMAL(14,2)`, never JS `number` in summation (A6, §6.1) |
| Amount sign | Always positive; direction is `type` (A10) |
| Masjid name | Defaults to "AITJ Ledger", editable in Settings (A11) |
| Data at launch | Empty ledger, no import (A12) |
| Users at launch | One seeded admin; invite flow still ships (§2) |

## TDD — red then green

Every ticket ships in two phases, and the phase is tracked in the ticket header.

1. **🔴 RED.** Write every test in the Test plan. Run them. They must fail *for the right reason* — an assertion failure or an unresolved import, never a syntax error, a wrong path, or a misconfigured runner. Commit the failing tests. A ticket whose tests pass before implementation is a broken ticket: the test is not testing what it claims.
2. **🟢 GREEN.** Implement until every test passes **unchanged**. Editing a test to match the implementation invalidates the cycle — if a test is genuinely wrong, say so explicitly, fix it, and re-run the red gate on the corrected test before implementing.

Update the `Phase` field 🔴 → 🟢 only when the whole GREEN checklist is satisfied.

### What makes a good test here

- Assert **behaviour and values**, not implementation details. `expect(balance).toBe("1500.00")`, not `expect(prisma.transaction.aggregate).toHaveBeenCalled()`.
- Integration tests run against a **real Postgres** (Testcontainers or a disposable compose service), never a mock — the invariants that matter (`deletedAt` filtering, `onDelete: Restrict`, the type/category check constraint, decimal precision) live in the database and a mock will happily lie about all four.
- Every test that touches money asserts an **exact decimal string**, never a float comparison.
- Every list/aggregate test seeds at least one **soft-deleted row** and asserts it is excluded.

## Test levels

| Level | Tool | Use for |
|---|---|---|
| unit | Vitest | Zod schemas at their boundaries, period resolution, formatting, pure logic |
| integration | Vitest + real Postgres | Repository methods, Server Actions, audit atomicity, constraints |
| e2e | Playwright | User flows from §11, at 360px and desktop viewports |

## Edge cases every ticket must consider

Include the ones that apply; state explicitly if one does not.

- **Empty** — no rows, no results, first-run, empty database.
- **Boundary** — 0, 0.01, max `99999999999.99`, 500-char description, 501 chars, 1 Jan / 31 Dec, today+1yr, 1999-12-31.
- **Precision** — amounts that break floats: `0.1 + 0.2`, `1234567.89`, repeated decimals in a SUM.
- **Soft delete** — deleted rows excluded from every list, total, chart, and export (FR-T10).
- **Timezone** — an entry made at 23:50 IST lands on the IST date, not the UTC one (A2/A5).
- **Authorization** — unauthenticated access redirects; every action asserts a session (§8.2).
- **Concurrency** — two users editing the same row; the last-active-user and self-deactivation guards (FR-A9).
- **Archived / restricted** — archived categories hidden from entry but shown on history (FR-C7); in-use category cannot be deleted.
- **Injection / overflow** — quotes and commas in descriptions (CSV escaping), very long inputs, HTML in text fields.

## Performance rules (enforced by review-agent)

- Aggregation is SQL `SUM` in Postgres, never rows fetched into Node and added (§8.3).
- No N+1: every list that shows a relation uses `include`/`select` in one query. Integration tests may assert query counts.
- Pagination is server-side, 25/page (FR-L8). Never fetch the full table to slice it.
- Queries hit the §6 indexes. A new access pattern needs an index or a written justification.

## Security rules (enforced by review-agent)

- `passwordHash` and any token never leave the repository layer — not in a Server Action return, not in a Server Component prop, not in a log line, not in a JSON payload.
- Auth errors are generic; never reveal whether an email exists (FR-A1).
- Invite tokens are stored hashed (`tokenHash`), compared in constant time, single-use, 72h (FR-A6/A7).
- No secret is committed; all config via env (NFR-5).
