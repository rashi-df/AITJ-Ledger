import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import setup from './global-setup';

/**
 * Hotfix regression suite for the live data-loss bug discovered during
 * AITJ-M0-07's QA: `tests/integration/global-setup.ts` unconditionally
 * truncated every app table whenever `DATABASE_URL` was already set, with
 * no check for whether that was a disposable database or the shared
 * Docker Compose `db` service holding real seeded data.
 *
 * Inside the `app` container -- how `make test`/`make ci` always run, per
 * this repo's CLAUDE.md -- there is no Docker socket, so Testcontainers
 * cannot start a second, genuinely disposable Postgres server here. This
 * suite instead creates a throwaway *database* on the same Postgres
 * server `DATABASE_URL` already points at: structurally identical to a
 * real "live" database (same schema, same tables, migrated the same way),
 * but never the real `aitj` database itself -- so a bug in the guard
 * under test can never touch real data even while this proves the guard.
 */
describe('global-setup.ts truncate guard', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  if (!originalDatabaseUrl) {
    throw new Error(
      'DATABASE_URL must already be set to run this suite (see tests/schema/container.ts).',
    );
  }

  const dbName = `hotfix_guard_${randomUUID().replace(/-/g, '')}`;

  function withDatabase(url: string, name: string): string {
    const parsed = new URL(url);
    parsed.pathname = `/${name}`;
    return parsed.toString();
  }

  const maintenanceUrl = withDatabase(originalDatabaseUrl, 'postgres');
  const testDatabaseUrl = withDatabase(originalDatabaseUrl, dbName);

  let admin: PrismaClient;
  let prisma: PrismaClient;

  beforeAll(async () => {
    admin = new PrismaClient({ datasourceUrl: maintenanceUrl });
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);

    execSync('pnpm exec prisma migrate deploy', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.$disconnect();
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  test('does not truncate a database that already holds a real seeded user', async () => {
    await prisma.user.create({
      data: { name: 'Admin', email: 'admin@aitj.local', passwordHash: 'not-a-real-hash' },
    });
    await prisma.category.createMany({
      data: [
        { name: 'Donation', type: 'INCOME' },
        { name: 'Electricity', type: 'EXPENSE' },
      ],
    });

    process.env.DATABASE_URL = testDatabaseUrl;
    try {
      await setup();
    } finally {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    await expect(prisma.user.count()).resolves.toBe(1);
    await expect(prisma.category.count()).resolves.toBe(2);

    // Leave the User table empty again so the next test in this file
    // exercises the genuinely-empty, clean-slate path.
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
  });

  test('still truncates leftover rows when the User table is genuinely empty', async () => {
    await prisma.category.create({ data: { name: 'Water', type: 'EXPENSE' } });

    process.env.DATABASE_URL = testDatabaseUrl;
    try {
      await setup();
    } finally {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    await expect(prisma.category.count()).resolves.toBe(0);
  });
});
