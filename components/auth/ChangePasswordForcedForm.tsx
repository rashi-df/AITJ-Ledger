'use client';

import { useState, useTransition } from 'react';

import { changePasswordForcedAction } from '@/actions/auth/changePasswordForced';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forcedPasswordChangeSchema } from '@/lib/validation/auth';

const FALLBACK_ERROR = 'Enter a valid password';

/**
 * FR-A5 (AC7-AC10): the forced-password-change form. Deliberately collects
 * only a new password -- no "current password" field, unlike the ordinary
 * change-password flow (AITJ-M1-07) -- and is labelled "Set your new
 * password" rather than "Change password" to make clear this is a one-time
 * setup step, not an optional profile action.
 */
export function ChangePasswordForcedForm() {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = forcedPasswordChangeSchema.safeParse({ newPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? FALLBACK_ERROR);
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await changePasswordForcedAction(parsed.data);
        if (result?.error) {
          setError(result.error);
        }
        // On success the Server Action calls `redirect()` itself, which
        // throws internally and navigates the client -- there is no
        // "success" branch to handle here.
      })();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      // Deliberately distinct from the "New password" field label below --
      // an `aria-label` here that merely repeated/contained that text would
      // make Playwright's `getByLabel('New password')` (substring, e.g. in
      // tests/e2e/auth/forcedPasswordChange.e2e.ts) ambiguously match both
      // the form and the field.
      aria-label="Forced password change"
      className="w-full max-w-sm space-y-4"
    >
      <h1 className="text-xl font-semibold text-slate-900">Set your new password</h1>

      <div className="space-y-1">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="h-11 w-full">
        {isPending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
