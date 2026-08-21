'use client';

import { useState, useTransition } from 'react';

import { loginAction } from '@/actions/auth/login';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginSchema } from '@/lib/validation/auth';

const FALLBACK_ERROR = 'Invalid email or password';

/**
 * FR-A1/FR-A11: email/password login form. Client-side Zod validation
 * (the same `loginSchema` the Server Action re-validates with, per §7 --
 * client validation is convenience only) rejects empty/malformed input
 * before the Server Action ever runs (AC4, E7, E8), and the server's
 * generic "Invalid email or password" error is the only failure message
 * ever shown, whether the email does not exist or the password is wrong
 * (AC2).
 */
export interface LoginFormProps {
  /**
   * The validated-on-the-server `?redirect=` destination (FR-A2), if the
   * user was sent here from middleware.ts. Re-validated again by
   * `loginAction` itself before use -- this prop is convenience only.
   */
  redirectTo?: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? FALLBACK_ERROR);
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await loginAction({ ...parsed.data, redirectTo });
        if (result?.error) {
          setError(result.error);
        }
        // On success `loginAction` calls `redirect()` server-side, which
        // throws internally and navigates the client -- there is no
        // "success" branch to handle here.
      })();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Login"
      className="w-full max-w-sm space-y-4"
    >
      <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>

      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="h-11 w-full">
        {isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
