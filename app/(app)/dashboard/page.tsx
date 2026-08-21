import type { Metadata } from 'next';

// Feature dashboard is implemented in AITJ-M5-03. This ticket
// (AITJ-M1-04) only needs a real page to exist at the post-login/
// post-forced-password-change destination so route protection and the
// redirect flow have something to actually render (T11).
export const metadata: Metadata = {
  title: 'Dashboard — AITJ Ledger',
};

export default function DashboardPage() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
    </main>
  );
}
