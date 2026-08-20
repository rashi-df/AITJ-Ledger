import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');
const composeFile = path.join(repoRoot, 'docker-compose.yml');

describe('docker > docker-compose.yml', () => {
  test('should exist', () => {
    expect(existsSync(composeFile)).toBe(true);
  });

  test('is valid YAML', () => {
    expect(existsSync(composeFile)).toBe(true);

    expect(() =>
      execSync('docker compose -f docker-compose.yml config', {
        cwd: repoRoot,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
