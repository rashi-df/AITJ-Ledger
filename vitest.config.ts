import { defineConfig } from 'vitest/config';

// Ad hoc Vitest config for AITJ-M0-03's schema integration tests. This will
// be superseded by the formal harness in AITJ-M0-06 (unit/integration/e2e
// split, Playwright wiring, viewport presets). For now it only needs to run
// the schema test suite against a real Postgres 16 Testcontainer.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // A single Postgres container is shared across all schema test files
    // (see tests/schema/container.ts); disabling isolation and parallel
    // file execution lets that module-level singleton survive across files.
    fileParallelism: false,
    isolate: false,
  },
});
