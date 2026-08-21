import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// AITJ-M1-03 (FR-A2, NFR-7). Stub pending implementation.
export async function middleware(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/income/:path*',
    '/expenses/:path*',
    '/transactions/:path*',
    '/reports/:path*',
    '/categories/:path*',
    '/settings/:path*',
  ],
};
