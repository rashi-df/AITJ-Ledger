# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What This Project Is

**AITJ Ledger** — a private, single-masjid income & expense register replacing a paper cash book. One user type (Committee User), no role hierarchy. It is a *digital register*, not an accounting system.

The authoritative spec is `docs/PRD.md` (Approved, 19 Aug 2026). Tickets derived from it live in `docs/tickets/` — start at `docs/tickets/README.md`.

**Never invent a requirement.** If it is not in the PRD, it is not in scope. PRD §3.2 lists what is explicitly excluded: payment methods, roles, multi-masjid, double-entry, donor management, Zakat calculation, historical import, public site, native app.

## Tech Stack (Locked — No Substitutions)

- **Framework**: Next.js 15 (App Router) — Server Components for reads, Server Actions for mutations. No separate API layer.
- **Language**: TypeScript `strict: true`
- **Database**: PostgreSQL 16 — `DECIMAL(14,2)` for money, `DATE` for transaction dates, SQL `SUM` for all aggregation
- **ORM**: Prisma — migrations are the schema source of truth
- **Validation**: Zod — one schema module shared by form, action, and tests
- **Auth**: Auth.js v5 (NextAuth), Credentials provider, JWT sessions
- **UI**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts (client component, server-computed payload)
- **Table**: TanStack Table via shadcn data-table (sorting/pagination server-side)
- **URL state**: nuqs
- **Dates**: date-fns + `@date-fns/tz` — all period maths in `Asia/Kolkata`
- **Tests**: Vitest (unit/integration) + Testcontainers (real Postgres) + Playwright (E2E)
- **Quality**: ESLint, Prettier, `tsc --noEmit`, Husky pre-commit

## All Commands Run Inside Docker

**Never run node, pnpm, prisma, vitest, or playwright on the host.** Use `make <target>` — it executes inside the `app` container.

```bash
make up          # Start stack (app + postgres)
make down        # Stop stack
make shell       # Bash into app container
make migrate     # Run Prisma migrations
make fresh       # Drop + migrate + seed
make seed        # Seed categories + admin
make test        # Full suite (unit + integration)
make test-unit   # Vitest unit only
make test-e2e    # Playwright
make typecheck   # tsc --noEmit
make lint        # ESLint + Prettier check
make ci          # typecheck + lint + test
make psql        # psql shell (DB: aitj)
make logs / make ps
```

Run one test:
```bash
docker compose exec app pnpm vitest run path/to/file.test.ts
docker compose exec app pnpm playwright test --grep "delete transaction"
```

> The Makefile and compose files are both created by `AITJ-M0-05`. Until it is GREEN these targets do not exist, so `AITJ-M0-02` through `AITJ-M0-04` necessarily run their tooling on the host.

## Architecture Rules (Hard Rules — Review Rejects on Violation)

**All data access lives in `lib/repositories/`.** No Prisma call in an action, a component, or a route handler. A `grep` for Prisma outside the repository layer is a review rejection.

**Every read filters `deletedAt: null`** — centralized in the repository, never repeated at call sites (PRD §6.1). The one exception is the deleted-transactions view (M7), which must be a separately-named explicit method, never an optional flag.

**Zero N+1.** Any list showing a relation uses one query with `include`/`select`, or one grouped aggregate. A loop containing `await` on a query is an N+1 — restructure it. Tests assert query counts.

**Aggregation happens in PostgreSQL.** `SUM`/`COUNT` in SQL, never rows pulled into Node and added (§8.3). Any `reduce`/`+=` over amounts is a violation. The dashboard (FR-D2), list header (FR-L9), and reports (FR-R2) share the same repository functions so they cannot disagree.

**Money never becomes a JS `number`.** `Decimal(14,2)` end to end; convert to string at the serialization boundary; format with `Intl.NumberFormat('en-IN')`. Tests assert exact decimal strings, never float equality. Amounts are always positive — direction is `type` (A10).

**All period boundaries in `Asia/Kolkata`** (A2), computed from an injected reference instant so `lib/period/` stays pure. Never call the clock inside a period function. Week starts Monday (A3). "This Year" is the calendar year (A4).

**`Transaction.type` must always equal `Category.type`** — enforced in the action AND by a DB check constraint.

**Every Server Action follows five steps**: assert session via `authedAction` → parse with Zod → repository call inside a DB transaction → write the audit entry in that *same* transaction → `revalidatePath`. An action without the session assert is a security defect. Mutation and audit commit together or not at all (NFR-2).

**Data protection.** `passwordHash` and `tokenHash` never leave the repository layer — not in a Server Action return, not in a Server Component prop (**these serialize to the browser**), not in a log line, not in an audit `before`/`after` snapshot, not in an error message. Use explicit `select` on every User query. Auth errors are generic and constant-time — never reveal whether an email exists. bcrypt cost 12; invite tokens stored hashed, single-use, 72h.

**Validation is server-side.** Client Zod is convenience only; the server always re-validates.

**Cleanliness.** No unused variables, imports, or dead code. No `any`, no `@ts-ignore`, no non-null assertion dodging a real nullable. Match surrounding style — do not introduce a second pattern for something the codebase already does one way.

## Three-Agent Pipeline

```
ticket (🔴 RED) ──▶ dev-agent ──▶ review-agent ──▶ qa-agent ──▶ done (🟢 GREEN)
                        ▲   │           │  │
                        └───┴─ REJECT ──┘  │
                        └──────── FAIL ────┘
```

**Model tiers:** Opus plans, Sonnet executes, Haiku documents.

| Tier | Used for |
|---|---|
| **Opus** | Planning & advisory only — architecture decisions, PRD analysis, milestone scope, ticket amendments. Runs in the main session, not as a pipeline agent. |
| **Sonnet** | All execution — code, tests, review, QA, CI. |
| **Haiku** | Documentation & bookkeeping — ticket phase flips 🔴→🟢, checklist ticks, handover docs. No reasoning work. |

| Agent | Model | Purpose |
|---|---|---|
| `dev-agent` | Sonnet | TDD implementation: RED tests first, then GREEN |
| `review-agent` | Sonnet | Rejects on data leaks, N+1, perf, broken TDD, PRD drift. Read-only. |
| `qa-agent` | Sonnet | Runs the ticket's tests, verifies ACs + edge cases + cross-ticket consistency, signs off. Read-only. |

Specs in `.claude/agents/`. Full rules in `docs/tickets/_WORKFLOW.md`.

- One ticket at a time. Every fix round gets a **full** re-review, not a spot check.
- `qa-agent` runs only after `review-agent` PASSes.
- **No agent marks a ticket 🟢 GREEN without qa-agent sign-off.**

```
Use the dev-agent to implement AITJ-M0-03.
Use the review-agent to review AITJ-M0-03.
Use the qa-agent to QA AITJ-M0-03.
```

## TDD — Red then Green (Non-Negotiable)

1. **🔴 RED** — write every test in the ticket's test plan. They must fail for the *right* reason (assertion failure or missing module — never a syntax error or bad import path). Commit failing tests first. A test that passes before implementation is a broken test.
2. **🟢 GREEN** — implement until every test passes **unchanged**. Never weaken, skip, `.only`, or delete a test to get a pass. If a test is genuinely wrong, say so explicitly, fix it, and re-run the red gate before implementing.

Integration tests run against **real Postgres**, never a mock — `deletedAt` filtering, `onDelete: Restrict`, the type check constraint, and decimal precision all live in the database, and a mock will happily confirm a bug.

## Token Discipline

This project is billed per token. Efficiency is a hard requirement, not a preference.

**Use the code-review-graph MCP tools before Grep/Glob/Read** (see below). The graph returns structural context for a fraction of the tokens of file scanning.

**Do not re-read what you already have.** The PRD is ~33KB and tickets are 5–15KB each — read the *specific* ticket and only the PRD sections its `PRD refs` field names. Never read the whole PRD to answer a narrow question. Never re-read a file you just edited to verify; Edit/Write errors if it failed.

**One ticket per agent invocation.** Do not batch tickets into one context.

**Prefer targeted reads**: `sed -n '120,180p'`, `grep -n`, `head`. Reserve full-file reads for files under ~200 lines.

**Do not dump command output into context.** Pipe through `head`, `wc -l`, or `grep`. A full `pnpm test` log is thousands of wasted tokens — assert on the summary line.

**Subagents keep tool output out of the main context** — use them for broad searches, and take the conclusion rather than the file dumps.

**Do not spawn agents for ticket authoring again.** The 59 tickets are written. Amend them in place with a targeted edit.

**Do not restate the plan before acting, or summarize what you just did at length.** Act, then report briefly.

## MCP Tools: code-review-graph

**This project has a knowledge graph. ALWAYS use the code-review-graph MCP tools BEFORE Grep/Glob/Read to explore the codebase.** It is faster, cheaper, and gives structural context (callers, dependents, test coverage) that file scanning cannot.

| Tool | Use when |
|---|---|
| `detect_changes` | Reviewing changes — risk-scored analysis. **review-agent starts here.** |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Blast radius of a change |
| `get_affected_flows` | Which execution paths are impacted |
| `query_graph` | Trace callers/callees/imports/tests (`pattern="tests_for"` checks coverage) |
| `semantic_search_nodes` | Find a function/component by name or keyword |
| `get_architecture_overview` | High-level structure |
| `refactor_tool` | Plan renames, find dead code |

Fall back to Grep/Glob/Read **only** where the graph does not cover what you need.

**Review workflow:** `detect_changes` → `get_review_context` for the risky nodes → `query_graph pattern="tests_for"` to confirm coverage → `get_impact_radius` before approving anything touching the repository or period layers.

## Layout (PRD §8.2)

```
app/          (auth)/login, invite/[token] · (app)/dashboard, income, expenses,
              transactions, reports, categories, settings · api/ (auth, CSV)
components/   ui/ (shadcn) + feature components
lib/          auth/ · db/ · repositories/ · validation/ · period/ · format/
actions/      Server Actions
prisma/       schema.prisma, migrations/, seed.ts
docs/         PRD.md · tickets/
```

## Git Conventions

- Not yet a git repo — `git init` before M0.
- Branch per ticket: `aitj-m<n>-<nn>-short-description`. Never commit to `main` directly.
- Commit the 🔴 RED failing tests before the GREEN implementation — the two-commit shape is the evidence the cycle was followed.
- Never commit a secret. All config via env (NFR-5): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `NODE_ENV`, `TZ=Asia/Kolkata`.

## Key Constraints (PRD §4 — client-confirmed)

| | |
|---|---|
| Currency | INR ₹, `en-IN` — note Indian 2,2,3 grouping (`₹1,50,000.00`), not 3,3,3 |
| Timezone | Asia/Kolkata, year-round, no DST |
| Week | Monday–Sunday · **Year** 1 Jan – 31 Dec |
| Amounts | `DECIMAL(14,2)`, always positive, max `99999999999.99` |
| Masjid name | Defaults to "AITJ Ledger", editable in Settings |
| Launch state | Empty ledger, one seeded admin, invite flow ships |
| Backups | **Manual only** (client decision) — data loss bounded by time since last `pg_dump` |
