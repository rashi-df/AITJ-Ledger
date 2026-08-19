// Layout for the authenticated route group: dashboard, income, expenses,
// transactions, reports, categories, settings. Feature pages are
// implemented in later milestones — this ticket only establishes the
// route group and its layout shell.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
