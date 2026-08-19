// Layout for the unauthenticated route group: login and invite acceptance.
// Login and invite pages are implemented in M1 (Auth) — this ticket only
// establishes the route group and its layout shell.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">{children}</div>
  );
}
