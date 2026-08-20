import { describe, expect, test } from 'vitest';
import { z } from 'zod';

describe('zod > should validate a schema', () => {
  test('parses a valid object and rejects an invalid one', () => {
    const schema = z.object({ name: z.string().min(1) });

    expect(schema.parse({ name: 'AITJ Ledger' })).toEqual({ name: 'AITJ Ledger' });
    expect(() => schema.parse({ name: '' })).toThrow();
  });
});
