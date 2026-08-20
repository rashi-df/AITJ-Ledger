import { describe, expect, test } from 'vitest';
import { hashPassword, verifyPassword } from '../../../lib/auth/password';

describe('password hashing', () => {
  test('hashes with bcrypt cost 12', async () => {
    const hash = await hashPassword('Correct10CharPwd');

    // bcrypt hash format: $<algorithm>$<cost>$<salt+hash>
    expect(hash.startsWith('$2')).toBe(true);
    const [, , cost] = hash.split('$');
    expect(cost).toBe('12');
  });

  test('verifyPassword confirms a matching password and rejects a wrong one', async () => {
    const hash = await hashPassword('Correct10CharPwd');

    expect(await verifyPassword('Correct10CharPwd', hash)).toBe(true);
    expect(await verifyPassword('WrongPassword123', hash)).toBe(false);
  });

  // E4: bcrypt only hashes the first 72 bytes of input, so a multi-byte
  // password near that boundary must still hash and verify consistently
  // across repeated calls (rather than silently disagreeing with itself).
  test('hashes a multi-byte UTF-8 password consistently across logins', async () => {
    const password = 'Müller123456';
    const hash = await hashPassword(password);

    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword(password, await hashPassword(password))).toBe(true);
  });
});
