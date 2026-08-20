import { PrismaClient } from '@prisma/client';
import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDatabaseUrl, runMigrateDeploy } from '../../schema/container';
import { uniqueEmail } from '../../schema/fixtures';
import { hashPassword } from '../../../lib/auth/password';
import { buildAuthConfig } from '../../../lib/auth/config';

// Auth.js's Next.js handlers read `req.nextUrl`, so requests in these
// tests must be built with `NextRequest`, not the bare Web `Request`.
function extractCookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

function extractSessionTokenExpires(setCookies: string[]): number {
  const cookie = setCookies.find((c) => c.startsWith('authjs.session-token'));
  if (!cookie) {
    throw new Error('session-token cookie not found in Set-Cookie headers');
  }
  const match = /Expires=([^;]+)/.exec(cookie);
  if (!match) {
    throw new Error('Expires attribute not found on session-token cookie');
  }
  return new Date(match[1]).getTime();
}

describe('session.test.ts', () => {
  let prisma: PrismaClient;
  const email = uniqueEmail();
  const password = 'Correct10CharPwd';

  beforeAll(async () => {
    const databaseUrl = await getDatabaseUrl();
    runMigrateDeploy(databaseUrl);
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    await prisma.user.create({
      data: { name: 'Session Test User', email, passwordHash: await hashPassword(password) },
    });
  }, 120_000);

  afterAll(async () => {
    await prisma.user.delete({ where: { email } });
    await prisma.$disconnect();
  });

  async function signIn(handlers: ReturnType<typeof NextAuth>['handlers']): Promise<Response> {
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

    return handlers.POST(
      new NextRequest('http://localhost:3000/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: csrfCookie },
        body: form.toString(),
      }),
    );
  }

  test('session > sets httpOnly secure sameSite=lax cookie', async () => {
    const { handlers } = NextAuth(
      buildAuthConfig({
        AUTH_SECRET: 'a-session-cookie-test-secret-32ch',
        AUTH_URL: 'http://localhost:3000',
        NODE_ENV: 'production',
      }),
    );

    const signinRes = await signIn(handlers);
    const setCookie = signinRes.headers
      .getSetCookie()
      .find((c) => c.startsWith('authjs.session-token'));

    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
  });

  test('session > 7-day sliding window expiry updates on each request', async () => {
    const { handlers } = NextAuth(
      buildAuthConfig({
        AUTH_SECRET: 'a-sliding-window-test-secret-32ch',
        AUTH_URL: 'http://localhost:3000',
      }),
    );

    const signinRes = await signIn(handlers);
    const sessionCookie = extractCookieHeader(signinRes);
    const firstExpires = extractSessionTokenExpires(signinRes.headers.getSetCookie());

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const secondRes = await handlers.GET(
      new NextRequest('http://localhost:3000/api/auth/session', {
        headers: { Cookie: sessionCookie },
      }),
    );
    const secondExpires = extractSessionTokenExpires(secondRes.headers.getSetCookie());

    expect(secondExpires).toBeGreaterThan(firstExpires);
  });
});
