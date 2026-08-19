# Development workflow — AITJ Ledger

Every ticket passes through three agents in a fixed order. No ticket reaches deployment without all three signing off.

```
                  ┌──────────────────────────────────────┐
                  │                                      │
   ticket ──▶ dev-agent ──▶ review-agent ──▶ qa-agent ──▶ done
   (🔴 RED)       │  ▲            │  │           │  │
                  │  └── REJECT ──┘  │           │  │
                  │      (fix, then re-review)   │  │
                  └──────── FAIL ────────────────┘  │
                                                    │
                           ticket amendment ◀───────┘
```

## The three agents

| Agent | Model | Asks | Authority |
|---|---|---|---|
| `dev-agent` | Sonnet | "Does this ticket's test plan pass, built to the standards?" | Writes code and tests. Cannot approve its own work. |
| `review-agent` | Sonnet | "Is this built correctly — no leaks, no N+1, TDD honoured?" | **Rejects** and sends back to dev. Read-only on source. |
| `qa-agent` | Sonnet | "Does it do what the ticket promised, and is the system still coherent?" | **Fails** back to dev, or asks for a ticket amendment. Signs off for deploy. |

The separation is deliberate: the author of code is the worst judge of it. review-agent reads the diff, qa-agent exercises the running app — different questions, so they catch different defects.

## Running the pipeline

```
Use the dev-agent to implement AITJ-M3-04.
Use the review-agent to review AITJ-M3-04.
Use the dev-agent to fix the blocking items review-agent raised on AITJ-M3-04.
Use the review-agent to re-review AITJ-M3-04.        # repeat until PASS
Use the qa-agent to QA AITJ-M3-04.
```

Rules:
- **One ticket at a time per agent.** A ticket is the unit of review; batching them defeats the gate.
- **Every fix round gets a full re-review**, not a spot check of the fixed lines — fixes routinely break something adjacent.
- **Rounds do not lower the bar.** Round three is reviewed as strictly as round one. If a defect survives three rounds, review-agent says so explicitly rather than passing to get unstuck.
- **qa-agent runs only after review-agent PASSes.** Reviewing code that is still moving wastes the deepest stage.

## The red/green cycle

The `Phase` field in each ticket tracks state:

| Phase | Meaning |
|---|---|
| 🔴 RED | Tests written and failing correctly. No implementation yet. Failing tests are committed. |
| 🟢 GREEN | Every test passes unchanged, and the whole Definition of Done is satisfied. |

A ticket moves 🔴 → 🟢 only when dev-agent has completed the full green checklist. review-agent and qa-agent verify the transition was earned — the most common way to fake it is to weaken a test, so both stages check the tests against the ticket as written.

**The red gate matters more than it looks.** A test that passes before implementation is not testing what it claims, and it will keep passing when the feature later breaks. Committing the failing tests first is what makes the suite trustworthy.

## Order of work

Follow the milestone order — M0 → M8 — and within a milestone respect each ticket's `Depends on`. The dependency graph is real: it exists because building on a 🔴 dependency means building against an interface that does not exist.

Three cross-milestone dependencies are worth knowing:

- `AITJ-M5-01` (the IST period engine) blocks `AITJ-M4-04` (the list's date filters) and all of M6. It is pure, self-contained logic — building it early, ahead of its milestone, removes the awkwardest ordering constraint in the plan.
- `AITJ-M5-02` (aggregation) is extended by M6, not reimplemented. §8.3 requires the dashboard, list header and reports to share it.
- `AITJ-M7-04` (masjid name) feeds the print header in `AITJ-M6-06`, which falls back to "AITJ Ledger" (A11) if M7 lands later.

M1–M3 together form the vertical slice worth demonstrating to the client early (§14).

## What gets a ticket rejected

The rules below are drawn from the PRD and are not matters of taste. review-agent rejects on any of them.

**Data leaks** — `passwordHash` or `tokenHash` anywhere the client can reach (including a Server Component prop, which is serialized to the browser); a user query without an explicit `select`; auth errors that reveal whether an email exists; secrets in code or in the bundle; amounts, passwords or tokens in logs.

**Performance** — an N+1 query; aggregation in Node instead of SQL `SUM`; pagination by fetching everything and slicing; a query that cannot use the §6 indexes without justification; shipping thousands of rows to the browser for a chart to aggregate.

**Correctness** — a read that skips the `deletedAt: null` filter, or a Prisma call outside the repository layer; a mutation not atomic with its audit entry; `Transaction.type` disagreeing with `Category.type`; money touched as a JS `number`; a period boundary computed outside IST; a Server Action without a session assert; validation on the client only.

**Broken TDD** — a missing test from the plan; a test weakened, skipped, `.only`'d or deleted; a mock standing in for a real Postgres on an invariant that lives in the database; a test that asserts a mock was called rather than a value.

**Scope** — anything invented that is not in the PRD, or anything from §3.2 creeping in.

## Honest reporting

Every agent reports what actually happened. A truthful "three tests still fail, here is the output" is worth far more than a confident claim the next stage disproves in thirty seconds. qa-agent explicitly lists what it could **not** verify.

This matters more than usual here: the product is a masjid committee's financial record, and a defect that reaches production corrupts real money data that people are accountable for.
