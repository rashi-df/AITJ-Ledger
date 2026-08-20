import { NextResponse } from 'next/server';

// Liveness endpoint for the Docker healthcheck (AITJ-M0-05 AC6). Deliberately
// has no database dependency — it only confirms the Next.js server itself is
// up and serving requests.
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
