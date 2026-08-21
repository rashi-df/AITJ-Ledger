// Module augmentation for Auth.js v5. `session.user` and the JWT only ever
// carry `id` in addition to the DefaultSession/DefaultJWT fields — see the
// explicit reconstruction in lib/auth/config.ts's `session`/`jwt`
// callbacks, which is what actually keeps `passwordHash` (FR-A10) off of
// both.
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
  }
}
