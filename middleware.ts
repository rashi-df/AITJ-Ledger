import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isValidRedirect } from './lib/auth/redirectValidation';

// AITJ-M1-04 (FR-A5). The one protected route the forced-password-change
// flow itself must stay reachable at, even while the flag is still set --
// every other protected route redirects here instead of rendering (AC5,
// AC6, E8).
const FORCED_PASSWORD_CHANGE_PATH = '/settings/change-password';

/**
 * Route protection (FR-A2, NFR-7). Guards the authenticated route group --
 * dashboard, income, expenses, transactions, reports, categories,
 * settings -- via the `matcher` below; `/login`, `/invite/[token]`,
 * `/api/auth/*`, and the marketing root page are never matched, so they
 * are always reachable unauthenticated (AC3, AC4).
 *
 * Reads the session via `next-auth/jwt`'s `getToken` rather than the full
 * Auth.js API in lib/auth/config.ts: middleware runs on Next.js's Edge
 * runtime, which cannot load the Credentials provider's transitive
 * dependencies (bcryptjs, the Prisma client) -- `getToken` only decrypts
 * the JWT cookie with the shared secret, no provider code involved. This
 * also means the forced-password-change check below reads
 * `token.mustChangePassword` straight off the already-decoded JWT -- no
 * database round trip, so no N+1 on every protected-route request.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  const { pathname, search } = request.nextUrl;

  if (!token) {
    const destination = `${pathname}${search}`;
    const loginUrl = new URL('/login', request.url);
    if (isValidRedirect(destination)) {
      loginUrl.searchParams.set('redirect', destination);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (token.mustChangePassword && pathname !== FORCED_PASSWORD_CHANGE_PATH) {
    return NextResponse.redirect(new URL(FORCED_PASSWORD_CHANGE_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/income/:path*',
    '/expenses/:path*',
    '/transactions/:path*',
    '/reports/:path*',
    '/categories/:path*',
    '/settings/:path*',
  ],
};
