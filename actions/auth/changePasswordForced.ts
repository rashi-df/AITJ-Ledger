'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { updateSession } from '../../lib/auth/config';
import { authedAction, type ActionSession } from '../../lib/auth/authedAction';
import { hashPassword } from '../../lib/auth/password';
import { applyForcedPasswordChange } from '../../lib/repositories/user';
import { forcedPasswordChangeSchema } from '../../lib/validation/auth';

const POST_CHANGE_DESTINATION = '/dashboard';

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

  const result = await applyForcedPasswordChange(session.user.id, passwordHash);
  if (!result.ok) {
    return { error: 'Password change is not required for this account.' };
  }

  await updateSession({ user: { mustChangePassword: false } });

  revalidatePath(POST_CHANGE_DESTINATION);
  redirect(POST_CHANGE_DESTINATION);
}

export const changePasswordForcedAction = authedAction(changePasswordForced);
