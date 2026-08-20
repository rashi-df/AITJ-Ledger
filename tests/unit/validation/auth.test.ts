import { describe, expect, test } from 'vitest';
import { passwordSchema } from '../../../lib/validation/auth';

describe('password validation', () => {
  test('rejects password < 10 chars', () => {
    expect(passwordSchema.safeParse('a'.repeat(9)).success).toBe(false);
  });

  test('rejects password > 72 chars', () => {
    expect(passwordSchema.safeParse('a'.repeat(73)).success).toBe(false);
  });

  test('accepts password exactly 10 chars', () => {
    expect(passwordSchema.safeParse('a'.repeat(10)).success).toBe(true);
  });

  test('accepts password exactly 72 chars', () => {
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true);
  });
});
