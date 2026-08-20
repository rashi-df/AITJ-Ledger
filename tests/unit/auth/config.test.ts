import { describe, expect, test } from 'vitest';
import { assertAuthEnv, AuthConfigError, buildAuthConfig } from '../../../lib/auth/config';

const ENV = { AUTH_SECRET: 'x'.repeat(32), AUTH_URL: 'http://localhost:3000' };

describe('assertAuthEnv', () => {
  test('throws if AUTH_SECRET is missing', () => {
    expect(() => assertAuthEnv({ AUTH_URL: 'http://localhost:3000' })).toThrow(AuthConfigError);
  });

  test('throws if AUTH_URL is missing', () => {
    expect(() => assertAuthEnv({ AUTH_SECRET: 'x'.repeat(32) })).toThrow(AuthConfigError);
  });
});

describe('password hash > never returned in serialized context', () => {
  test('session callback excludes passwordHash from the serialized session', async () => {
    const config = buildAuthConfig(ENV);
    const sessionCallback = config.callbacks?.session;
    expect(sessionCallback).toBeDefined();

    const fakeSession = {
      user: { name: 'Admin', email: 'admin@aitj.local', passwordHash: 'should-not-leak' },
      expires: new Date(Date.now() + 1000).toISOString(),
    };
    const fakeToken = { id: 'user-1' };

    // next-auth's `session` callback type is an intersection of its
    // database-strategy and JWT-strategy parameter shapes (so it type-checks
    // for both at once); a JWT-strategy-only call site can never literally
    // satisfy it. Cast through `unknown` to the callback's own declared
    // parameter type rather than reshaping our fake session/token to match
    // an irrelevant database-adapter shape.
    type SessionCallbackParams = Parameters<NonNullable<typeof sessionCallback>>[0];
    const result = await sessionCallback!({
      session: fakeSession,
      token: fakeToken,
    } as unknown as SessionCallbackParams);

    expect(JSON.stringify(result)).not.toContain('should-not-leak');
    expect((result.user as { passwordHash?: string }).passwordHash).toBeUndefined();
  });
});
