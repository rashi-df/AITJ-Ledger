import { PrismaClient } from '@prisma/client';

/**
 * Vitest `globalSetup` for the `integration` project (tests/integration/**
 * and tests/schema/**). Runs once, before any test file in the project
 * connects.
 *
 * Inside the `app` container, `make test`/`make ci` reuse the compose
 * stack's own persistent `DATABASE_URL` (see tests/schema/container.ts) —
 * there is no fresh Testcontainers instance to guarantee a clean slate.
 * Left unaddressed, data a previous `pnpm test` run left behind (in
 * particular the fixed, non-unique category names the case-insensitive
 * uniqueness tests in constraints.test.ts use, e.g. "Water"/"Electricity")
 * would still be there on the next run and fail with a unique constraint
 * violation, making the suite non-idempotent.
 *
 * Truncating the app tables once here — before any test file runs — gives
 * every full `pnpm test`/`make test` invocation a clean slate regardless
 * of what a previous run left behind, satisfying edge cases E2/E6 (test
 * isolation, clean slate between runs).
 *
 * On a developer's host or CI runner, `DATABASE_URL` is not already set,
 * so `getDatabaseUrl()` (in the test files themselves) starts a fresh,
 * empty Testcontainers Postgres instance for the run — there is nothing
 * to clean up, so this setup is a no-op.
 */
export default async function setup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return;
  }

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%'`,
    );

    if (tables.length === 0) {
      // First run ever against this database: migrations have not been
      // applied yet, so there are no app tables to truncate. Each test
      // file's own `beforeAll` runs `prisma migrate deploy` before use.
      return;
    }

    const tableList = tables.map((row) => `"${row.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
}
