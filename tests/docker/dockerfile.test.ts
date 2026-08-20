import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');
const dockerfile = path.join(repoRoot, 'Dockerfile');

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
});
