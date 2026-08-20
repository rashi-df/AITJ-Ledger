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

    // Each name below is suffixed with a fresh random id (via uniqueName)
    // rather than left as a bare literal. The real seed data (AITJ-M0-07)
    // creates its own "Other"/"Water"/"Electricity" categories with these
    // exact literal names, and this suite may run against the live
    // Compose `db` service (see tests/integration/global-setup.ts's
    // truncate guard) where that real data is present and must not be
    // touched — a bare literal here would collide with it on the same
    // case-insensitive (name, type) uniqueness this test is verifying.
    // The suffix is lowercase hex from randomUUID, so it does not affect
    // the case-sensitivity being tested.

    test('income "Other" + expense "Other" allowed', async () => {
      const name = uniqueName('Other');
      await createTestCategory(prisma, 'INCOME', { name });
      const expenseOther = await createTestCategory(prisma, 'EXPENSE', { name });

      expect(expenseOther.name).toBe(name);
    });

    test('expense "Water" then "water" rejected', async () => {
      const suffix = uniqueName('');
      await createTestCategory(prisma, 'EXPENSE', { name: `Water${suffix}` });

      await expect(
        createTestCategory(prisma, 'EXPENSE', { name: `water${suffix}` }),
      ).rejects.toThrow();
    });

    test('expense "Electricity" then "ELECTRICITY" rejected', async () => {
      const suffix = uniqueName('');
      await createTestCategory(prisma, 'EXPENSE', { name: `Electricity${suffix}` });

      await expect(
        createTestCategory(prisma, 'EXPENSE', { name: `ELECTRICITY${suffix}` }),
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
