import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from '../../schema/container';
import { uniqueEmail } from '../../schema/fixtures';
import { hashPassword } from '../../../lib/auth/password';
import * as userRepository from '../../../lib/repositories/user';
import {
  evaluateLoginAttempt,
  GENERIC_LOGIN_ERROR,
  RATE_LIMIT_ERROR,
} from '../../../lib/auth/loginAttempt';

// AITJ-M1-02: `evaluateLoginAttempt` is the rate-limit-gated credential
// check that runs ahead of next-auth's `signIn()` (see lib/auth/login.ts
// [actions/auth/login.ts]). It is deliberately independent of next-auth's
// ambient `cookies()`/`headers()` API (which next-auth's own `signIn()`
// needs and which only exists inside a real Next.js request — see the
// comment on AITJ-M1-01's session.test.ts/logout.test.ts for the same
// constraint), so it can be exercised directly here against real
// Postgres.
describe('loginAttempt.test.ts', () => {
  let prisma: PrismaClient;
  const password = 'Correct10CharPwd';
  let email: string;

  beforeAll(async () => {
    const databaseUrl = await getDatabaseUrl();
    runMigrateDeploy(databaseUrl);
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createUser(overrides: { email?: string } = {}) {
    const userEmail = overrides.email ?? uniqueEmail();
    await prisma.user.create({
      data: { name: 'Login Attempt Test User', email: userEmail, passwordHash: await hashPassword(password) },
    });
    return userEmail;
  }

  test('T4: login timing > non-existent email and wrong password have comparable duration', async () => {
    email = await createUser();

    const start1 = performance.now();
    await evaluateLoginAttempt(uniqueEmail(), 'wrong-password-123', new Date());
    const nonExistentDuration = performance.now() - start1;

    const start2 = performance.now();
    await evaluateLoginAttempt(email, 'wrong-password-123', new Date());
    const wrongPasswordDuration = performance.now() - start2;

    expect(Math.abs(nonExistentDuration - wrongPasswordDuration)).toBeLessThan(50);
  });

  test('T5: rate limit > 5th failed attempt blocks with generic error', async () => {
    email = await createUser();
    const now = new Date();

    let lastResult;
    for (let i = 0; i < 5; i += 1) {
      lastResult = await evaluateLoginAttempt(email, 'wrong-password-123', now);
    }

    expect(lastResult).toEqual({ ok: false, error: RATE_LIMIT_ERROR });
  });

  test('T6: rate limit > 6th attempt immediately blocked, no auth check performed', async () => {
    email = await createUser();
    const now = new Date();

    for (let i = 0; i < 5; i += 1) {
      await evaluateLoginAttempt(email, 'wrong-password-123', now);
    }

    const spy = vi.spyOn(userRepository, 'findUserForLogin');
    const result = await evaluateLoginAttempt(email, 'wrong-password-123', now);

    expect(result).toEqual({ ok: false, error: RATE_LIMIT_ERROR });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('T7: rate limit > successful login clears counter', async () => {
    email = await createUser();
    const now = new Date();

    await evaluateLoginAttempt(email, 'wrong-password-123', now);
    await evaluateLoginAttempt(email, 'wrong-password-123', now);
    await evaluateLoginAttempt(email, 'wrong-password-123', now);
    await evaluateLoginAttempt(email, 'wrong-password-123', now);

    const success = await evaluateLoginAttempt(email, password, now);
    expect(success).toEqual({ ok: true });

    // Counter was cleared on success, so this next failure is attempt #1
    // again: not the rate-limit error.
    const nextFailure = await evaluateLoginAttempt(email, 'wrong-password-123', now);
    expect(nextFailure).toEqual({ ok: false, error: GENERIC_LOGIN_ERROR });
  });

  test('T8: rate limit > counter resets after 15 minutes', async () => {
    email = await createUser();
    const windowStart = new Date('2026-01-01T00:00:00.000Z');

    for (let i = 0; i < 5; i += 1) {
      await evaluateLoginAttempt(email, 'wrong-password-123', windowStart);
    }
    const blocked = await evaluateLoginAttempt(email, 'wrong-password-123', windowStart);
    expect(blocked).toEqual({ ok: false, error: RATE_LIMIT_ERROR });

    const after15Minutes = new Date(windowStart.getTime() + 15 * 60 * 1000 + 1000);
    const firstAttemptInNewWindow = await evaluateLoginAttempt(
      email,
      'wrong-password-123',
      after15Minutes,
    );
    expect(firstAttemptInNewWindow).toEqual({ ok: false, error: GENERIC_LOGIN_ERROR });
  });

  test('T12: rate limit key > per-email counter independent', async () => {
    const emailA = await createUser();
    const emailB = await createUser();
    const now = new Date();

    for (let i = 0; i < 5; i += 1) {
      await evaluateLoginAttempt(emailA, 'wrong-password-123', now);
    }
    const blockedA = await evaluateLoginAttempt(emailA, 'wrong-password-123', now);
    expect(blockedA).toEqual({ ok: false, error: RATE_LIMIT_ERROR });

    const resultB = await evaluateLoginAttempt(emailB, 'wrong-password-123', now);
    expect(resultB).toEqual({ ok: false, error: GENERIC_LOGIN_ERROR });
  });
});
