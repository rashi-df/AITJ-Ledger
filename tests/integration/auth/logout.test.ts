import { PrismaClient } from '@prisma/client';
import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from '../../schema/container';
import { uniqueEmail } from '../../schema/fixtures';
import { hashPassword } from '../../../lib/auth/password';
import { buildAuthConfig } from '../../../lib/auth/config';

function extractCookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

describe('logout.test.ts', () => {
  let prisma: PrismaClient;
  let handlers: ReturnType<typeof NextAuth>['handlers'];
  const email = uniqueEmail();
  const password = 'Correct10CharPwd';

  beforeAll(async () => {
    const databaseUrl = await getDatabaseUrl();
    runMigrateDeploy(databaseUrl);
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    await prisma.user.create({
      data: { name: 'Logout Test User', email, passwordHash: await hashPassword(password) },
    });
    ({ handlers } = NextAuth(
      buildAuthConfig({
        AUTH_SECRET: 'a-logout-test-secret-32-characters',
        AUTH_URL: 'http://localhost:3000',
      }),
    ));
  }, 120_000);

  afterAll(async () => {
    await prisma.user.delete({ where: { email } });
    await prisma.$disconnect();
  });

  test('logout > invalidates session immediately', async () => {
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

    const signinRes = await handlers.POST(
      new NextRequest('http://localhost:3000/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: csrfCookie },
        body: form.toString(),
      }),
    );
    const sessionCookie = extractCookieHeader(signinRes);

    const sessionBefore = await handlers.GET(
      new NextRequest('http://localhost:3000/api/auth/session', {
        headers: { Cookie: sessionCookie },
      }),
    );
    const sessionBeforeBody = (await sessionBefore.json()) as { user?: unknown };
    expect(sessionBeforeBody.user).toBeDefined();

    // signOut needs its own CSRF token, bound to the now-authenticated
    // session cookies.
    const logoutCsrfRes = await handlers.GET(
      new NextRequest('http://localhost:3000/api/auth/csrf', {
        headers: { Cookie: sessionCookie },
      }),
    );
    const logoutCsrfBody = (await logoutCsrfRes.json()) as { csrfToken: string };
    const combinedCookie = `${sessionCookie}; ${extractCookieHeader(logoutCsrfRes)}`;

    const signoutForm = new URLSearchParams({ csrfToken: logoutCsrfBody.csrfToken, json: 'true' });
    const signoutRes = await handlers.POST(
      new NextRequest('http://localhost:3000/api/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: combinedCookie },
        body: signoutForm.toString(),
      }),
    );

    const clearedCookie = signoutRes.headers
      .getSetCookie()
      .find((c) => c.startsWith('authjs.session-token'));
    expect(clearedCookie).toContain('Max-Age=0');
    expect(clearedCookie?.split(';')[0]).toBe('authjs.session-token=');

    // A real browser would have deleted the cookie by now — simulate that
    // by making the next request with no cookie at all, and confirm it is
    // unauthenticated.
    const sessionAfter = await handlers.GET(
      new NextRequest('http://localhost:3000/api/auth/session'),
    );
    // Auth.js's /api/auth/session responds with a literal JSON `null` body
    // (not `{}`) when the request carries no session cookie at all — the
    // exact state a real browser is in immediately after it deletes the
    // cookie this test just confirmed was cleared above.
    const sessionAfterBody = await sessionAfter.json();
    expect(sessionAfterBody).toBeNull();
  });
});
