# AITJ-M0-05 — Docker compose for app and PostgreSQL 16

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

**Red gate:** Tests T1–T4 check for file existence and basic syntax before any implementation. T5–T7 are integration-level and will be run during the GREEN phase. Commit the test scripts and the empty Dockerfile/compose stub.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `docker compose config` validates the compose file
- [ ] `docker compose build` succeeds without errors
- [ ] `docker compose up -d` starts both services and they become healthy within 30 seconds
- [ ] `docker exec [app-container] curl http://localhost:3000/api/health` returns a 2xx status
- [ ] `docker compose down -v` cleans up all resources (containers, volumes, networks)
- [ ] `pnpm tsc --noEmit` and `pnpm lint` pass
- [ ] No secrets appear in the Dockerfile or compose file

## Implementation notes

- Create `Dockerfile` at the repo root with three stages:
  1. **Dependencies:** `FROM node:20-alpine AS deps` → install pnpm, copy lockfile, install dependencies
  2. **Builder:** `FROM deps AS builder` → copy source, run `pnpm build`
  3. **Runner:** `FROM node:20-alpine AS runner` → copy built app and node_modules, create non-root user, expose port 3000, set CMD to `node server.js` or similar
  - Use `output: 'standalone'` in `next.config.js` to reduce the final image size
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

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] `docker compose up -d` starts the app successfully
- [ ] Database migrations run automatically at startup
- [ ] Seeding runs automatically at startup (categories and admin account are created)
- [ ] Both services are healthy and communicate correctly
- [ ] `docker compose down -v` cleanly removes all resources
- [ ] No secrets hardcoded in Dockerfile or compose file
