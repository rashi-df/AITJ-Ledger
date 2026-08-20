import bcrypt from 'bcryptjs';
import type { PrismaClient, TransactionType } from '@prisma/client';

// Default categories, verbatim from PRD §... FR-C2 (income) / FR-C3
// (expense). Do not reorder, rename or add to these lists without a PRD
// change — the seed's idempotency and the case-insensitive uniqueness
// constraint (AITJ-M0-04) both depend on the exact names below.
export const INCOME_CATEGORIES = [
  'Donation',
  'Zakat',
  'Sadaqah',
  "Jumu'ah Collection",
  'Membership/Contribution',
  'Other',
] as const;

export const EXPENSE_CATEGORIES = [
  'Electricity',
  'Water',
  'Maintenance',
  'Cleaning',
  'Salary/Wages',
  'Construction',
  'Equipment',
  'Events/Programs',
  'Office Expenses',
  'Other',
] as const;

// FR-A10: bcrypt cost 12.
const BCRYPT_COST = 12;

export class SeedConfigError extends Error {}

export interface SeedEnv {
  SEED_ADMIN_EMAIL?: string | undefined;
  SEED_ADMIN_PASSWORD?: string | undefined;
}

/**
 * Validates the admin bootstrap environment variables. Throws
 * `SeedConfigError` with a message safe to print to stderr (never echoes
 * the password itself) if either variable is missing, or the password is
 * shorter than the 10-character minimum (FR-A10).
 */
export function validateAdminEnv(env: SeedEnv): { email: string; password: string } {
  const email = env.SEED_ADMIN_EMAIL;
  if (!email) {
    throw new SeedConfigError('SEED_ADMIN_EMAIL is required');
  }

  const password = env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new SeedConfigError('SEED_ADMIN_PASSWORD is required');
  }
  if (password.length < 10) {
    throw new SeedConfigError('SEED_ADMIN_PASSWORD must be at least 10 characters');
  }

  return { email, password };
}

/**
 * Inserts any category from `names` that does not already exist for
 * `type` (case-insensitively). A single `createMany` with
 * `skipDuplicates: true` compiles to a Postgres `INSERT ... ON CONFLICT DO
 * NOTHING`, which skips on any unique-index conflict — including the
 * functional case-insensitive index from AITJ-M0-04 — in one round trip,
 * with no per-row `await` (no N+1).
 */
async function seedCategories(
  prisma: PrismaClient,
  names: readonly string[],
  type: TransactionType,
): Promise<void> {
  await prisma.category.createMany({
    data: names.map((name) => ({ name, type })),
    skipDuplicates: true,
  });
}

/**
 * Creates the admin account from the seed environment variables, but only
 * on a genuinely empty database (no User rows at all) — first boot only
 * (AC7). Never resets the password or `mustChangePassword` flag of an
 * existing user. A duplicate-email race (two instances booting at once,
 * E10) is resolved by the `User.email` unique constraint: the losing
 * insert throws Prisma's P2002, which is swallowed here since the winner
 * already created the row we wanted.
 */
async function seedAdmin(prisma: PrismaClient, email: string, password: string): Promise<void> {
  const existingUserCount = await prisma.user.count();
  if (existingUserCount > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  try {
    await prisma.user.create({
      data: {
        name: 'Admin',
        email,
        passwordHash,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    const isUniqueViolation =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002';
    if (!isUniqueViolation) {
      throw error;
    }
  }
}

/**
 * Runs the full seed: validates the admin environment, seeds the default
 * categories, seeds the admin account on first boot only. Safe to call
 * repeatedly against the same database (idempotent — AC6).
 */
export async function runSeed(prisma: PrismaClient, env: SeedEnv): Promise<void> {
  const { email, password } = validateAdminEnv(env);

  await seedCategories(prisma, INCOME_CATEGORIES, 'INCOME');
  await seedCategories(prisma, EXPENSE_CATEGORIES, 'EXPENSE');
  await seedAdmin(prisma, email, password);
}
