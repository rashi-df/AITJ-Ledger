import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from '../schema/container';
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
describe('seed.test.ts', () => {
  let prisma: PrismaClient;
  let databaseUrl: string;

  beforeAll(async () => {
    databaseUrl = await getDatabaseUrl();
    runMigrateDeploy(databaseUrl);
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 120_000);

  afterAll(async () => {
    // The Vitest `integration` project's file-discovery order runs
    // `tests/integration/**` before `tests/schema/**` (see vitest.config.ts),
    // and `tests/schema/constraints.test.ts` deliberately hardcodes some of
    // the exact same literal category names this suite seeds for real
    // (e.g. "Water", "Electricity", "Other") to test case-insensitive
    // uniqueness. Clean up everything this file created so that ordering
    // is irrelevant and no other test file inherits leftover rows.
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['admin@aitj.local', 'manual-user@aitj.local', 'should-not-be-created@aitj.local'],
        },
      },
    });
    await prisma.category.deleteMany({
      where: {
        OR: [
          { type: 'INCOME', name: { in: [...INCOME_CATEGORIES] } },
          { type: 'EXPENSE', name: { in: [...EXPENSE_CATEGORIES] } },
        ],
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
        SEED_ADMIN_EMAIL: 'admin@aitj.local',
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
        SEED_ADMIN_EMAIL: 'admin@aitj.local',
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
      expect(() => validateAdminEnv({ SEED_ADMIN_EMAIL: 'admin@aitj.local' })).toThrow(
        SeedConfigError,
      );
    });
  });

  describe('seeding against a real database', () => {
    const adminEmail = 'admin@aitj.local';
    const adminPassword = 'Correct10CharPwd';

    beforeAll(async () => {
      await runSeed(prisma, { SEED_ADMIN_EMAIL: adminEmail, SEED_ADMIN_PASSWORD: adminPassword });
    });

    // Other test files sharing this database (tests/schema/**) create
    // their own categories with random names of the same INCOME/EXPENSE
    // types during the same `pnpm test` run (the global truncate in
    // tests/integration/global-setup.ts only runs once, before the whole
    // run). Filtering by the exact seeded name list, not just `type`,
    // keeps these assertions accurate regardless of what else the shared
    // database picks up over the course of the run.
    test('creates exactly 6 income categories', async () => {
      const categories = await prisma.category.findMany({
        where: { type: 'INCOME', name: { in: [...INCOME_CATEGORIES] } },
      });
      expect(categories).toHaveLength(6);
      expect(categories.map((c) => c.name).sort()).toEqual([...INCOME_CATEGORIES].sort());
    });

    test('creates exactly 10 expense categories', async () => {
      const categories = await prisma.category.findMany({
        where: { type: 'EXPENSE', name: { in: [...EXPENSE_CATEGORIES] } },
      });
      expect(categories).toHaveLength(10);
      expect(categories.map((c) => c.name).sort()).toEqual([...EXPENSE_CATEGORIES].sort());
    });

    test('category names match FR-C2 and FR-C3 exactly (case-sensitive)', async () => {
      const income = await prisma.category.findMany({
        where: { type: 'INCOME', name: { in: [...INCOME_CATEGORIES] } },
      });
      const expense = await prisma.category.findMany({
        where: { type: 'EXPENSE', name: { in: [...EXPENSE_CATEGORIES] } },
      });

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
      const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
      expect(admin).not.toBeNull();
      expect(admin?.mustChangePassword).toBe(true);
    });

    test('hashes the admin password (never stores it plain)', async () => {
      const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
      expect(admin?.passwordHash).toBeDefined();
      expect(admin?.passwordHash).not.toBe(adminPassword);
      // bcrypt hashes are always 60 chars, prefixed with $2
      expect(admin?.passwordHash.startsWith('$2')).toBe(true);
    });

    test('seed is idempotent — running twice produces no duplicates', async () => {
      await runSeed(prisma, { SEED_ADMIN_EMAIL: adminEmail, SEED_ADMIN_PASSWORD: adminPassword });

      const income = await prisma.category.count({
        where: { type: 'INCOME', name: { in: [...INCOME_CATEGORIES] } },
      });
      const expense = await prisma.category.count({
        where: { type: 'EXPENSE', name: { in: [...EXPENSE_CATEGORIES] } },
      });
      const admins = await prisma.user.count({ where: { email: adminEmail } });

      expect(income).toBe(6);
      expect(expense).toBe(10);
      expect(admins).toBe(1);
    });
  });

  describe('does not create an admin if a user already exists', () => {
    test('seed does not create an admin when a non-admin user already exists', async () => {
      const manualEmail = 'manual-user@aitj.local';
      await prisma.user.create({
        data: {
          name: 'Manually Created User',
          email: manualEmail,
          passwordHash: 'not-a-real-hash',
        },
      });

      const usersBefore = await prisma.user.count();

      await runSeed(prisma, {
        SEED_ADMIN_EMAIL: 'should-not-be-created@aitj.local',
        SEED_ADMIN_PASSWORD: 'Correct10CharPwd',
      });

      const usersAfter = await prisma.user.count();
      const notCreated = await prisma.user.findUnique({
        where: { email: 'should-not-be-created@aitj.local' },
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
    test('seeded admin is immediately queryable by email for login', async () => {
      const admin = await prisma.user.findUnique({
        where: { email: 'admin@aitj.local' },
        select: { id: true, email: true, passwordHash: true, isActive: true },
      });

      expect(admin).not.toBeNull();
      expect(admin?.isActive).toBe(true);
    });
  });
});
