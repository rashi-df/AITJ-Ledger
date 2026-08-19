# AITJ-M8-06 — Production deployment on a VPS behind a reverse proxy

| Field | Value |
|---|---|
| Milestone | M8 — Hardening |
| Depends on | AITJ-M0-05, AITJ-M1-01, AITJ-M8-04 |
| Blocks | AITJ-M8-07 |
| PRD refs | §12.1 Containers, §12.2 env vars, §12.3 VPS + reverse proxy, §12.4 Local/Staging/Prod, NFR-10 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

AITJ Ledger deploys as two Docker services (app + database) on a single VPS behind Caddy or Nginx terminating TLS with an auto-renewed certificate. Migrations and seeding run at container start before the server accepts traffic. NFR-10 requires the app to boot against an empty database and self-seed categories and the admin account. The RED phase writes a smoke test against a freshly provisioned stack that fails until deployment is correct. GREEN is the production Dockerfile, docker-compose.yml, reverse proxy config, and initialization logic.

## Acceptance criteria

- [ ] AC1 — Production docker-compose.yml defines `app` and `db` services with resource limits and restart policies
- [ ] AC2 — App Dockerfile uses multi-stage build (deps → build → runner), runs as non-root user, includes `/api/health` healthcheck endpoint
- [ ] AC3 — Database service uses `postgres:16-alpine`, named volume for persistence, healthcheck via `pg_isready`; `app` depends on `db` being healthy before starting
- [ ] AC4 — On first boot against an empty database, Prisma migrations run automatically; categories (FR-C2/C3) and admin account (FR-A5) are seeded; app accepts traffic
- [ ] AC5 — On second boot with existing data, migrations are idempotent (do not re-run); admin account is not re-seeded (password is not reset)
- [ ] AC6 — Environment variables are loaded from `.env.production` (or Docker Compose `env_file`); required vars (DATABASE_URL, AUTH_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, NODE_ENV, TZ) are documented and validated at startup
- [ ] AC7 — Missing or malformed env vars cause the app to fail fast at boot with a clear error message (e.g. "DATABASE_URL is required") before any route handler runs
- [ ] AC8 — Reverse proxy (Caddy or Nginx) terminates TLS with a valid certificate; `https://` domain is configured; HTTP redirects to HTTPS
- [ ] AC9 — Certificate auto-renewal (Caddy automatic or Certbot) is configured and verified to work (or mechanism is documented and manually verified once)
- [ ] AC10 — TZ environment variable inside the container is `Asia/Kolkata` and verified in production (logged at startup or checked via `/api/health` response)
- [ ] AC11 — Health check endpoint (`/api/health`) responds with 200 and JSON body `{"status":"ok"}` when the app and database are healthy
- [ ] AC12 — Health check endpoint returns non-200 if the database is unreachable or a required env var is missing
- [ ] AC13 — Docker Compose networking allows only necessary services to communicate; database is not exposed to the internet (no port binding on the host interface)
- [ ] AC14 — Logs from `app` and `db` services are collected and can be viewed via `docker compose logs`; structured app logs (JSON) are parseable

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Empty database on first boot | Migrations run; default categories are seeded; admin user is created; app starts accepting traffic within 30s |
| E2 | Existing database on second boot | Migrations check and do nothing; admin account is NOT recreated; app starts normally |
| E3 | DATABASE_URL is missing | App fails at boot with error message "DATABASE_URL is required"; no partial startup or degraded mode |
| E4 | AUTH_SECRET is missing | App fails at boot with error message "AUTH_SECRET is required"; no fallback or insecure default |
| E5 | Database container crashes and restarts | Docker Compose restart policy (`on-failure`) restarts the container; app container waits for database to be healthy again; no data loss from named volume |
| E6 | Certificate expires during deployment | Certbot or Caddy auto-renewal renews the certificate; HTTPS continues to work; no manual intervention required (unless renewal fails, in which case it is logged) |
| E7 | Reverse proxy becomes unreachable | Monitoring or logs show connectivity errors; manual investigation required (not part of app, but deployment should surface this) |
| E8 | App container runs out of disk space | Logs show error; existing data in the database is intact (assuming database volume is on a separate, larger partition) |
| E9 | Requests to `http://domain.com` | Reverse proxy redirects to `https://domain.com` with 301; client follows the redirect |
| E10 | Health check endpoint with database failure | `/api/health` is called while database is down; endpoint returns 503 or 500; logs show the database error |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `deployment > smoke test fresh stack` | Provision a fresh docker-compose stack with empty database; wait for health check to pass; assert GET `/` returns 200; dashboard is renderable |
| T2 | integration | `deployment > health check endpoint` | Hit `/api/health`; assert response is 200 and body is `{"status":"ok"}` |
| T3 | integration | `deployment > health check fails on db down` | Stop the database container; hit `/api/health`; assert response is non-200 (503 or 500) |
| T4 | integration | `deployment > empty database seeded on boot` | Fresh stack boots; query database for categories; assert `count(*)` is 16 (seeded income + expense categories); query users; assert one admin account exists |
| T5 | integration | `deployment > admin account not re-seeded on second boot` | First boot seeds admin; note the user ID; restart app container; second boot does not create a duplicate user; user count is still 1 |
| T6 | integration | `deployment > migrations run idempotently` | First boot runs migrations; second boot checks migrations (no new ones to run); assert no errors in logs |
| T7 | integration | `deployment > missing DATABASE_URL fails at boot` | Set up environment with DATABASE_URL unset; attempt to start app container; assert container exits with clear error message in logs |
| T8 | integration | `deployment > missing AUTH_SECRET fails at boot` | Unset AUTH_SECRET; start app; assert container exits with error message mentioning AUTH_SECRET |
| T9 | integration | `deployment > TZ Asia/Kolkata set` | Start container with TZ=Asia/Kolkata; log startup message should indicate timezone; or `/api/health` response includes timezone info |
| T10 | e2e | `deployment > HTTPS redirect` | Make request to `http://domain:80`; reverse proxy redirects to `https://domain:443`; follow redirect; assert response is 200 |
| T11 | integration | `deployment > database persists across restarts` | Add a transaction to the database; stop and restart the `db` and `app` services; query database; transaction is still there |
| T12 | integration | `deployment > app waits for db healthcheck` | Start both services; assert `app` container does not transition to `running` until `db` is healthy (via `depends_on: { db: { condition: service_healthy } }`) |

**Red gate:** Smoke test fails because app will not start. Database is empty after boot. Health check endpoint is missing or returns wrong status. Env var validation is missing; app boots into a broken state. Migrations fail or re-run on second boot.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] Fresh stack boots successfully; health check passes; dashboard is renderable
- [ ] Empty database is seeded on first boot; second boot is idempotent
- [ ] All required env vars are validated; missing vars cause fast failure
- [ ] TZ is set to Asia/Kolkata in the container
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

- **Production Dockerfile:** Create `Dockerfile` with multi-stage build:
  ```dockerfile
  FROM node:20-alpine AS deps
  WORKDIR /app
  COPY package.json pnpm-lock.yaml ./
  RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package.json pnpm-lock.yaml ./
  RUN npm install -g pnpm && pnpm install --frozen-lockfile
  COPY . .
  RUN pnpm build

  FROM node:20-alpine AS runner
  WORKDIR /app
  RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
  COPY --from=builder /app/.next/standalone ./
  COPY --from=builder /app/public ./public
  COPY --from=builder /app/.next/static ./.next/static
  USER nextjs
  EXPOSE 3000
  HEALTHCHECK --interval=10s --timeout=5s --start-period=30s CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
  CMD ["node", "server.js"]
  ```
- **docker-compose.yml for production:** Use named volumes for the database, set resource limits, and configure restart policies:
  ```yaml
  version: '3.8'
  services:
    db:
      image: postgres:16-alpine
      environment:
        POSTGRES_DB: aitj_ledger
        POSTGRES_USER: aitj_user
        POSTGRES_PASSWORD: ${DB_PASSWORD}
      volumes:
        - db_data:/var/lib/postgresql/data
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U aitj_user"]
        interval: 10s
        timeout: 5s
        retries: 5
      restart: unless-stopped

    app:
      build: .
      environment:
        DATABASE_URL: postgresql://aitj_user:${DB_PASSWORD}@db:5432/aitj_ledger
        AUTH_SECRET: ${AUTH_SECRET}
        SEED_ADMIN_EMAIL: ${SEED_ADMIN_EMAIL}
        SEED_ADMIN_PASSWORD: ${SEED_ADMIN_PASSWORD}
        NODE_ENV: production
        TZ: Asia/Kolkata
      depends_on:
        db:
          condition: service_healthy
      ports:
        - "3000:3000"
      restart: unless-stopped

  volumes:
    db_data:
  ```
- **Env var validation:** In `lib/env.ts` or at app startup (before any route handler):
  ```typescript
  function validateEnv() {
    const required = ['DATABASE_URL', 'AUTH_SECRET', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD'];
    for (const key of required) {
      if (!process.env[key]) {
        console.error(`FATAL: ${key} is required`);
        process.exit(1);
      }
    }
    // Validate DATABASE_URL format (basic check)
    if (!process.env.DATABASE_URL?.startsWith('postgresql://')) {
      console.error('FATAL: DATABASE_URL must be a valid PostgreSQL connection string');
      process.exit(1);
    }
  }
  if (process.env.NODE_ENV === 'production') {
    validateEnv();
  }
  ```
- **Health check endpoint:** In `app/api/health/route.ts`:
  ```typescript
  import { db } from '@/lib/db';
  export async function GET() {
    try {
      await db.$queryRaw`SELECT 1`;
      return Response.json({ status: 'ok' });
    } catch (error) {
      return Response.json({ status: 'error', error: error.message }, { status: 503 });
    }
  }
  ```
- **Seeding on boot:** In `prisma/seed.ts`, wrap the seeding logic:
  ```typescript
  async function main() {
    // Only seed if the database is empty
    const userCount = await db.user.count();
    if (userCount === 0) {
      // Seed categories and admin
      console.log('Seeding database...');
      // ... seed logic ...
    }
  }
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
  ```
  And in `docker-compose.yml`, add a healthcheck that waits for the database to be ready before migrations run. Use `docker-entrypoint.sh` to run migrations:
  ```bash
  #!/bin/sh
  set -e
  echo "Running migrations..."
  npx prisma migrate deploy
  echo "Seeding database..."
  npx prisma db seed
  exec node server.js
  ```
- **Reverse proxy (Caddy):** Create a `Caddyfile`:
  ```
  yourdomain.com {
    reverse_proxy localhost:3000
    encode gzip
    header Strict-Transport-Security "max-age=31536000; includeSubDomains"
  }
  ```
  Caddy automatically obtains and renews certificates from Let's Encrypt.
- **Reverse proxy (Nginx + Certbot):** Configure Nginx at `/etc/nginx/sites-available/aitj`:
  ```nginx
  server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
  }
  server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    location / {
      proxy_pass http://localhost:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
  ```
  And set up Certbot renewal: `certbot renew --quiet` as a cron job.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Production Dockerfile and docker-compose.yml created and tested
- [ ] Health check endpoint responding correctly
- [ ] Empty database seeded on first boot; second boot is idempotent
- [ ] All required env vars validated at startup; missing vars cause fast failure
- [ ] TZ set to Asia/Kolkata in container
- [ ] Reverse proxy (Caddy or Nginx) configured for HTTPS and auto-renewal
- [ ] Fresh stack smoke test passes
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
