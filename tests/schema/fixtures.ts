import { randomUUID } from 'node:crypto';
import type { PrismaClient, TransactionType } from '@prisma/client';

// The Testcontainers database is shared across every test in this
// directory (see container.ts), so every fixture uses a random suffix to
// avoid colliding with unique constraints (User.email, Category
// [name, type]) created by other tests in the same run.

export function uniqueEmail(): string {
  return `test-${randomUUID()}@example.test`;
}

export function uniqueName(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function createTestUser(prisma: PrismaClient, overrides: { email?: string } = {}) {
  return prisma.user.create({
    data: {
      name: 'Test User',
      email: overrides.email ?? uniqueEmail(),
      passwordHash: 'not-a-real-hash',
    },
  });
}

export function createTestCategory(
  prisma: PrismaClient,
  type: TransactionType,
  overrides: { name?: string } = {},
) {
  return prisma.category.create({
    data: {
      name: overrides.name ?? uniqueName('category'),
      type,
    },
  });
}
