import { describe, expect, test } from 'vitest';
import { emailSchema, loginSchema, passwordSchema } from '../../../lib/validation/auth';

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

// T9 (AITJ-M1-02): email lookups and rate-limit keys must be
// case-insensitive (E6) — normalize before either happens.
describe('email normalization', () => {
  test('mixed-case email normalized to lowercase', () => {
    const result = emailSchema.safeParse('Test@Example.COM');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('test@example.com');
    }
  });

  test('rejects an empty email', () => {
    expect(emailSchema.safeParse('').success).toBe(false);
  });

  test('rejects a malformed email', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('loginSchema', () => {
  test('rejects an empty email (E7)', () => {
    const result = loginSchema.safeParse({ email: '', password: 'a'.repeat(10) });
    expect(result.success).toBe(false);
  });

  test('rejects an empty password (E8)', () => {
    const result = loginSchema.safeParse({ email: 'admin@aitj.local', password: '' });
    expect(result.success).toBe(false);
  });

  test('normalizes email to lowercase on success', () => {
    const result = loginSchema.safeParse({ email: 'Admin@AITJ.local', password: 'a'.repeat(10) });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('admin@aitj.local');
    }
  });
});
