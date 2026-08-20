import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from './container';
import { createTestCategory, createTestUser, uniqueEmail, uniqueName } from './fixtures';

describe('schema > models.test.ts', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const databaseUrl = await getDatabaseUrl();
    runMigrateDeploy(databaseUrl);
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('User model', async () => {
    const email = uniqueEmail();
    const created = await createTestUser(prisma, { email });

    const found = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });

    expect(found.email).toBe(email);
    expect(found.createdAt).toBeInstanceOf(Date);

    await expect(createTestUser(prisma, { email })).rejects.toThrow();
  });

  test('Category model', async () => {
    const name = uniqueName('groceries');
    const created = await createTestCategory(prisma, 'INCOME', { name });

    const found = await prisma.category.findUniqueOrThrow({ where: { id: created.id } });

    expect(found.name).toBe(name);
    expect(found.type).toBe('INCOME');
    expect(found.isArchived).toBe(false);
    expect(found.sortOrder).toBe(0);
  });

  test('Transaction model', async () => {
    const user = await createTestUser(prisma);
    const category = await createTestCategory(prisma, 'INCOME');

    const created = await prisma.transaction.create({
      data: {
        type: 'INCOME',
        amount: '1234.56',
        occurredOn: new Date('2026-08-19'),
        categoryId: category.id,
        createdById: user.id,
      },
    });

    const found = await prisma.transaction.findUniqueOrThrow({ where: { id: created.id } });

    expect(found.amount).toBeInstanceOf(Prisma.Decimal);
    expect(found.amount.toString()).toBe('1234.56');
  });

  test('Transaction.amount precision', async () => {
    const user = await createTestUser(prisma);
    const category = await createTestCategory(prisma, 'EXPENSE');

    const created = await prisma.transaction.create({
      data: {
        type: 'EXPENSE',
        amount: '99999999999.99',
        occurredOn: new Date('2026-08-19'),
        categoryId: category.id,
        createdById: user.id,
      },
    });

    const found = await prisma.transaction.findUniqueOrThrow({ where: { id: created.id } });

    expect(found.amount.toString()).toBe('99999999999.99');
  });

  test('Transaction.occurredOn is DATE', async () => {
    const user = await createTestUser(prisma);
    const category = await createTestCategory(prisma, 'INCOME');

    const created = await prisma.transaction.create({
      data: {
        type: 'INCOME',
        amount: '10.00',
        occurredOn: new Date('2026-08-19'),
        categoryId: category.id,
        createdById: user.id,
      },
    });

    const found = await prisma.transaction.findUniqueOrThrow({ where: { id: created.id } });

    expect(found.occurredOn.toISOString().slice(0, 10)).toBe('2026-08-19');

    const columns = await prisma.$queryRawUnsafe<{ data_type: string }[]>(
      `SELECT data_type FROM information_schema.columns WHERE table_name = 'Transaction' AND column_name = 'occurredOn'`,
    );

    expect(columns[0].data_type).toBe('date');
  });
});
