import { PrismaClient } from '@prisma/client';

// Prisma client singleton (§8.2). Next.js dev mode hot-reloads modules on
// every save, which would otherwise construct a new PrismaClient (and a
// new connection pool) per reload; stashing the instance on `globalThis`
// outside production reuses the same client across reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
