import { describe, expect, test } from 'vitest';
import { z } from 'zod';

describe('zod > should validate a schema', () => {
  test('parses a valid object and rejects an invalid one', () => {
    const schema = z.object({ name: z.string().min(1) });

    // AITJ-M0-06 RED gate: deliberately wrong assertion (a valid object is
    // expected NOT to match itself), proving Vitest detects a Zod-schema
    // failure correctly. Corrected in the GREEN commit.
    expect(schema.parse({ name: 'AITJ Ledger' })).toEqual({ name: 'wrong value' });
    expect(() => schema.parse({ name: '' })).toThrow();
  });
});
