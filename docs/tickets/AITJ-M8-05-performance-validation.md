# AITJ-M8-05 — Performance validation against 10,000 transactions

| Field | Value |
|---|---|
| Milestone | M8 — Hardening |
| Depends on | AITJ-M4-01, AITJ-M5-01 |
| Blocks | AITJ-M8-06 |
| PRD refs | NFR-1, §6 Indexes, §8.3 Aggregation |
| Est. | 1.5 days |
| Phase | 🔴 RED |

## Context

NFR-1 commits to dashboard and transaction list rendering under 1.5s on a 4G connection with 10,000 transactions in the database. The RED phase seeds a database with 10,000 transactions spread across categories and years, measures server response time and client-side rendering under a throttled 4G profile, and asserts a p95 budget. Most critically, tests assert on QUERY COUNTS for the dashboard and list queries to catch N+1 introduced later, and verify the §6 indexes are actually used by inspecting EXPLAIN output.

## Acceptance criteria

- [ ] AC1 — Database is seeded with 10,000 transactions: spread across all income categories, all expense categories, and several years (e.g. 2023–2026); test data includes long descriptions and category names
- [ ] AC2 — Dashboard page (`/`) renders with server response time ≤1s and client-side render time ≤0.5s on a simulated 4G connection (2 Mbps down, 1 Mbps up, 100ms latency) using Lighthouse or a custom profiler
- [ ] AC3 — Transaction list page (`/transactions`, unfiltered, page 1 of ~400 pages) renders with server response time ≤1s and client-side render time ≤0.5s under 4G
- [ ] AC4 — Query count for dashboard aggregation (total income, total expenses, all-time balance) is exactly 1 or 2 queries; no N+1
- [ ] AC5 — Query count for transaction list page (25 rows, with count of filtered total) is at most 2 queries; no N+1 for categories or pagination
- [ ] AC6 — EXPLAIN output for the main transaction list query (`SELECT * FROM "Transaction" WHERE "deletedAt" IS NULL ORDER BY "occurredOn" DESC LIMIT 25`) shows the query uses the index `@@index([deletedAt, occurredOn(sort: Desc)])` from §6
- [ ] AC7 — EXPLAIN output for aggregate queries (SUM amount by type) shows the query uses appropriate indexes and does not require a full table scan
- [ ] AC8 — Worst-case scenario: 10,000 transactions concentrated in a single category and single month still render within the 1.5s budget
- [ ] AC9 — Dashboard category breakdown charts render all categories without timeout and SVG does not exceed 1MB
- [ ] AC10 — Database connection pool is sized appropriately (e.g. Prisma default or explicit `connection_limit=20`); no "too many connections" errors under load
- [ ] AC11 — Response headers include `Cache-Control: private, no-cache, no-store, must-revalidate` (no caching of dynamic responses); ETag is not set (or cache-busting is verified)
- [ ] AC12 — CSS and JS bundles are not unnecessarily large; unused CSS is tree-shaken by Tailwind; unused JS is removed by bundler

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | All 10,000 transactions in one category | Aggregation for that category still completes in <0.5s; category breakdown chart displays without timeout |
| E2 | All 10,000 transactions in one month | List filters to that month and shows page 1 (25 rows) in <1s; filtered totals are calculated correctly without re-scanning all rows |
| E3 | Paginating to page 400 (near the end of 10,000 rows) | Page loads in <1s; OFFSET query is efficient (may be slow if OFFSET 9975 is used; consider keyset pagination for v1.1) |
| E4 | Report generation for a 5-year custom range (all 10,000 transactions) | Report calculates totals and category breakdowns in <2s; CSV export completes without timeout or memory spike |
| E5 | Mobile client under 4G with 10,000 transactions | Dashboard loads and charts render within 1.5s total (server + client + network); interaction is responsive (not frozen) |
| E6 | Category filter with 1,000 transactions matching | List renders filtered page 1 (25 rows) in <1s; total count across all filtered rows is calculated and displayed |
| E7 | Date range filter spanning 4 years with 9,000 matching rows | List renders page 1 in <1s; filtered totals header shows sum of filtered rows, not all-time balance |
| E8 | Empty category (0 transactions) in breakdown chart | Chart omits the empty category; does not cause N+1 or timeout |
| E9 | Concurrent requests from 5 users viewing dashboard simultaneously | Database connection pool does not exhaust; all requests complete within 1.5s; no "too many connections" errors |
| E10 | 4G network hiccup (10s latency spike) | If network timeout is >10s, test does not hang; client retries or shows error gracefully |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | integration | `performance > seed 10000 transactions` | Database is seeded with 10,000 transactions; SELECT COUNT(*) FROM "Transaction" returns 10000 |
| T2 | integration | `performance > dashboard query count` | Query profiler for dashboard GET `/` shows exactly 2 database queries (one for totals, one for chart data, or combined); no N+1 |
| T3 | integration | `performance > transaction list query count` | Query profiler for `/transactions?page=1` shows exactly 2 queries (one for rows, one for total count); no N+1 for categories |
| T4 | integration | `performance > dashboard explain plan uses index` | EXPLAIN output for the aggregation query includes an index scan (not a full table scan) on `(deletedAt, type)` or `(deletedAt, occurredOn)` |
| T5 | integration | `performance > transaction list explain plan uses index` | EXPLAIN output for `SELECT * FROM "Transaction" WHERE deletedAt IS NULL ORDER BY occurredOn DESC LIMIT 25` shows use of `idx_deletedAt_occurredOn` or similar; no Seq Scan |
| T6 | e2e | `performance > dashboard response time under 4G` | Load dashboard with simulated 4G (2 Mbps, 100ms latency); measure time from request to page interactive; assertion: <1.5s (server ≤1s + client ≤0.5s) |
| T7 | e2e | `performance > transaction list response time under 4G` | Load `/transactions` with simulated 4G; measure time to first page render; assertion: <1.5s |
| T8 | e2e | `performance > worst-case single category single month` | 10,000 transactions concentrated in one category and one month; filter to that category and month; page renders in <1.5s; totals are correct |
| T9 | integration | `performance > category breakdown chart size` | Dashboard category chart SVG is generated; size is <1MB (assertion on `svgElement.outerHTML.length < 1_000_000`) |
| T10 | integration | `performance > pagination efficiency page 400` | Load page 400 of `/transactions` with 10,000 rows; measure query time; assertion: <1s (even with OFFSET, should be sub-second if index is used) |
| T11 | integration | `performance > report export 5-year range` | Generate report for custom date range spanning 4+ years (all 10,000 transactions); export to CSV; measure time; assertion: <2s; CSV file is generated without memory error |
| T12 | integration | `performance > cache headers correct` | Response includes `Cache-Control: private, no-cache, no-store, must-revalidate`; no `ETag` or `Last-Modified` present (or ETag is dynamic per request) |
| T13 | integration | `performance > connection pool size` | Under load (concurrent requests from 3+ clients), database connection count does not exceed the configured limit; no "too many connections" errors in logs |
| T14 | e2e | `performance > concurrent dashboard requests` | Simulate 5 concurrent requests to `/` dashboard; all complete within 1.5s each; no server errors or timeouts |

**Red gate:** Baseline measurements show response times exceed 1.5s. Query counts include N+1 patterns. EXPLAIN shows full table scans or index misses. Connection pool errors occur under concurrent load.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] Dashboard and transaction list both render under 1.5s on 4G with 10,000 transactions
- [ ] Query counts are verified (2 queries max for each major endpoint)
- [ ] EXPLAIN plans confirm indexes are used
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

- **Seeding 10,000 transactions:** Create a test utility `e2e/seed-perf.ts`:
  ```typescript
  export async function seed10k(prisma: PrismaClient) {
    const categories = await prisma.category.findMany();
    const users = await prisma.user.findMany();
    const transactions = [];
    for (let i = 0; i < 10000; i++) {
      const category = categories[i % categories.length];
      const user = users[0]; // Use one user for all
      const year = 2023 + (i % 4); // Spread across 2023–2026
      const month = i % 12;
      const day = (i % 28) + 1;
      transactions.push({
        type: category.type,
        amount: new Decimal((Math.random() * 5000 + 100).toFixed(2)),
        occurredOn: new Date(year, month, day),
        description: i % 100 === 0 ? 'Long description...'.repeat(20) : null,
        categoryId: category.id,
        createdById: user.id,
      });
    }
    await prisma.transaction.createMany({ data: transactions });
  }
  ```
- **Query profiling:** Use Prisma's built-in `queryRaw` tracing or a middleware that logs all queries. In tests, enable logging and count queries:
  ```typescript
  const queryCount = { count: 0 };
  prisma.$on('query', () => queryCount.count++);
  // Run the request or service call
  expect(queryCount.count).toBe(2);
  ```
- **EXPLAIN analysis:** Execute `EXPLAIN (ANALYZE) SELECT ...` and parse the output:
  ```typescript
  const explain = await prisma.$queryRaw`EXPLAIN (ANALYZE, FORMAT JSON) SELECT ...`;
  expect(explain[0].Plan.Node Type).not.toBe('Seq Scan');
  ```
- **4G throttling in Playwright:** Use Chrome DevTools Protocol or `page.route()` to simulate latency:
  ```typescript
  await page.route('**/*', route => {
    setTimeout(() => route.continue(), 50); // 50ms latency per request
  });
  ```
  Or use Lighthouse's 4G profile directly via `lighthouse-ci` or a custom profiler.
- **Response time measurement:** Use `performance.now()` or Playwright's timing:
  ```typescript
  const start = Date.now();
  await page.goto('/');
  const pageLoadTime = Date.now() - start;
  expect(pageLoadTime).toBeLessThan(1500);
  ```
- **Index verification:** After running tests, ensure the §6 indexes exist:
  ```sql
  SELECT indexname FROM pg_indexes WHERE tablename = 'Transaction';
  ```
  Verify `idx_deletedAt_occurredOn` is present.
- **Worst-case data generation:** For the single-category scenario, modify seeding to concentrate all 10,000 transactions into one category and one month.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] 10,000-transaction test database seeded reliably
- [ ] Dashboard and list both render <1.5s on simulated 4G with 10,000 rows
- [ ] Query counts verified (≤2 per major endpoint); no N+1
- [ ] EXPLAIN plans confirm indexes are used; no full table scans
- [ ] Worst-case scenarios (single category, single month, pagination to end) pass
- [ ] Connection pool is sized; no "too many connections" errors under concurrent load
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
