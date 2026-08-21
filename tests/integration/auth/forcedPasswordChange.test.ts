import { PrismaClient } from '@prisma/client';
import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from '../../schema/container';
import { uniqueEmail } from '../../schema/fixtures';
import { hashPassword } from '../../../lib/auth/password';
import { buildAuthConfig } from '../../../lib/auth/config';

// AITJ-M1-04 (FR-A5, T12). Same real-sign-in-against-real-Postgres pattern
// as tests/integration/auth/session.test.ts and logout.test.ts.
function extractCookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signInAndGetSessionUser(
  handlers: ReturnType<typeof NextAuth>['handlers'],
  email: string,
  password: string,
): Promise<{ mustChangePassword?: boolean } | undefined> {
  const csrfRes = await handlers.GET(new NextRequest('http://localhost:3000/api/auth/csrf'));
  const csrfBody = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookie = extractCookieHeader(csrfRes);

  const form = new URLSearchParams({
    email,
    password,
    csrfToken: csrfBody.csrfToken,
    callbackUrl: 'http://localhost:3000',
    json: 'true',
  });

  const signInRes = await handlers.POST(
    new NextRequest('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: csrfCookie },
      body: form.toString(),
    }),
  );
  const sessionCookie = extractCookieHeader(signInRes);

  const sessionRes = await handlers.GET(
    new NextRequest('http://localhost:3000/api/auth/session', {
      headers: { Cookie: sessionCookie },
    }),
  );
  const sessionBody = (await sessionRes.json()) as { user?: { mustChangePassword?: boolean } };
  return sessionBody.user;
}

describe('forcedPasswordChange.test.ts', () => {
  let prisma: PrismaClient;
  let handlers: ReturnType<typeof NextAuth>['handlers'];
  const email = uniqueEmail();
  const password = 'Correct10CharPwd';

  beforeAll(async () => {
    const databaseUrl = await getDatabaseUrl();
    runMigrateDeploy(databaseUrl);
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    await prisma.user.create({
      data: {
        name: 'Forced Password Change Test User',
        email,
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
      },
    });
    ({ handlers } = NextAuth(
      buildAuthConfig({
        AUTH_SECRET: 'a-forced-password-change-test-secret-32ch',
        AUTH_URL: 'http://localhost:3000',
      }),
    ));
  }, 120_000);

  afterAll(async () => {
    await prisma.user.delete({ where: { email } });
    await prisma.$disconnect();
  });

  test('T12: forced password change > logout and re-login still requires password change', async () => {
    const firstSessionUser = await signInAndGetSessionUser(handlers, email, password);
    expect(firstSessionUser?.mustChangePassword).toBe(true);

    // Logging out (JWT strategy: the cookie is simply discarded client-side
    // -- no server-side session row to invalidate) and signing back in with
    // the same still-unchanged credentials must still carry the flag,
    // because nothing has cleared it in the database.
    const secondSessionUser = await signInAndGetSessionUser(handlers, email, password);
    expect(secondSessionUser?.mustChangePassword).toBe(true);
  });
});
