// Module augmentation for Auth.js v5. `session.user` and the JWT only ever
// carry `id`/`mustChangePassword` in addition to the DefaultSession/DefaultJWT
// fields -- see the explicit reconstruction in lib/auth/config.ts's
// `session`/`jwt` callbacks, which is what actually keeps `passwordHash`
// (FR-A10) off of both.
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    // AITJ-M1-04 (FR-A5): carried from `authorize()`'s `VerifiedUser` into
    // the `jwt` callback's `user` param so middleware can redirect to the
    // forced-password-change flow by reading the JWT alone -- no per-request
    // database lookup (no N+1).
    mustChangePassword: boolean;
  }

  interface Session {
    user: {
      id: string;
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    mustChangePassword?: boolean;
  }
}
