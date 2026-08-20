import { defineConfig } from 'vitest/config';

// AITJ-M0-06's formal unit/integration split. `unit` runs fast, in
// parallel, with no external services. `integration` needs a real
// Postgres 16 (via Testcontainers) and is serialized so the
// `tests/schema/` and `tests/integration/` container helpers -- each a
// module-level singleton shared across the test files in their own
// directory -- survive across files instead of racing each other.
//
// `tests/docker/` (AITJ-M0-05) is deliberately NOT included here: those
// tests shell out to the real `docker`/`make` CLIs and read `.env.example`
// from the repo root, none of which exist inside the `app` container that
// `make test`/`make ci` exec into. They stay host-only, run directly via
// `pnpm exec vitest run tests/docker`.
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          sequence: { groupOrder: 0 },
          // AITJ-M1-01: see the identical setting below for why `next`
          // must be inlined wherever a test (transitively) imports
          // next-auth.
          server: { deps: { inline: ['next'] } },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts', 'tests/schema/**/*.test.ts'],
          environment: 'node',
          testTimeout: 120_000,
          hookTimeout: 120_000,
          fileParallelism: false,
          isolate: false,
          sequence: { groupOrder: 1 },
          globalSetup: ['tests/integration/global-setup.ts'],
          // AITJ-M1-01: next-auth's `lib/env.js` imports the bare
          // specifier `next/server`, which Next.js's own bundlers resolve
          // via a custom condition but Vite's default resolver cannot
          // (nextauthjs/next-auth#12280). Inlining `next` makes Vite
          // process it (and its subpath imports) as source instead of an
          // externalized dependency, which resolves correctly.
          server: { deps: { inline: ['next'] } },
        },
      },
    ],
  },
});
