import type { PrismaClient } from '@prisma/client';

export const INCOME_CATEGORIES: readonly string[] = [];

export const EXPENSE_CATEGORIES: readonly string[] = [];

export class SeedConfigError extends Error {}

export interface SeedEnv {
  SEED_ADMIN_EMAIL?: string | undefined;
  SEED_ADMIN_PASSWORD?: string | undefined;
}

// RED stub — deliberately not implemented yet (AITJ-M0-07).
export function validateAdminEnv(_env: SeedEnv): { email: string; password: string } {
  throw new SeedConfigError('not implemented');
}

// RED stub — deliberately not implemented yet (AITJ-M0-07).
export async function runSeed(_prisma: PrismaClient, _env: SeedEnv): Promise<void> {
  return;
}
