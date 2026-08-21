// AITJ-M1-03 (FR-A2). The single validator every candidate post-login
// (actions/auth/login.ts) and pre-login (middleware.ts) redirect
// destination passes through -- an open-redirect guard (AC5).
//
// An allowlist of the app's own top-level route segments, rather than a
// generic "looks like a relative path" check, is deliberate: it is the
// only way to reject `/../../etc/passwd`-style traversal and
// protocol-relative (`//attacker.com`) tricks without a false negative,
// and it doubles as the post-login redirect loop guard (E9) since
// `/login` itself is never on the list.
const ALLOWED_APP_ROUTES = new Set([
  'dashboard',
  'income',
  'expenses',
  'transactions',
  'reports',
  'categories',
  'settings',
]);

export function isValidRedirect(url: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return false;
  }

  // A real in-app path always starts with exactly one "/". This alone
  // rejects absolute URLs ("https://attacker.com") and embedded schemes
  // ("http://example.com/dashboard"); the explicit "//" check on top of
  // it also rejects protocol-relative URLs ("//attacker.com"), which
  // start with "/" but are still resolved as absolute by a browser.
  if (!decoded.startsWith('/') || decoded.startsWith('//')) {
    return false;
  }

  const [pathname] = decoded.split(/[?#]/);
  const segments = pathname.split('/').filter(Boolean);

  // Path traversal segments ("..", ".") never appear in a real app route.
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    return false;
  }

  const [firstSegment] = segments;
  return firstSegment !== undefined && ALLOWED_APP_ROUTES.has(firstSegment);
}
