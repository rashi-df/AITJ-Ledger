import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from './container';
import { createTestCategory, createTestUser } from './fixtures';

describe('schema > constraints.test.ts', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const databaseUrl = await getDatabaseUrl();
    runMigrateDeploy(databaseUrl);
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('onDelete Restrict', async () => {
    const user = await createTestUser(prisma);
    const category = await createTestCategory(prisma, 'EXPENSE');

    await prisma.transaction.create({
      data: {
        type: 'EXPENSE',
        amount: '5.00',
        occurredOn: new Date('2026-08-19'),
        categoryId: category.id,
        createdById: user.id,
      },
    });

    await expect(prisma.category.delete({ where: { id: category.id } })).rejects.toThrow();

    const stillThere = await prisma.category.findUnique({ where: { id: category.id } });
    expect(stillThere).not.toBeNull();
  });
});
