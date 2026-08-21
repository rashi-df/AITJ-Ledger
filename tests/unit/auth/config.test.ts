import { describe, expect, test, vi } from 'vitest';
import * as passwordModule from '../../../lib/auth/password';
import * as userRepository from '../../../lib/repositories/user';

vi.mock('../../../lib/repositories/user', () => ({
  findUserForLogin: vi.fn(),
}));

vi.mock('../../../lib/auth/password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth/password')>();
  return {
    ...actual,
    verifyPassword: vi.fn(actual.verifyPassword),
  };
});

const { assertAuthEnv, AuthConfigError, buildAuthConfig } = await import('../../../lib/auth/config');
type NextAuthConfig = ReturnType<typeof buildAuthConfig>;

const ENV = { AUTH_SECRET: 'x'.repeat(32), AUTH_URL: 'http://localhost:3000' };

/**
 * `Credentials(config)` (see @auth/core/providers/credentials) does not
 * expose the `authorize` we pass it directly on the returned provider —
 * it hard-codes `authorize: () => null` and stashes our actual config
 * (including our `authorize`) under `.options`, to be merged later by
 * `NextAuth()` itself. Since `buildAuthConfig()` returns the pre-merge
 * config, the callback under test lives at `providers[0].options.authorize`.
 */
function getAuthorize(config: NextAuthConfig) {
  const provider = config.providers[0] as unknown as {
    options?: { authorize?: (credentials: Record<string, unknown>) => Promise<unknown> };
  };
  const authorize = provider.options?.authorize;
  if (!authorize) {
    throw new Error('authorize callback not found on credentials provider');
  }
  return authorize;
}

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

describe('authorize > constant-time auth failure (no email-existence timing leak)', () => {
  test('runs a bcrypt compare even when no user is found for the email', async () => {
    vi.mocked(userRepository.findUserForLogin).mockResolvedValue(null);
    const verifyPasswordSpy = vi.mocked(passwordModule.verifyPassword);
    verifyPasswordSpy.mockClear();

    const config = buildAuthConfig(ENV);
    const authorize = getAuthorize(config);

    const result = await authorize({ email: 'nobody@aitj.local', password: 'wrong-password-123' });

    expect(result).toBeNull();
    // FR-A1/NFR: the "no such email" path must do the same bcrypt work as
    // the "wrong password" path, or response timing reveals whether the
    // email is registered even though the returned error is generic.
    expect(verifyPasswordSpy).toHaveBeenCalledTimes(1);
  });

  test('runs a bcrypt compare against the real hash when the user is found but the password is wrong', async () => {
    vi.mocked(userRepository.findUserForLogin).mockResolvedValue({
      id: 'user-1',
      name: 'Admin',
      email: 'admin@aitj.local',
      passwordHash: '$2b$12$4M6ZLf0gTl5QMWpT0xoW.u35MJuJ9rmSpdGso/W9OnoWCvVTj8twC',
      mustChangePassword: false,
    });
    const verifyPasswordSpy = vi.mocked(passwordModule.verifyPassword);
    verifyPasswordSpy.mockClear();

    const config = buildAuthConfig(ENV);
    const authorize = getAuthorize(config);

    const result = await authorize({ email: 'admin@aitj.local', password: 'wrong-password-123' });

    expect(result).toBeNull();
    expect(verifyPasswordSpy).toHaveBeenCalledTimes(1);
  });

  test('the "no such email" path and the "wrong password" path invoke verifyPassword the same number of times', async () => {
    const verifyPasswordSpy = vi.mocked(passwordModule.verifyPassword);
    const config = buildAuthConfig(ENV);
    const authorize = getAuthorize(config);

    vi.mocked(userRepository.findUserForLogin).mockResolvedValue(null);
    verifyPasswordSpy.mockClear();
    await authorize({ email: 'nobody@aitj.local', password: 'wrong-password-123' });
    const noSuchEmailCalls = verifyPasswordSpy.mock.calls.length;

    vi.mocked(userRepository.findUserForLogin).mockResolvedValue({
      id: 'user-1',
      name: 'Admin',
      email: 'admin@aitj.local',
      passwordHash: '$2b$12$4M6ZLf0gTl5QMWpT0xoW.u35MJuJ9rmSpdGso/W9OnoWCvVTj8twC',
      mustChangePassword: false,
    });
    verifyPasswordSpy.mockClear();
    await authorize({ email: 'admin@aitj.local', password: 'wrong-password-123' });
    const wrongPasswordCalls = verifyPasswordSpy.mock.calls.length;

    expect(noSuchEmailCalls).toBe(wrongPasswordCalls);
  });
});
