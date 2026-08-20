import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');
const makefilePath = path.join(repoRoot, 'Makefile');

// AC15 — must match the command table in CLAUDE.md exactly.
const REQUIRED_TARGETS = [
  'up',
  'down',
  'shell',
  'migrate',
  'fresh',
  'seed',
  'test',
  'test-unit',
  'test-e2e',
  'typecheck',
  'lint',
  'ci',
  'psql',
  'logs',
  'ps',
];

// Targets that must never invoke tooling directly on the host — every
// command line under them must be wrapped in `docker compose exec app`.
const TOOLING_TARGETS = [
  'migrate',
  'fresh',
  'seed',
  'test',
  'test-unit',
  'test-e2e',
  'typecheck',
  'lint',
  'ci',
];

function parseTargets(makefile: string): Map<string, string[]> {
  const lines = makefile.split('\n');
  const targets = new Map<string, string[]>();
  let current: string | null = null;

  for (const line of lines) {
    const targetMatch = /^([a-zA-Z0-9_.-]+):/.exec(line);
    if (targetMatch && !line.startsWith('\t')) {
      current = targetMatch[1];
      if (current !== '.PHONY') {
        targets.set(current, []);
      }
      continue;
    }
    if (line.startsWith('\t') && current && targets.has(current)) {
      targets.get(current)!.push(line.trim());
    }
  }

  return targets;
}

describe('make > Makefile', () => {
  test('should exist', () => {
    expect(existsSync(makefilePath)).toBe(true);
  });

  test('defines every documented target and lists each in .PHONY', () => {
    expect(existsSync(makefilePath)).toBe(true);

    const contents = readFileSync(makefilePath, 'utf-8');
    const targets = parseTargets(contents);
    const phonyMatch = /\.PHONY:\s*(.+(?:\n\s+.+)*)/.exec(contents);
    const phonyTargets = phonyMatch
      ? phonyMatch[1]
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    for (const target of REQUIRED_TARGETS) {
      expect(targets.has(target), `missing target: ${target}`).toBe(true);
      expect(phonyTargets, `target not declared .PHONY: ${target}`).toContain(target);
    }
  });

  test('tooling targets run every command inside the app container', () => {
    expect(existsSync(makefilePath)).toBe(true);

    const contents = readFileSync(makefilePath, 'utf-8');
    const targets = parseTargets(contents);

    for (const target of TOOLING_TARGETS) {
      const recipe = targets.get(target);
      expect(recipe, `missing target: ${target}`).toBeDefined();
      const toolingLines = (recipe ?? []).filter((line) =>
        /\b(node|pnpm|prisma|vitest|playwright)\b/.test(line),
      );

      for (const line of toolingLines) {
        expect(
          line,
          `target "${target}" runs tooling outside the container: ${line}`,
        ).toMatch(/docker compose exec app/);
      }
    }
  });
});
