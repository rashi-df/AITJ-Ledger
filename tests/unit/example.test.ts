import { describe, expect, test } from 'vitest';

describe('example.test.ts', () => {
  test('should fail deliberately', () => {
    // AITJ-M0-06 RED gate: deliberately wrong assertion, proving Vitest
    // detects and reports a failure correctly. Corrected in the GREEN
    // commit once the harness is proven capable of failing.
    expect(1).toBe(2);
  });
});
