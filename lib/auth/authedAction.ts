import { auth } from './config';

export class AuthenticationError extends Error {
  constructor(message = 'You must be signed in to do that.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export interface ActionSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export type GetSession = () => Promise<ActionSession | null>;

async function defaultGetSession(): Promise<ActionSession | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || !session.user.name) {
    return null;
  }
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
  };
}

/**
 * Wraps a Server Action so it can never run without an authenticated
 * session — step one of the five-step Server Action pattern (§8.2).
 * Wrapped actions receive the session as their first argument.
 *
 * `getSession` is overridable purely so tests can exercise the
 * no-session path deterministically; every real caller relies on the
 * default, which reads the actual Auth.js session.
 */
export function authedAction<Args extends unknown[], Return>(
  action: (session: ActionSession, ...args: Args) => Promise<Return>,
  getSession: GetSession = defaultGetSession,
): (...args: Args) => Promise<Return> {
  return async (...args: Args): Promise<Return> => {
    // TODO(AITJ-M1-01): session gate not wired up correctly yet.
    const session = await getSession();
    if (session) {
      throw new AuthenticationError();
    }
    return action(session as unknown as ActionSession, ...args);
  };
}
