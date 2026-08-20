import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from './container';

describe('schema > migrate.test.ts', () => {
  let databaseUrl: string;
  let prisma: PrismaClient;

  beforeAll(async () => {
    databaseUrl = await getDatabaseUrl();
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('migration should be applicable', async () => {
    expect(() => runMigrateDeploy(databaseUrl)).not.toThrow();

    const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
    );

    expect(rows[0].count).toBeGreaterThan(0);
  });

  test('all tables should exist', async () => {
    const rows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const tableNames = rows.map((row) => row.table_name);

    for (const expected of [
      'User',
      'Category',
      'Transaction',
      'Invite',
      'AuditLog',
      'AppSetting',
    ]) {
      expect(tableNames).toContain(expected);
    }
  });
});
