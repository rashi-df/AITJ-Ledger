// Seed entry point, wired up by AITJ-M0-05 so the Docker app container has a
// startup hook to call. The full seed logic (default categories, admin
// account, idempotency) is AITJ-M0-07's scope and ships there under its own
// RED -> GREEN cycle; deliberately not implemented here (see AITJ-M0-05
// report / ticket notes).
//
// This stub only validates the environment variables the eventual seed will
// require, so a misconfigured deployment fails loudly at startup (E4 in
// AITJ-M0-07) instead of silently booting with no admin account.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required`);
    process.exit(1);
  }
  return value;
}

function main() {
  const email = requireEnv('SEED_ADMIN_EMAIL');
  const password = requireEnv('SEED_ADMIN_PASSWORD');

  if (password.length < 10) {
    console.error('SEED_ADMIN_PASSWORD must be at least 10 characters');
    process.exit(1);
  }

  console.log(`Seed placeholder OK for ${email} — full seed logic ships in AITJ-M0-07.`);
}

main();
