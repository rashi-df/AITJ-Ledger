import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from './container';
import { createTestCategory, createTestUser, uniqueName } from './fixtures';

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

  describe('case-insensitive uniqueness', () => {
    test('old case-sensitive Category_name_type_key index is dropped', async () => {
      const rows = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'Category'`,
      );
      const indexNames = rows.map((row) => row.indexname);

      expect(indexNames).not.toContain('Category_name_type_key');
      expect(indexNames).toContain('Category_name_type_lower_key');
    });

    test('income "Other" + expense "Other" allowed', async () => {
      await createTestCategory(prisma, 'INCOME', { name: 'Other' });
      const expenseOther = await createTestCategory(prisma, 'EXPENSE', { name: 'Other' });

      expect(expenseOther.name).toBe('Other');
    });

    test('expense "Water" then "water" rejected', async () => {
      await createTestCategory(prisma, 'EXPENSE', { name: 'Water' });

      await expect(createTestCategory(prisma, 'EXPENSE', { name: 'water' })).rejects.toThrow();
    });

    test('expense "Electricity" then "ELECTRICITY" rejected', async () => {
      await createTestCategory(prisma, 'EXPENSE', { name: 'Electricity' });

      await expect(
        createTestCategory(prisma, 'EXPENSE', { name: 'ELECTRICITY' }),
      ).rejects.toThrow();
    });
  });

  describe('type check constraint', () => {
    test('transaction type must match category type', async () => {
      const user = await createTestUser(prisma);
      const donation = await createTestCategory(prisma, 'INCOME', { name: uniqueName('Donation') });

      await expect(
        prisma.transaction.create({
          data: {
            type: 'EXPENSE',
            amount: '500.00',
            occurredOn: new Date('2026-08-19'),
            categoryId: donation.id,
            createdById: user.id,
          },
        }),
      ).rejects.toThrow();
    });

    test('income transaction with income category succeeds', async () => {
      const user = await createTestUser(prisma);
      const donation = await createTestCategory(prisma, 'INCOME', { name: uniqueName('Donation') });

      const transaction = await prisma.transaction.create({
        data: {
          type: 'INCOME',
          amount: '500.55',
          occurredOn: new Date('2026-08-19'),
          categoryId: donation.id,
          createdById: user.id,
        },
      });

      expect(transaction.amount.toString()).toBe('500.55');
    });

    test('expense transaction with expense category succeeds', async () => {
      const user = await createTestUser(prisma);
      const electricity = await createTestCategory(prisma, 'EXPENSE', {
        name: uniqueName('Electricity'),
      });

      const transaction = await prisma.transaction.create({
        data: {
          type: 'EXPENSE',
          amount: '2000.25',
          occurredOn: new Date('2026-08-19'),
          categoryId: electricity.id,
          createdById: user.id,
        },
      });

      expect(transaction.amount.toString()).toBe('2000.25');
    });
  });
});
