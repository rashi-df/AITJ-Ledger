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
