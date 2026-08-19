# AITJ-M8-04 — Security headers, CSP and HTTPS enforcement

| Field | Value |
|---|---|
| Milestone | M8 — Hardening |
| Depends on | AITJ-M1-01, AITJ-M5-01, AITJ-M6-01 |
| Blocks | AITJ-M8-06 |
| PRD refs | NFR-5, NFR-6, NFR-7, NFR-8, §12.3 |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

Production deployment requires HTTPS enforced in production; HSTS, X-Frame-Options: DENY, and a restrictive Content Security Policy (NFR-6). Server Actions provide CSRF protection natively (NFR-7). All secrets come from environment variables (NFR-5), and logs are structured without exposing amounts, passwords, or tokens (NFR-8). The RED phase writes tests asserting the presence and exact value of each security header, and that pages still function under CSP — a CSP strict enough to break Recharts, shadcn, or Next.js hydration is a failed test. The GREEN phase configures headers and validates that no secret appears in the client bundle.

## Acceptance criteria

- [ ] AC1 — All responses include `Content-Security-Policy` header with a restrictive policy that allows only necessary inline scripts and external resources (e.g. Google Fonts), blocks data: URIs for scripts, and disallows unsafe-eval
- [ ] AC2 — CSP is tested and verified to NOT break the app: all routes render, charts (Recharts) display, forms submit, and modals open without CSP violations
- [ ] AC3 — All responses include `Strict-Transport-Security: max-age=31536000; includeSubDomains` in production
- [ ] AC4 — All responses include `X-Frame-Options: DENY` to prevent clickjacking
- [ ] AC5 — All responses include `X-Content-Type-Options: nosniff` to prevent MIME sniffing
- [ ] AC6 — All responses include `X-XSS-Protection: 1; mode=block` (legacy but harmless)
- [ ] AC7 — HSTS header is NOT sent in development (to allow insecure localhost)
- [ ] AC8 — Tests assert that forged cross-origin POST requests to Server Actions are rejected (CSRF protection)
- [ ] AC9 — No secret (AUTH_SECRET, DATABASE_URL, SEED_ADMIN_PASSWORD) appears in the built Next.js client bundle (`.next/static/`)
- [ ] AC10 — Database connection string (DATABASE_URL) is never logged or rendered in responses
- [ ] AC11 — Structured logs include timestamps, event type (auth, mutation), actor ID (never email), and outcome; amounts are logged as zero or omitted; passwords and tokens never appear
- [ ] AC12 — CSP violation reports (if enabled) are collected and surfaced for testing; no violations occur during normal use

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | CSP violation on page load | No violations reported for inline `<script>` for hydration (Next.js uses nonce or hash), styles, or Google Fonts |
| E2 | Recharts rendering under CSP | Charts render without "Error: Content Security Policy" errors; SVG is generated and displayed |
| E3 | shadcn dialog/modal under CSP | Modals render and are interactive; no inline style or script violations |
| E4 | Form submission with CSP | Server Action POST succeeds; response is allowed by CSP (e.g. `default-src 'self'`); forged cross-origin POST is blocked |
| E5 | Invite token in URL under CSP | CSP does not prevent navigation to `/invite/[token]`; form renders and submits correctly |
| E6 | Database error on startup | If DATABASE_URL is missing or malformed, app fails to start with a clear error message, never boots into a broken state with degraded functionality |
| E7 | HSTS preload | HSTS header includes `max-age` sufficient for preload eligibility (≥10886400); clients add domain to preload list |
| E8 | Logged auth failure | Auth failure is logged with timestamp, email (hashed or omitted), and "failed" outcome; no password attempt is logged |
| E9 | Logged mutation (transaction creation) | Mutation is logged with timestamp, actor ID, entity type ("Transaction"), and action ("CREATE"); no amounts or descriptions in the log line |
| E10 | CSP report-uri / report-to (optional) | If CSP reporting is enabled, violations are sent to a reporting endpoint; reports do not contain sensitive data (amounts, user IDs are acceptable; passwords and secrets are not) |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `security > CSP header present` | Response from `/` includes `Content-Security-Policy` header; header value contains `default-src 'self'` or similar |
| T2 | integration | `security > HSTS header in production` | In production mode, response includes `Strict-Transport-Security: max-age=31536000; includeSubDomains`; in dev, header is absent |
| T3 | integration | `security > X-Frame-Options DENY` | Response includes `X-Frame-Options: DENY`; attempts to frame the app in an `<iframe>` fail (browser prevents it) |
| T4 | integration | `security > X-Content-Type-Options nosniff` | Response includes `X-Content-Type-Options: nosniff` |
| T5 | e2e | `security > CSP does not break Recharts` | Dashboard chart renders without CSP violations; `document.querySelectorAll('svg')` finds the rendered chart; no console errors |
| T6 | e2e | `security > CSP does not break form submission` | Form submits and receives response without CSP violations; `aria-invalid` or success message appears; no network errors |
| T7 | e2e | `security > CSP does not break modal dialog` | Delete confirmation modal opens, displays, and is interactive; no CSP violations in console; Confirm button works |
| T8 | e2e | `security > CSRF rejection of forged POST` | Test makes a POST request to a Server Action (e.g. `/api/actions/create-transaction`) without a valid session or CSRF token from a different origin; request is rejected with 401 or 403 |
| T9 | integration | `security > AUTH_SECRET not in built bundle` | Build the app with `next build`; scan `.next/static/` for AUTH_SECRET value; secret is NOT found in any JS file |
| T10 | integration | `security > DATABASE_URL not in built bundle` | Scan `.next/static/` for DATABASE_URL value; not found in any JS file |
| T11 | integration | `security > SEED_ADMIN_PASSWORD not in built bundle` | Scan `.next/static/` for SEED_ADMIN_PASSWORD value; not found in any JS file |
| T12 | integration | `security > auth failure log does not include password` | Mock a failed login and check server logs (or a test logger); "Invalid credentials" event is logged; no password string appears in the log |
| T13 | integration | `security > mutation log omits amounts and descriptions` | Mock a transaction creation and check logs; event type, actor ID, and timestamp are present; amount value is NOT in the log line; description is NOT in the log line |
| T14 | integration | `security > missing DATABASE_URL fails fast` | Unset DATABASE_URL; attempt to start the app; app exits immediately with a clear error message ("DATABASE_URL is required") before any route handler runs |

**Red gate:** CSP header is missing or too permissive. Charts or forms fail under CSP. HSTS is sent in development. Secrets appear in the built bundle. Auth failures or mutations are logged with sensitive data.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] CSP is configured in Next.js middleware or `next.config.js` and is sufficiently permissive for the app to work but restrictive against XSS
- [ ] All other security headers are set (HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

- **CSP in Next.js:** Add a `next.config.js` export or middleware function to set the `Content-Security-Policy` header. A reasonable policy for AITJ:
  ```
  default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';
  ```
  (`'wasm-unsafe-eval'` is needed for Recharts if it uses WebAssembly; adjust if testing proves it is not needed. `'unsafe-inline'` for styles is acceptable if all styles come from Tailwind + shadcn — verify by audit.)
- **Middleware for headers:** In `lib/middleware.ts` or a route handler, set response headers:
  ```typescript
  const securityHeaders = {
    'Content-Security-Policy': CSP_POLICY,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
  };
  if (process.env.NODE_ENV === 'production') {
    securityHeaders['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  ```
- **CSRF protection verification:** Next.js Server Actions use `Origin` and `Referer` checks by default. Write a test that manually crafts a cross-origin POST with the action endpoint. Assert it is rejected (401 or 403).
- **Secrets scanning:** After `next build`, use a script to scan `.next/static/` for secret strings:
  ```bash
  find .next/static -type f -name "*.js" -exec grep -l "$AUTH_SECRET\|$DATABASE_URL\|$SEED_ADMIN_PASSWORD" {} \;
  ```
  Assert no matches.
- **Structured logging:** Create a logger in `lib/logger.ts`:
  ```typescript
  export function logAuthAttempt(email: string, success: boolean, reason?: string) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'auth_attempt',
      email: hashEmail(email), // Never log plaintext email
      success,
      reason: success ? undefined : reason,
    }));
  }
  export function logMutation(actor: string, entity: string, action: string, before?: any, after?: any) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'mutation',
      actorId: actor,
      entityType: entity,
      action,
      // Omit 'before' and 'after' if they contain amounts or sensitive data
      // Or use a custom serializer that strips them
    }));
  }
  ```
- **CSP nonce for Next.js hydration:** If inline scripts fail CSP, use a nonce approach. Next.js 13+ can be configured to use nonces for inline scripts; add a middleware that generates a nonce and injects it into CSP and `<script>` tags.
- **Testing Recharts under CSP:** Render a chart in a test and assert `page.locator('svg').count() > 0` after the page loads. Check `page.evaluate(() => console.errors)` or inspect `page.on('console')` for CSP violations.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] CSP header is set and allows Recharts, shadcn, and Next.js to function
- [ ] HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection headers are present in production
- [ ] Secrets (AUTH_SECRET, DATABASE_URL, SEED_ADMIN_PASSWORD) do not appear in built `.next/static/`
- [ ] Structured logs configured; auth failures and mutations logged without sensitive data
- [ ] CSRF protection verified: forged cross-origin POST is rejected
- [ ] Missing env vars (DATABASE_URL, AUTH_SECRET) cause fast failure at startup with a clear message
- [ ] No N+1 queries (no change to data layer)
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
