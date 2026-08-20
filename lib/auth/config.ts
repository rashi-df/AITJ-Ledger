import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { findUserForLogin } from '../repositories/user';
import { verifyPassword } from './password';

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

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
  // TODO(AITJ-M1-01): required-env validation not wired up yet.
  return { secret: env.AUTH_SECRET ?? '', url: env.AUTH_URL ?? '' };
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
        // way and never reveals whether the email exists.
        async authorize(credentials) {
          const email = typeof credentials?.email === 'string' ? credentials.email : undefined;
          const password =
            typeof credentials?.password === 'string' ? credentials.password : undefined;
          if (!email || !password) {
            return null;
          }

          const user = await findUserForLogin(email);
          if (!user) {
            return null;
          }

          const isValid = await verifyPassword(password, user.passwordHash);
          if (!isValid) {
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
      // TODO(AITJ-M1-01): still spreads the raw session user through —
      // does not yet guard against a passwordHash (or similar secret)
      // reaching the serialized session.
      session({ session, token }) {
        return {
          ...session,
          user: {
            ...session.user,
            id: typeof token.id === 'string' ? token.id : '',
          },
        };
      },
    },
    pages: {
      signIn: '/login',
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(buildAuthConfig());
