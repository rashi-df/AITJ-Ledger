import NextAuth, { type NextAuthConfig, type Session } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { NextRequest } from 'next/server';
import { findUserForLogin } from '../repositories/user';
import { verifyPassword } from './password';

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

// FR-A1/NFR-8: a fixed, valid bcrypt (cost 12) hash of a password nobody
// will ever submit. When `findUserForLogin` finds no matching row,
// `authorize()` still runs `verifyPassword` against this hash instead of
// short-circuiting — otherwise the "no such email" path skips the ~100ms+
// bcrypt compare that the "wrong password" path performs, and response
// timing reveals whether an email is registered even though the returned
// error message is generic either way.
const DUMMY_PASSWORD_HASH = '$2b$12$4M6ZLf0gTl5QMWpT0xoW.u35MJuJ9rmSpdGso/W9OnoWCvVTj8twC';

export class AuthConfigError extends Error {}

export interface AuthEnv {
  AUTH_SECRET?: string;
  AUTH_URL?: string;
  NODE_ENV?: string;
}

/**
 * Validates the env vars Auth.js needs at startup (E3). Throws a clear
 * error rather than letting NextAuth fail later with an opaque one.
 */
export function assertAuthEnv(env: AuthEnv): { secret: string; url: string } {
  if (!env.AUTH_SECRET) {
    throw new AuthConfigError('AUTH_SECRET is required');
  }
  if (!env.AUTH_URL) {
    throw new AuthConfigError('AUTH_URL is required');
  }
  return { secret: env.AUTH_SECRET, url: env.AUTH_URL };
}

/**
 * Builds the Auth.js v5 config. Takes `env` as a parameter (defaulting to
 * `process.env`) purely so tests can construct an isolated config against
 * a fixed secret/URL without mutating the real process environment — the
 * same env-injection pattern as prisma/seed-lib.ts's `validateAdminEnv`.
 */
export function buildAuthConfig(env: AuthEnv = process.env): NextAuthConfig {
  const { secret } = assertAuthEnv(env);
  const isProduction = env.NODE_ENV === 'production';

  return {
    secret,
    trustHost: true,
    session: {
      strategy: 'jwt',
      // FR-A3: 7-day sliding window. Auth.js re-issues the JWT (and its
      // cookie) with a fresh `iat`/`exp` on every request that reaches the
      // `jwt` callback, so setting `maxAge` here is sufficient on its own —
      // no separate "extend expiry" logic is needed.
      maxAge: SEVEN_DAYS_IN_SECONDS,
    },
    cookies: {
      sessionToken: {
        options: {
          httpOnly: true,
          sameSite: 'lax',
          secure: isProduction,
        },
      },
    },
    providers: [
      Credentials({
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        // FR-A1/FR-A10: any failure here — unknown email or wrong password
        // — returns null, so Auth.js reports the same generic error either
        // way and never reveals whether the email exists, by message OR by
        // timing. `verifyPassword` always runs — against the real hash if
        // the user was found, against `DUMMY_PASSWORD_HASH` otherwise — so
        // the bcrypt cost is paid on every attempt.
        async authorize(credentials) {
          const email = typeof credentials?.email === 'string' ? credentials.email : undefined;
          const password =
            typeof credentials?.password === 'string' ? credentials.password : undefined;
          if (!email || !password) {
            return null;
          }

          const user = await findUserForLogin(email);
          const isValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
          if (!user || !isValid) {
            return null;
          }

          return { id: user.id, name: user.name, email: user.email };
        },
      }),
    ],
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          token.id = user.id;
        }
        return token;
      },
      // Reconstructs the session's user object explicitly from known-safe
      // fields rather than spreading the token — passwordHash (or any
      // other field that should never leave the repository layer) can
      // never leak through here even if something upstream misbehaves
      // (T9, FR-A10).
      session({ session, token }) {
        return {
          ...session,
          user: {
            id: typeof token.id === 'string' ? token.id : '',
            name: session.user?.name ?? '',
            email: session.user?.email ?? '',
          },
        };
      },
    },
    pages: {
      signIn: '/login',
    },
  };
}

type NextAuthApi = ReturnType<typeof NextAuth>;

// `buildAuthConfig()` (via `assertAuthEnv`) throws if `AUTH_SECRET`/`AUTH_URL`
// are missing. Calling `NextAuth(buildAuthConfig())` at module-evaluation
// time — as a top-level `export const { ... } = NextAuth(...)` — means that
// throw fires the instant anything imports this module, which is exactly
// what `next build`'s "Collecting page data" step does for every route
// handler, including this one's, in the build container. The build
// container never has `AUTH_SECRET`/`AUTH_URL` (those are runtime-only env
// via docker-compose.yml), so a fresh `docker compose build` fails before a
// single request is ever served.
//
// Deferring the `NextAuth(...)` call to first *use* — inside the wrappers
// below — means env validation only ever runs when a request actually
// reaches the app at runtime, when the real env is guaranteed to be
// present. The underlying NextAuth instance is still built once and cached,
// not rebuilt per request.
let cachedApi: NextAuthApi | undefined;

function getAuthApi(): NextAuthApi {
  if (!cachedApi) {
    cachedApi = NextAuth(buildAuthConfig());
  }
  return cachedApi;
}

export const handlers = {
  GET: (request: NextRequest) => getAuthApi().handlers.GET(request),
  POST: (request: NextRequest) => getAuthApi().handlers.POST(request),
};

// `NextAuthApi['auth']` is an overloaded type (no-arg for Server
// Components/actions, request-taking for middleware); this app only ever
// calls the no-arg form, so the wrapper is typed to that form explicitly
// rather than via `ReturnType<NextAuthApi['auth']>`, which would resolve to
// the (unused-here) middleware overload instead.
export async function auth(): Promise<Session | null> {
  return getAuthApi().auth();
}

export async function signIn(
  ...args: Parameters<NextAuthApi['signIn']>
): ReturnType<NextAuthApi['signIn']> {
  return getAuthApi().signIn(...args);
}

export async function signOut(
  ...args: Parameters<NextAuthApi['signOut']>
): ReturnType<NextAuthApi['signOut']> {
  return getAuthApi().signOut(...args);
}
