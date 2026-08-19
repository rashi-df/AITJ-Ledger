import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold text-slate-900">AITJ Ledger</h1>
      <p className="text-slate-500">Private masjid income &amp; expense register.</p>
      <Button>Get started</Button>
    </main>
  );
}
