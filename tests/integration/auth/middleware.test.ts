import { encode } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { middleware } from '../../../middleware';

// AITJ-M1-03 (T12). Exercises the real middleware function directly with
// hand-crafted Auth.js JWTs -- no HTTP server needed, but real jose
// encode/decode, which is why this lives under tests/integration rather
// than tests/unit (same reasoning as tests/integration/auth/session.test.ts).
const SESSION_COOKIE_SALT = 'authjs.session-token';
const secret = 'a-middleware-integration-test-secret-32ch';

describe('middleware.test.ts', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = secret;
  });

  afterEach(() => {
    process.env.AUTH_SECRET = secret;
  });

  test('T12: session > expired session redirects to /login on next protected route access', async () => {
    // Auth.js's `decode()` allows a 15s clock-skew tolerance (jose's
    // `clockTolerance`), so the expiry has to be further in the past than
    // that to reliably be treated as expired rather than merely stale.
    const expiredToken = await encode({
      secret,
      salt: SESSION_COOKIE_SALT,
      maxAge: -120,
      token: { id: 'user-1', name: 'Expired User', email: 'expired@example.test' },
    });

    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: { Cookie: `${SESSION_COOKIE_SALT}=${expiredToken}` },
    });

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?redirect=%2Fdashboard',
    );
  });

  test('session > missing session redirects to /login', async () => {
    const request = new NextRequest('http://localhost:3000/dashboard');

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?redirect=%2Fdashboard',
    );
  });

  test('session > valid session passes through to the protected route', async () => {
    const validToken = await encode({
      secret,
      salt: SESSION_COOKIE_SALT,
      maxAge: 60,
      token: { id: 'user-1', name: 'Valid User', email: 'valid@example.test' },
    });

    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: { Cookie: `${SESSION_COOKIE_SALT}=${validToken}` },
    });

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
