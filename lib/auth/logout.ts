'use server';

import { signOut } from './config';

// FR-A4: logs the current user out from any page. `signOut` invalidates
// the session and clears the cookie, then redirects to /login itself
// (E1) — no separate redirect() call is needed.
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
