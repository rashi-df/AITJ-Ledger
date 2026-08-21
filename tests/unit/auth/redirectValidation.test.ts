import { describe, expect, test } from 'vitest';
import { isValidRedirect } from '../../../lib/auth/redirectValidation';

// AITJ-M1-03. `isValidRedirect` is the single gate every candidate
// post-login/pre-login redirect destination passes through (AC5) --
// shared by middleware.ts (unauthenticated access) and
// actions/auth/login.ts (post-login).
describe('redirectValidation.test.ts', () => {
  test('T7: redirect validation > external URL rejected', () => {
    expect(isValidRedirect('https://attacker.com')).toBe(false);
  });

  test('T8: redirect validation > relative in-app path accepted', () => {
    expect(isValidRedirect('/dashboard')).toBe(true);
    expect(isValidRedirect('/income')).toBe(true);
    expect(isValidRedirect('/reports')).toBe(true);
  });

  test('T9: redirect validation > path traversal with ../ sanitized or rejected', () => {
    expect(isValidRedirect('../../etc/passwd')).toBe(false);
  });

  test('T10: redirect validation > URL-encoded path decoded and validated', () => {
    expect(isValidRedirect('%2Fdashboard')).toBe(true);
  });

  test('E3/E4: protocol-prefixed URLs rejected', () => {
    expect(isValidRedirect('https://attacker.com')).toBe(false);
    expect(isValidRedirect('http://example.com/dashboard')).toBe(false);
  });

  test('protocol-relative URL ("//host") rejected', () => {
    expect(isValidRedirect('//attacker.com')).toBe(false);
  });

  test('E9: /login rejected to prevent a post-login redirect loop', () => {
    expect(isValidRedirect('/login')).toBe(false);
  });

  test('unknown app-shaped path rejected (not on the allowlist)', () => {
    expect(isValidRedirect('/not-a-real-route')).toBe(false);
  });

  test('empty string rejected', () => {
    expect(isValidRedirect('')).toBe(false);
  });

  test('malformed percent-encoding rejected rather than throwing', () => {
    expect(isValidRedirect('%')).toBe(false);
  });
});
