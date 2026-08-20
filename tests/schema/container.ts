import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Shared across every test file in tests/schema/ for this ticket. Vitest is
// configured with `isolate: false` and `fileParallelism: false` so this
// module-level singleton survives the whole run instead of restarting a
// container per file.
let containerPromise: Promise<StartedPostgreSqlContainer> | undefined;

function startContainer(): Promise<StartedPostgreSqlContainer> {
  if (!containerPromise) {
    containerPromise = new PostgreSqlContainer('postgres:16').start();
  }
  return containerPromise;
}

export async function getDatabaseUrl(): Promise<string> {
  // Inside the `app` container (i.e. when `make test`/`make ci` exec into
  // it), `DATABASE_URL` already points at the compose stack's own `db`
  // service. Testcontainers can't be used there: it would ask the host's
  // Docker daemon (reachable, since it's only the socket that's shared) to
  // publish a port that is only bound on the *host's* network namespace,
  // which `app` cannot reach at `localhost:<port>` (AITJ-M0-06). Reusing
  // the already-running Postgres 16 `db` service is the "or a disposable
  // Docker container" alternative the harness ticket's AC3 explicitly
  // allows for. On a developer's host or a CI runner (no `DATABASE_URL` in
  // the environment) this still starts a fresh Testcontainers instance.
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const container = await startContainer();
  return container.getConnectionUri();
}

/**
 * Applies pending migrations to the given database. Safe to call
 * repeatedly (per test file) — `prisma migrate deploy` is idempotent and
 * skips migrations that are already recorded as applied.
 */
export function runMigrateDeploy(databaseUrl: string): void {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
