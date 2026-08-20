import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'AITJ Ledger',
  description: 'Private masjid income & expense register',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
