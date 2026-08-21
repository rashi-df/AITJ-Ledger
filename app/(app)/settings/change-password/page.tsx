import type { Metadata } from 'next';

import { ChangePasswordForcedForm } from '@/components/auth/ChangePasswordForcedForm';

// FR-A5 (AC7): the one destination middleware.ts lets a
// `mustChangePassword: true` session reach, and the only page that can
// clear the flag.
export const metadata: Metadata = {
  title: 'Set your new password — AITJ Ledger',
};

export default function ChangePasswordForcedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <ChangePasswordForcedForm />
    </main>
  );
}
