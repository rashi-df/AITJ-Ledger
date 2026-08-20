import { getDatabaseUrl } from '../schema/container';

// AITJ-M0-06's Testcontainers proof-of-life suite reuses
// tests/schema/container.ts's `getDatabaseUrl` (see AITJ-M0-03/04) rather
// than starting a second Postgres container itself. That gets this suite
// the same environment-aware behaviour for free: a fresh Testcontainers
// instance on a developer's host or a CI runner, or the compose stack's
// already-running `db` service when `DATABASE_URL` is already set (as it
// is inside the `app` container that `make test`/`make ci` exec into). It
// also avoids two independent `PostgreSqlContainer.start()` calls
// happening in the same Vitest worker process -- this "integration"
// project runs with `fileParallelism: false` / `isolate: false` (see
// vitest.config.ts), so every file in it shares one process.
export function startPostgresContainer(): Promise<string> {
  return getDatabaseUrl();
}
