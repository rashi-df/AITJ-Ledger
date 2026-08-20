import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from './container';
import { createTestCategory, createTestUser } from './fixtures';

describe('schema > relations.test.ts', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const databaseUrl = await getDatabaseUrl();
    runMigrateDeploy(databaseUrl);
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Transaction.category relation', async () => {
    const user = await createTestUser(prisma);
    const category = await createTestCategory(prisma, 'INCOME');

    const transaction = await prisma.transaction.create({
      data: {
        type: 'INCOME',
        amount: '42.00',
        occurredOn: new Date('2026-08-19'),
        categoryId: category.id,
        createdById: user.id,
      },
    });

    const found = await prisma.transaction.findUniqueOrThrow({
      where: { id: transaction.id },
      include: { category: true },
    });

    expect(found.category.id).toBe(category.id);
    expect(found.category.name).toBe(category.name);
  });

  test('User relations', async () => {
    const user = await createTestUser(prisma);

    const invite = await prisma.invite.create({
      data: {
        email: 'invitee@example.test',
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        invitedById: user.id,
      },
    });

    const found = await prisma.invite.findUniqueOrThrow({
      where: { id: invite.id },
      include: { invitedBy: true },
    });

    expect(found.invitedBy.id).toBe(user.id);
    expect(found.invitedBy.email).toBe(user.email);
  });
});
