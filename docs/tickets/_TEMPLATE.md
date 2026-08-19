# <TICKET-ID> — <Imperative title, max 70 chars>

| Field | Value |
|---|---|
| Milestone | M<n> — <name> |
| Depends on | <TICKET-IDs, or "none"> |
| Blocks | <TICKET-IDs, or "none"> |
| PRD refs | <exact FR/NFR/A/§ IDs, comma separated> |
| Est. | <0.5 / 1 / 1.5 / 2 days> |
| Phase | 🔴 RED |

## Context

<2–4 sentences. Why this exists, quoting the PRD requirement it satisfies. No invention: every claim traces to a PRD ref above.>

## Acceptance criteria

- [ ] AC1 — <observable, testable statement>
- [ ] AC2 — …

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | <boundary / adversarial / empty / concurrent input> | <exact expected outcome> |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | unit \| integration \| e2e | `<describe > it>` | <exact assertion> |

**Red gate:** every test above is written and failing for the right reason (assertion failure or missing module — never a syntax error or a typo in the import path). Commit the failing tests before writing implementation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged. Tests are not edited to fit the implementation.
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.
- [ ] No test is skipped, `.only`, or commented out.

## Implementation notes

<Files to create/modify, layer per §8.2, and the specific approach. Name the repository method, the Zod schema, the Server Action.>

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Server-side validation present (client validation alone is never sufficient — §7)
- [ ] Every read filters `deletedAt: null` via the repository layer (§6.1)
- [ ] Mutation is atomic with its audit entry (NFR-2), if it mutates
- [ ] Session asserted via `authedAction` (§8.2), if it is an action
- [ ] No N+1 queries — verified by query count or `include`/`select` inspection
- [ ] No unused variables, imports, or dead code
- [ ] No secrets, amounts, passwords, or tokens in logs (NFR-8)
- [ ] Responsive at 360px, tap targets ≥44px (NFR-3)
- [ ] Keyboard accessible, labelled controls, 4.5:1 contrast (NFR-4)
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
