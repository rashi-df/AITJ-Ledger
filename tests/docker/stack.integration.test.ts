import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

// Integration-level: brings up the real compose stack against a built image.
// Slow — building the Next.js standalone image and waiting for both health
// checks to go green can take a couple of minutes on a cold cache.
const repoRoot = path.resolve(__dirname, '..', '..');
const COMPOSE = ['compose', '-f', 'docker-compose.yml'];

function compose(args: string[], opts: { timeout?: number } = {}): string {
  return execFileSync('docker', [...COMPOSE, ...args], {
    cwd: repoRoot,
    encoding: 'utf-8',
    timeout: opts.timeout ?? 120_000,
  });
}

function waitForHealthy(service: string, timeoutMs: number): void {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = '';

  while (Date.now() < deadline) {
    const id = compose(['ps', '-q', service]).trim();
    if (id) {
      lastStatus = execSync(
        `docker inspect --format='{{.State.Health.Status}}' ${id}`,
        { encoding: 'utf-8' },
      ).trim();
      if (lastStatus === 'healthy') {
        return;
      }
    }
    execSync('sleep 2');
  }

  throw new Error(`service "${service}" never became healthy (last status: ${lastStatus})`);
}

describe('docker > stack integration', () => {
  beforeAll(() => {
    compose(['up', '-d', '--build'], { timeout: 600_000 });
  }, 600_000);

  afterAll(() => {
    try {
      compose(['down', '-v'], { timeout: 60_000 });
    } catch {
      // best-effort cleanup
    }
  });

  test(
    'services should start and be healthy',
    () => {
      waitForHealthy('db', 60_000);
      waitForHealthy('app', 120_000);
    },
    180_000,
  );

  test('database should accept connections', () => {
    const out = execSync(
      'docker compose -f docker-compose.yml exec -T db pg_isready -U postgres',
      { cwd: repoRoot, encoding: 'utf-8' },
    );
    expect(out).toMatch(/accepting connections/);
  });

  test('app healthcheck endpoint should respond 2xx', () => {
    const out = execSync(
      `docker compose -f docker-compose.yml exec -T app curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health`,
      { cwd: repoRoot, encoding: 'utf-8' },
    );
    const status = Number(out.trim());
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(300);
  });
});
