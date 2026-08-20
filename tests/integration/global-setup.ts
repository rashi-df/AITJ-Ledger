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
 *
 * HOTFIX (live data-loss bug found during AITJ-M0-07's QA): `DATABASE_URL`
 * being set is not, on its own, evidence that the database is disposable
 * — inside the `app` container it *always* points at the persistent
 * Docker Compose `db` service (see tests/schema/container.ts), which is
 * exactly the same service a developer's real seeded admin account and
 * categories (and, from M1 onward, real committee transaction data) live
 * in. Truncating on the presence of `DATABASE_URL` alone wiped that live
 * data every time `make test`/`make ci` ran.
 *
 * The guard below refuses to truncate if the `User` table already has any
 * rows. A genuinely fresh database — a brand-new Testcontainers instance,
 * or a compose `db` volume right after `prisma migrate deploy` with no
 * seed run yet — has zero `User` rows, since migrations alone create no
 * data. As soon as either a real admin account (`pnpm seed`) or a
 * `tests/schema/*` fixture user exists, this intentionally stops
 * truncating for every run after that — the tradeoff is a non-empty
 * table (schema tests' own fixture rows accumulate; they use unique
 * emails/names so this doesn't break anything by itself, see
 * tests/schema/fixtures.ts) rather than ever risking a real user's data.
 * Known follow-up (tracked, not fixed here): tests/schema/*.test.ts
 * fixtures are never deleted after the run, so this table never goes
 * back to empty on its own once any test has run against a shared
 * database — restore a clean slate explicitly with `make fresh` /
 * `prisma migrate reset` if you want the pre-hotfix "always clean"
 * behaviour back.
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

    if (tables.some((row) => row.tablename === 'User')) {
      const [{ count }] = await prisma.$queryRawUnsafe<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM "User"`,
      );

      if (count > 0) {
        // Refuse to touch a database that already holds real (or at
        // least real-looking) user data — never assume `DATABASE_URL`
        // being set means "safe to wipe". Run `make fresh` /
        // `prisma migrate reset` explicitly if you actually intend to
        // reset a shared dev database.
        console.warn(
          '[tests/integration/global-setup] Skipping truncate: the "User" table already has rows, so this is not a disposable database.',
        );
        return;
      }
    }

    const tableList = tables.map((row) => `"${row.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
}
