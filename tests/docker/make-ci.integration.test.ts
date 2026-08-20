import { execSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

// Integration-level: requires the compose stack to already be buildable and
// startable (see stack.integration.test.ts). Verifies `make ci` runs
// typecheck, lint and test, in that order, against the running app
// container.
const repoRoot = path.resolve(__dirname, '..', '..');

// `docker compose` only auto-loads a file literally named `.env` in the
// project root (never `.env.local`). A fresh checkout has no `.env` — seed
// it from the committed `.env.example` so the suite is reproducible without
// any manual local setup.
function ensureEnvFile(): void {
  const envPath = path.join(repoRoot, '.env');
  const examplePath = path.join(repoRoot, '.env.example');
  if (!existsSync(envPath)) {
    copyFileSync(examplePath, envPath);
  }
}

describe('make > make ci', () => {
  beforeAll(() => {
    ensureEnvFile();
    execSync('docker compose -f docker-compose.yml up -d --build', {
      cwd: repoRoot,
      timeout: 600_000,
    });
  }, 600_000);

  afterAll(() => {
    try {
      execSync('docker compose -f docker-compose.yml down -v', {
        cwd: repoRoot,
        timeout: 60_000,
      });
    } catch {
      // best-effort cleanup
    }
  });

  test(
    'runs typecheck, lint and test in order and exits 0 on success',
    () => {
      const out = execSync('make ci', {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 300_000,
      });

      const typecheckIndex = out.indexOf('tsc');
      const lintIndex = out.indexOf('eslint');
      const testIndex = out.search(/vitest|no test runner/);

      expect(typecheckIndex).toBeGreaterThan(-1);
      expect(lintIndex).toBeGreaterThan(typecheckIndex);
      expect(testIndex).toBeGreaterThan(lintIndex);
    },
    300_000,
  );
});
