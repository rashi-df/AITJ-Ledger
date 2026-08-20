// Seed entry point, run by the Docker container's entrypoint (AITJ-M0-05)
// after migrations and before the server starts, and available via
// `pnpm seed` for local/manual use. Boots the database with the default
// categories and the first admin account (NFR-10). The actual seeding
// logic lives in `prisma/seed-lib.ts` so it can be imported and exercised
// directly from tests without spawning a subprocess for every case; this
// file is deliberately a thin script wrapper around it so the
// `process.exit` calls it makes are only reachable when actually run as a
// script (see tests/integration/seed.test.ts, which execs this file as a
// subprocess to test that behaviour for real).
import { PrismaClient } from '@prisma/client';
import { runSeed, SeedConfigError } from './seed-lib';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await runSeed(prisma, {
      SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
      SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
    });
    console.log('Seed completed: default categories and admin account are in place.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof SeedConfigError) {
    console.error(error.message);
  } else {
    console.error('Seed failed:', error);
  }
  process.exit(1);
});
