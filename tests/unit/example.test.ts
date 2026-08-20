import { describe, expect, test } from 'vitest';

describe('example.test.ts', () => {
  test('should fail deliberately', () => {
    // Proves Vitest reports a plain assertion correctly. During the
    // AITJ-M0-06 RED gate this assertion was deliberately wrong
    // (`expect(1).toBe(2)`) to prove the runner detects a failure; it is
    // corrected to a true assertion now that the harness is GREEN.
    expect(1).toBe(1);
  });
});
