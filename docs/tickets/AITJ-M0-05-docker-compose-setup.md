# AITJ-M0-05 — Docker compose for app and PostgreSQL 16, plus the Makefile task runner

| Field | Value |
|---|---|
| Milestone | M0 — Foundation |
| Depends on | AITJ-M0-02 |
| Blocks | AITJ-M0-06, AITJ-M0-07 |
| PRD refs | §12.1, §12.2, NFR-5 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

This ticket creates `docker-compose.yml` with two services: the Next.js app and a PostgreSQL 16 database. Both services must be healthy and communicable. Migrations and seeding run at app startup. Environment variables (§12.2) are passed via `.env.local` (development) or injected at deployment. No secrets are hardcoded (NFR-5).

This ticket also delivers the root `Makefile` — the single documented entry point for every command in this project. `CLAUDE.md` states that node, pnpm, prisma, vitest and playwright are never run on the host: the Makefile is what makes that true, by wrapping each target in `docker compose exec app`. Until this ticket is GREEN those targets do not exist, so tickets AITJ-M0-02 through AITJ-M0-04 necessarily run their tooling on the host.

## Acceptance criteria

- [ ] AC1 — `docker-compose.yml` defines two services: `app` and `db`
- [ ] AC2 — The `db` service uses `postgres:16-alpine` image with a named volume for persistence
- [ ] AC3 — The `db` service has a healthcheck using `pg_isready -U postgres`
- [ ] AC4 — The `app` service builds from a multi-stage Dockerfile with layers: dependencies, build, runner
- [ ] AC5 — The app service runs as a non-root user (e.g., `nextjs`)
- [ ] AC6 — The app service has a healthcheck using `curl http://localhost:3000/api/health` (or similar)
- [ ] AC7 — The app service waits for the `db` service to be healthy before starting
- [ ] AC8 — Environment variables are passed via an `.env.local` file or injected; `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `NODE_ENV`, `TZ` are configurable
- [ ] AC9 — Database migrations run automatically at app startup (`prisma migrate deploy`)
- [ ] AC10 — Database seeding runs automatically at app startup (`node prisma/seed.js` or similar)
- [ ] AC11 — A `docker-compose.dev.yml` override file provides hot reload (e.g., `next dev` instead of `next start`) and exposes the database port for local debugging
- [ ] AC12 — `.dockerignore` excludes node_modules, .next, .git, etc., to reduce image size
- [ ] AC13 — All secrets are sourced from environment variables; no credentials hardcoded in Dockerfile or config
- [ ] AC14 — A `Makefile` exists at the repo root and is the documented entry point for all commands
- [ ] AC15 — The Makefile defines every target named in `CLAUDE.md`: `up`, `down`, `shell`, `migrate`, `fresh`, `seed`, `test`, `test-unit`, `test-e2e`, `typecheck`, `lint`, `ci`, `psql`, `logs`, `ps`
- [ ] AC16 — Every target that runs project tooling (node, pnpm, prisma, vitest, playwright) executes inside the `app` container via `docker compose exec app`, never on the host
- [ ] AC17 — `make ci` runs `typecheck`, `lint` and `test` in that order and fails fast on the first non-zero exit
- [ ] AC18 — `make psql` opens a psql shell against database `aitj`; `make fresh` drops, migrates and seeds in that order
- [ ] AC19 — All targets are declared `.PHONY`; `make` with no argument prints usage rather than running anything destructive
- [ ] AC20 — `next.config.ts` sets `output: 'standalone'` before the runner stage is built — the multi-stage Dockerfile copies `.next/standalone`, which does not exist without it (flagged by qa-agent during AITJ-M0-02; deliberately deferred to this ticket as out of scope there)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | `.env.local` is missing | Docker compose fails with a clear error mentioning required variables, or uses defaults for optional ones |
| E2 | `DATABASE_URL` is invalid (bad connection string) | App container fails to start; logs indicate connection failure |
| E3 | Database container fails to start | App container waits for health check to pass; if it times out, app fails to start |
| E4 | Database schema is out of date | `prisma migrate deploy` updates it at startup without manual intervention |
| E5 | Seed script encounters an error | Startup fails with clear error logging; seed is not silently ignored |
| E6 | Docker compose is run on WSL2 or Docker Desktop with volume mounting | Named volume persists data across container restarts |
| E7 | `docker-compose down -v` is run | Named volume is deleted; next startup initializes a fresh database |
| E8 | A `make` target needing the container is run while the stack is down | Target fails with a clear message telling the user to run `make up` first, not an opaque docker error |
| E9 | `make fresh` is run against a database holding data | Data is dropped and rebuilt from migrations plus seed; the destructive step is not silent |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | unit | `docker > docker-compose.yml should exist` | File `docker-compose.yml` exists in the repo root; before work, it does not |
| T2 | unit | `docker > docker-compose.yml is valid YAML` | Running `docker compose config > /dev/null` exits 0 and produces no errors; before work, the file does not exist |
| T3 | unit | `docker > Dockerfile should exist` | File `Dockerfile` exists in the repo root |
| T4 | unit | `docker > Dockerfile is valid` | Running `docker build --dry-run .` or parsing the Dockerfile produces no syntax errors |
| T5 | integration | `docker > services should start and be healthy` | Running `docker compose up -d && docker compose ps` shows both services healthy (status "healthy" or similar); then `docker compose down` cleans up |
| T6 | integration | `docker > database should accept connections` | After `docker compose up -d`, connecting to the database via `psql -h localhost -U postgres` succeeds; then `docker compose down` |
| T7 | integration | `docker > app healthcheck should pass` | After `docker compose up -d`, polling `curl http://localhost:3000/api/health` eventually succeeds; then `docker compose down` |
| T8 | unit | `make > Makefile should exist` | File `Makefile` exists in the repo root; before work, it does not |
| T9 | unit | `make > Makefile defines every documented target` | Parsing the Makefile yields all 15 targets from AC15; each is also listed in `.PHONY` |
| T10 | unit | `make > tooling targets run inside the container` | Every target invoking node/pnpm/prisma/vitest/playwright contains `docker compose exec app`; no bare host invocation |
| T11 | integration | `make > make ci runs typecheck, lint and test in order` | With the stack up, `make ci` invokes the three in order and returns non-zero if any fails |

**Red gate:** Tests T1–T4 and T8–T10 check for file existence and basic syntax before any implementation. T5–T7 and T11 are integration-level and will be run during the GREEN phase. Commit the test scripts and the empty Dockerfile/compose stub.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `docker compose config` validates the compose file
- [ ] `docker compose build` succeeds without errors
- [ ] `docker compose up -d` starts both services and they become healthy within 30 seconds
- [ ] `docker exec [app-container] curl http://localhost:3000/api/health` returns a 2xx status
- [ ] `docker compose down -v` cleans up all resources (containers, volumes, networks)
- [ ] `pnpm tsc --noEmit` and `pnpm lint` pass
- [ ] `make up`, `make ps`, `make typecheck`, `make lint` and `make ci` all succeed against the running stack
- [ ] No secrets appear in the Dockerfile, compose file or Makefile

## Implementation notes

- Create `Dockerfile` at the repo root with three stages:
  1. **Dependencies:** `FROM node:20-alpine AS deps` → install pnpm, copy lockfile, install dependencies
  2. **Builder:** `FROM deps AS builder` → copy source, run `pnpm build`
  3. **Runner:** `FROM node:20-alpine AS runner` → copy built app and node_modules, create non-root user, expose port 3000, set CMD to `node server.js` or similar
  - Set `output: 'standalone'` in `next.config.ts` — this is NOT present as of AITJ-M0-02 and must be added here. It is not merely an image-size optimisation: the runner stage copies `.next/standalone`, so the build fails outright without it.
- Create `docker-compose.yml` with:
  - `db` service: `postgres:16-alpine`, environment `POSTGRES_PASSWORD` from env var (or hardcoded to `postgres` for dev), volume `postgres_data:/var/lib/postgresql/data`, healthcheck via `pg_isready`
  - `app` service: builds from Dockerfile, depends on `db`, environment variables injected, ports `3000:3000`, healthcheck via `curl`
  - Network: services communicate via service names (e.g., `db` is reachable as `postgres://db:5432/postgres`)
- Create `docker-compose.dev.yml` override with:
  - `app` service: use `next dev` for hot reload, mount source code as a volume
  - `db` service: expose port 5432 for local debugging
- Create `.dockerignore` excluding node_modules, .next, .git, .env*, .DS_Store
- Create an `.env.local.example` file documenting required variables (for reference; not committed to git in some repos)
- In the Dockerfile, run `prisma migrate deploy` and the seed script before starting the app server
- Do not hardcode `DATABASE_URL`, `AUTH_SECRET`, or any secret in the Dockerfile; source them from environment variables passed at runtime
- Create the root `Makefile` mirroring the command table in `CLAUDE.md` exactly — that table is the contract, so target names must not drift from it:
  - Stack: `up` (`docker compose up -d`), `down`, `ps`, `logs`, `shell` (`docker compose exec app bash`)
  - Database: `migrate` (`prisma migrate deploy`), `seed`, `fresh` (drop → migrate → seed), `psql` (`docker compose exec db psql -U postgres -d aitj`)
  - Quality: `typecheck` (`tsc --noEmit`), `lint` (ESLint + Prettier check), `test`, `test-unit`, `test-e2e`, `ci` (typecheck → lint → test)
  - Every tooling target wraps its command in `docker compose exec app`; the Makefile is the reason the no-host-tooling rule holds
  - Declare `.PHONY` for all targets and make the default goal a help listing, so a bare `make` never mutates state
  - `make fresh` is destructive — echo what it is about to do before doing it

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] `docker compose up -d` starts the app successfully
- [ ] Database migrations run automatically at startup
- [ ] Seeding runs automatically at startup (categories and admin account are created)
- [ ] Both services are healthy and communicate correctly
- [ ] `docker compose down -v` cleanly removes all resources
- [ ] `Makefile` exists and every target documented in `CLAUDE.md` works against the running stack
- [ ] No `make` target runs project tooling on the host
- [ ] No secrets hardcoded in Dockerfile, compose file or Makefile
