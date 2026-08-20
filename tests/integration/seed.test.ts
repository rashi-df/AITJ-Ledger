import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from '../schema/container';
import { uniqueEmail } from '../schema/fixtures';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  runSeed,
  SeedConfigError,
  validateAdminEnv,
} from '../../prisma/seed-lib';

// AITJ-M0-07. All tests share one migrated database (see tests/schema
// pattern) — the `integration` Vitest project runs serialized
// (`fileParallelism: false`, `isolate: false`), so this is safe.
//
// IMPORTANT: `getDatabaseUrl()` returns the *real* running Postgres
// instance when this suite executes inside the `app` container (i.e.
// `make test`) — it is not always a disposable Testcontainers database
// (see tests/schema/container.ts). Never hardcode `admin@aitj.local` (or
// any other literal that collides with `.env.example`'s
// `SEED_ADMIN_EMAIL`) here: doing so previously deleted the real seeded
// admin from a running dev stack and made it unrecoverable, because
// `seedAdmin()` gates admin creation on "does any User exist at all"
// (AC7). Every fixture email in this file must be generated per test run
// via `uniqueEmail()`, matching tests/schema/fixtures.ts's precedent, so
// this suite only ever creates and deletes rows it created itself.
//
// `seedAdmin()`'s "does any User exist at all" gate (AC7) is a *global*
// check — on a shared/live database that already holds the real seeded
// admin (and, over the life of a dev stack, real committee-entered
// users), that gate is permanently tripped, so a shared connection can
// never observe first-boot admin creation (AC4/AC6/T5-T7). Rather than
// weaken those assertions or delete real rows to force the gate open, the
// "seeding against a real database" and "app is queryable" blocks below
// run against a throwaway Postgres *schema* created fresh on the same
// database connection for this one test file: genuinely empty every run,
// migrated independently, and dropped in `afterAll` — no live data is
// ever read, deleted, or at risk.
async function createIsolatedSeedSchema(baseUrl: string): Promise<{
  prisma: PrismaClient;
  teardown: () => Promise<void>;
}> {
  const schemaName = `seed_test_${randomUUID().replace(/-/g, '')}`;
  const setupPrisma = new PrismaClient({ datasourceUrl: baseUrl });
  await setupPrisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
  await setupPrisma.$disconnect();

  const isolatedUrl = new URL(baseUrl);
  isolatedUrl.searchParams.set('schema', schemaName);
  runMigrateDeploy(isolatedUrl.toString());

  const prisma = new PrismaClient({ datasourceUrl: isolatedUrl.toString() });

  return {
    prisma,
    teardown: async () => {
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await prisma.$disconnect();
    },
  };
}

describe('seed.test.ts', () => {
  let prisma: PrismaClient;
  let databaseUrl: string;
  const adminEmail = uniqueEmail();
  const manualEmail = uniqueEmail();
  const notCreatedEmail = uniqueEmail();
  const validationEmail = uniqueEmail();

  beforeAll(async () => {
    databaseUrl = await getDatabaseUrl();
    runMigrateDeploy(databaseUrl);
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 120_000);

  afterAll(async () => {
    // Clean up only the rows this file itself created. Categories are
    // deliberately left untouched: `seedCategories()` is idempotent and
    // non-destructive (`createMany({ skipDuplicates: true })`) — it never
    // creates a new row when the canonical FR-C2/FR-C3 categories already
    // exist on a live/shared stack, so there is nothing for this suite to
    // clean up, and unconditionally deleting by canonical name/type would
    // delete those same real, permanent default categories instead.
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [adminEmail, manualEmail, notCreatedEmail],
        },
      },
    });
    await prisma.$disconnect();
  });

  describe('env validation (subprocess — checks real process.exit behaviour)', () => {
    // These two run the actual prisma/seed.ts script as a subprocess so the
    // `process.exit(1)` path is exercised for real, not just the exported
    // validator function.
    test('should fail if SEED_ADMIN_PASSWORD is missing', () => {
      // Explicitly set to an empty string, not `delete`d: tsx auto-loads a
      // repo-root `.env` file (present here because docker-compose.dev.yml
      // bind-mounts the whole repo for hot reload), and dotenv only fills
      // in a variable that is *absent* from the child's env, not one that
      // is merely falsy. An explicit empty string keeps `.env`'s
      // `SEED_ADMIN_PASSWORD` from silently winning and defeating this
      // test, while still exercising the same `!password` validation path.
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        DATABASE_URL: databaseUrl,
        SEED_ADMIN_PASSWORD: '',
        SEED_ADMIN_EMAIL: validationEmail,
      };

      let stderr = '';
      let exitCode = 0;
      try {
        execFileSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], { env, stdio: 'pipe' });
      } catch (error) {
        const err = error as { status: number; stderr: Buffer };
        exitCode = err.status;
        stderr = err.stderr.toString();
      }

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('SEED_ADMIN_PASSWORD is required');
    });

    test('should fail if SEED_ADMIN_PASSWORD is too short', () => {
      const env = {
        ...process.env,
        DATABASE_URL: databaseUrl,
        SEED_ADMIN_EMAIL: validationEmail,
        SEED_ADMIN_PASSWORD: 'ShortPwd',
      };

      let stderr = '';
      let exitCode = 0;
      try {
        execFileSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], { env, stdio: 'pipe' });
      } catch (error) {
        const err = error as { status: number; stderr: Buffer };
        exitCode = err.status;
        stderr = err.stderr.toString();
      }

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('must be at least 10 characters');
    });

    test('validateAdminEnv throws SeedConfigError for missing password', () => {
      expect(() => validateAdminEnv({ SEED_ADMIN_EMAIL: validationEmail })).toThrow(
        SeedConfigError,
      );
    });
  });

  describe('seeding against a real database', () => {
    const adminPassword = 'Correct10CharPwd';
    let isolated: PrismaClient;
    let teardown: () => Promise<void>;

    beforeAll(async () => {
      const schema = await createIsolatedSeedSchema(databaseUrl);
      isolated = schema.prisma;
      teardown = schema.teardown;
      await runSeed(isolated, {
        SEED_ADMIN_EMAIL: adminEmail,
        SEED_ADMIN_PASSWORD: adminPassword,
      });
    }, 120_000);

    afterAll(async () => {
      await teardown();
    });

    // This schema is created fresh for this describe block alone (see
    // createIsolatedSeedSchema above), so it holds nothing but what
    // `runSeed` itself created — no name-list filtering needed to stay
    // accurate against other test files' fixtures.
    test('creates exactly 6 income categories', async () => {
      const categories = await isolated.category.findMany({ where: { type: 'INCOME' } });
      expect(categories).toHaveLength(6);
      expect(categories.map((c) => c.name).sort()).toEqual([...INCOME_CATEGORIES].sort());
    });

    test('creates exactly 10 expense categories', async () => {
      const categories = await isolated.category.findMany({ where: { type: 'EXPENSE' } });
      expect(categories).toHaveLength(10);
      expect(categories.map((c) => c.name).sort()).toEqual([...EXPENSE_CATEGORIES].sort());
    });

    test('category names match FR-C2 and FR-C3 exactly (case-sensitive)', async () => {
      const income = await isolated.category.findMany({ where: { type: 'INCOME' } });
      const expense = await isolated.category.findMany({ where: { type: 'EXPENSE' } });

      expect(income.map((c) => c.name).sort()).toEqual(
        [
          'Donation',
          'Zakat',
          'Sadaqah',
          "Jumu'ah Collection",
          'Membership/Contribution',
          'Other',
        ].sort(),
      );
      expect(expense.map((c) => c.name).sort()).toEqual(
        [
          'Electricity',
          'Water',
          'Maintenance',
          'Cleaning',
          'Salary/Wages',
          'Construction',
          'Equipment',
          'Events/Programs',
          'Office Expenses',
          'Other',
        ].sort(),
      );
    });

    test('creates admin user with mustChangePassword true', async () => {
      const admin = await isolated.user.findUnique({ where: { email: adminEmail } });
      expect(admin).not.toBeNull();
      expect(admin?.mustChangePassword).toBe(true);
    });

    test('hashes the admin password (never stores it plain)', async () => {
      const admin = await isolated.user.findUnique({ where: { email: adminEmail } });
      expect(admin?.passwordHash).toBeDefined();
      expect(admin?.passwordHash).not.toBe(adminPassword);
      // bcrypt hashes are always 60 chars, prefixed with $2
      expect(admin?.passwordHash.startsWith('$2')).toBe(true);
    });

    test('seed is idempotent — running twice produces no duplicates', async () => {
      await runSeed(isolated, {
        SEED_ADMIN_EMAIL: adminEmail,
        SEED_ADMIN_PASSWORD: adminPassword,
      });

      const income = await isolated.category.count({ where: { type: 'INCOME' } });
      const expense = await isolated.category.count({ where: { type: 'EXPENSE' } });
      const admins = await isolated.user.count({ where: { email: adminEmail } });

      expect(income).toBe(6);
      expect(expense).toBe(10);
      expect(admins).toBe(1);
    });
  });

  describe('does not create an admin if a user already exists', () => {
    test('seed does not create an admin when a non-admin user already exists', async () => {
      await prisma.user.create({
        data: {
          name: 'Manually Created User',
          email: manualEmail,
          passwordHash: 'not-a-real-hash',
        },
      });

      const usersBefore = await prisma.user.count();

      await runSeed(prisma, {
        SEED_ADMIN_EMAIL: notCreatedEmail,
        SEED_ADMIN_PASSWORD: 'Correct10CharPwd',
      });

      const usersAfter = await prisma.user.count();
      const notCreated = await prisma.user.findUnique({
        where: { email: notCreatedEmail },
      });
      const manualStillThere = await prisma.user.findUnique({ where: { email: manualEmail } });

      expect(usersAfter).toBe(usersBefore);
      expect(notCreated).toBeNull();
      expect(manualStillThere).not.toBeNull();
    });
  });

  describe('app is queryable immediately after seeding', () => {
    // AC11 / T10: the ticket's test plan describes navigating to `/login`
    // in a browser. That route ships in AITJ-M1-02, which does not exist
    // yet in M0 — so this proves the DB-side precondition instead: after
    // seed runs against a freshly migrated, empty database, the exact
    // query the eventual login flow needs (an active user by email, with
    // password hash) resolves immediately with no further setup. The
    // running Docker app + `/api/health` (AITJ-M0-05) already prove the
    // server itself boots against this same seeded database.
    //
    // Uses its own fresh isolated schema (see createIsolatedSeedSchema) —
    // "freshly migrated, empty database" is the scenario under test, which
    // a shared/live connection with a pre-existing admin cannot represent.
    const queryableAdminEmail = uniqueEmail();
    let isolated: PrismaClient;
    let teardown: () => Promise<void>;

    beforeAll(async () => {
      const schema = await createIsolatedSeedSchema(databaseUrl);
      isolated = schema.prisma;
      teardown = schema.teardown;
      await runSeed(isolated, {
        SEED_ADMIN_EMAIL: queryableAdminEmail,
        SEED_ADMIN_PASSWORD: 'Correct10CharPwd',
      });
    }, 120_000);

    afterAll(async () => {
      await teardown();
    });

    test('seeded admin is immediately queryable by email for login', async () => {
      const admin = await isolated.user.findUnique({
        where: { email: queryableAdminEmail },
        select: { id: true, email: true, passwordHash: true, isActive: true },
      });

      expect(admin).not.toBeNull();
      expect(admin?.isActive).toBe(true);
    });
  });
});
