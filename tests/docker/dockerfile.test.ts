import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');
const dockerfile = path.join(repoRoot, 'Dockerfile');
const dockerignore = path.join(repoRoot, '.dockerignore');

describe('docker > Dockerfile', () => {
  test('should exist', () => {
    expect(existsSync(dockerfile)).toBe(true);
  });

  test('is valid (three named build stages, no syntax errors)', () => {
    expect(existsSync(dockerfile)).toBe(true);

    expect(() =>
      execSync('docker build --check .', {
        cwd: repoRoot,
        stdio: 'pipe',
      }),
    ).not.toThrow();

    const contents = readFileSync(dockerfile, 'utf-8');
    expect(contents).toMatch(/AS deps/i);
    expect(contents).toMatch(/AS builder/i);
    expect(contents).toMatch(/AS runner/i);
  });

  test('corepack caches the pinned pnpm binary somewhere the nextjs user can read', () => {
    const contents = readFileSync(dockerfile, 'utf-8');

    // The nextjs user is what actually runs `docker compose exec app pnpm ...`
    // at exec time. If corepack's download cache is left under root's
    // default HOME (/root/.cache/...), that directory is mode 0700 and the
    // nextjs user cannot read it, so pnpm silently re-downloads itself from
    // registry.npmjs.org on every exec — breaking every make tooling target
    // in a network-isolated environment. Guard against regressing to that:
    // corepack must either run as the nextjs user, or be pointed at a
    // COREPACK_HOME the nextjs user owns.
    const runsAsNextjsBeforeCorepack =
      /USER\s+nextjs[\s\S]*RUN[^\n]*corepack prepare/i.test(contents);
    const setsOwnedCorepackHome =
      /ENV\s+COREPACK_HOME=\/home\/nextjs\/[^\s]+/.test(contents) &&
      /RUN[^\n]*corepack prepare/i.test(contents);

    expect(runsAsNextjsBeforeCorepack || setsOwnedCorepackHome).toBe(true);

    if (setsOwnedCorepackHome) {
      // The COREPACK_HOME directory must exist and be owned by nextjs
      // *before* corepack writes into it at build time.
      expect(contents).toMatch(/chown[^\n]*nextjs[^\n]*\/home\/nextjs/i);
    }
  });

  test('nextjs user is created with nodejs as its primary group', () => {
    const contents = readFileSync(dockerfile, 'utf-8');
    expect(contents).toMatch(/adduser\s+-S\s+nextjs\s+-u\s+1001\s+-G\s+nodejs/);
  });

  test('builder stage (next build) succeeds without AUTH_SECRET/AUTH_URL in the build context', () => {
    // AITJ-M1-01 round 2: `next build`'s "Collecting page data" step imports
    // every route handler, including app/api/auth/[...nextauth]/route.ts.
    // `.dockerignore` excludes `.env`, so AUTH_SECRET/AUTH_URL are never
    // present in the build context (they're runtime-only env, injected by
    // docker-compose.yml). If `lib/auth/config.ts` ever goes back to
    // validating those eagerly at module-evaluation time (rather than
    // lazily, on first real request), this build fails outright with
    // "Error: AUTH_SECRET is required" during page-data collection, before
    // a single request is ever served.
    expect(() =>
      execSync('docker build --target builder -t aitj-ledger-builder-check .', {
        cwd: repoRoot,
        stdio: 'pipe',
        timeout: 5 * 60 * 1000,
      }),
    ).not.toThrow();
  });

  test('exec into a network-isolated app container still resolves pnpm without a registry call', () => {
    execSync('docker build --target runner -t aitj-ledger-corepack-check .', {
      cwd: repoRoot,
      stdio: 'pipe',
      timeout: 5 * 60 * 1000,
    });

    execSync(
      'docker run -d --name aitj-ledger-corepack-check --network none aitj-ledger-corepack-check sh -c "sleep 30"',
      { cwd: repoRoot, stdio: 'pipe' },
    );

    try {
      const output = execSync(
        'docker exec aitj-ledger-corepack-check pnpm --version',
        { cwd: repoRoot, stdio: 'pipe' },
      ).toString();
      expect(output).toMatch(/9\.15\.9/);
    } finally {
      execSync('docker rm -f aitj-ledger-corepack-check', { stdio: 'pipe' });
    }
  });
});

describe('docker > .dockerignore', () => {
  test('does not carry the stale .env.local.example negation', () => {
    const contents = readFileSync(dockerignore, 'utf-8');
    expect(contents).not.toMatch(/\.env\.local\.example/);
  });
});
