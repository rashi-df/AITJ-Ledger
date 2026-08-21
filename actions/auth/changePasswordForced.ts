'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { updateSession } from '../../lib/auth/config';
import { authedAction, type ActionSession } from '../../lib/auth/authedAction';
import { hashPassword } from '../../lib/auth/password';
import { prisma } from '../../lib/db';
import { recordAuditLog } from '../../lib/repositories/auditLog';
import {
  findUserForForcedPasswordChange,
  setPasswordAndClearMustChangeFlag,
} from '../../lib/repositories/user';
import { forcedPasswordChangeSchema } from '../../lib/validation/auth';

const POST_CHANGE_DESTINATION = '/dashboard';

// AC9 safety-check failure: thrown if this flow is invoked for an account
// that is not (or no longer) in the forced-password-change state. Never
// exposed to the client with any detail beyond a generic message. Not
// exported: a "use server" file may only export async functions (and
// types, which are erased) -- a class export is rejected at build time.
class ForcedPasswordChangeNotRequiredError extends Error {
  constructor() {
    super('Password change is not required for this account.');
    this.name = 'ForcedPasswordChangeNotRequiredError';
  }
}

export interface ChangePasswordForcedResult {
  error?: string;
}

/**
 * Server Action behind the forced-password-change page (FR-A5, AC7-AC10).
 * Follows the five-step pattern (§8.2): session asserted via `authedAction`,
 * input parsed with Zod, the password write and its audit entry commit in
 * one transaction (NFR-2), then the current session's JWT is refreshed in
 * place (`updateSession`) so this same request's redirect to `/dashboard`
 * is not immediately bounced back by middleware.ts, which would otherwise
 * still be reading the pre-change `mustChangePassword: true` cookie.
 */
async function changePasswordForced(
  session: ActionSession,
  input: { newPassword: string },
): Promise<ChangePasswordForcedResult> {
  const parsed = forcedPasswordChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Enter a valid password' };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.$transaction(async (tx) => {
    const user = await findUserForForcedPasswordChange(session.user.id, tx);
    if (!user || !user.mustChangePassword) {
      throw new ForcedPasswordChangeNotRequiredError();
    }

    await setPasswordAndClearMustChangeFlag(session.user.id, passwordHash, tx);

    // Never includes passwordHash -- only the flag transition (FR-A10).
    await recordAuditLog(
      {
        entityType: 'User',
        entityId: session.user.id,
        action: 'UPDATE',
        actorId: session.user.id,
        before: { mustChangePassword: true },
        after: { mustChangePassword: false },
      },
      tx,
    );
  });

  await updateSession({ user: { mustChangePassword: false } });

  revalidatePath(POST_CHANGE_DESTINATION);
  redirect(POST_CHANGE_DESTINATION);
}

export const changePasswordForcedAction = authedAction(changePasswordForced);
