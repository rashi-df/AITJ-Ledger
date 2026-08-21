import type { Metadata } from 'next';

import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign in — AITJ Ledger',
};

interface LoginPageProps {
  // Next.js 15: `searchParams` is a Promise (§10, FR-A2).
  searchParams: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect } = await searchParams;
  return <LoginForm redirectTo={redirect} />;
}
