import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startPostgresContainer } from './container';

describe('database.test.ts', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const databaseUrl = await startPostgresContainer();
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should fail deliberately', async () => {
    const rows = await prisma.$queryRawUnsafe<{ answer: number }[]>('SELECT 1 AS answer');

    expect(rows[0].answer).toBe(1);
  });

  test('should connect to Testcontainers Postgres', async () => {
    const rows = await prisma.$queryRawUnsafe<{ version: string }[]>('SELECT version() AS version');

    expect(rows[0].version).toContain('PostgreSQL 16');
  });
});
