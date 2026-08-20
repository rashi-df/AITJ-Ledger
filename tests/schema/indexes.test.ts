import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from './container';

// Postgres has no `information_schema.statistics` table (that view is
// MySQL-specific); the Postgres-native equivalent for confirming an
// index's column list is `pg_indexes.indexdef`, so that is what this test
// queries against the real Testcontainers Postgres instance.
describe('schema > indexes.test.ts', () => {
  let prisma: PrismaClient;
  let indexDefs: string[];

  beforeAll(async () => {
    const databaseUrl = await getDatabaseUrl();
    runMigrateDeploy(databaseUrl);
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });

    const rows = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'Transaction'`,
    );
    indexDefs = rows.map((row) => row.indexdef.toLowerCase());
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Transaction indexes exist', () => {
    // Postgres only quotes an identifier in `pg_indexes.indexdef` when it
    // needs escaping (mixed case, reserved word, etc.) — `deletedAt` and
    // `occurredOn` are quoted, but the all-lowercase `type` is not. Match
    // the column name as a bare token, with or without quotes.
    const hasIndexOn = (columns: string[]) =>
      indexDefs.some((def) =>
        columns.every((column) => new RegExp(`"?${column.toLowerCase()}"?[,)]`).test(def)),
      );

    expect(hasIndexOn(['deletedAt', 'occurredOn'])).toBe(true);
    expect(hasIndexOn(['deletedAt', 'type', 'occurredOn'])).toBe(true);
    expect(hasIndexOn(['deletedAt', 'categoryId'])).toBe(true);
  });
});
