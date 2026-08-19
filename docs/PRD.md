# Product Requirements Document
## AITJ Ledger — Masjid Income & Expense Management System

| Field | Value |
|---|---|
| Product | AITJ Ledger |
| Version | 1.0 (MVP) |
| Date | 19 August 2026 |
| Source | `docs/AITJ renevue.pdf` — Client Requirements Document |
| Status | **Approved** — 19 August 2026. All §15 client questions resolved. |

---

## 1. Overview

AITJ Ledger is a private, single-masjid web application that replaces the paper cash register used by a masjid committee. Authorized users record income and expense entries, browse and filter the full transaction history, and see automatically calculated totals — total income, total expenses, and current balance — for any period.

The product is deliberately **not** an accounting system. It is a *digital register*. Every design decision favours simplicity, clarity, and arithmetic that is always correct over feature breadth.

### 1.1 Problem

Masjid finances are typically kept in a physical notebook. This makes it slow to answer basic questions ("how much did we spend on electricity this year?"), impossible to search, easy to miscalculate, and fragile — a lost or damaged book loses the record entirely.

### 1.2 Goals

| # | Goal |
|---|---|
| G1 | Record an income or expense entry in under 15 seconds, on a phone, by a non-technical committee member |
| G2 | Totals and balance are always derived from transactions — never typed in, never stale |
| G3 | Answer "what came in and what went out, for this period, by category" in one screen |
| G4 | Keep financial data behind a login; nothing is publicly reachable |
| G5 | Full history is preserved and attributable — nothing silently disappears |

### 1.3 Success criteria

- Committee stops maintaining the parallel paper register within one month of handover.
- Monthly summary can be produced and printed for a committee meeting in under 2 minutes.
- Zero balance discrepancies between the app and the sum of its own recorded transactions.
- All primary flows usable on a 360px-wide phone screen.

---

## 2. Users & roles

A single user type: **Committee User**. Every authenticated user can create, edit, and delete transactions, manage categories, and invite other users. There is no role hierarchy in v1, per the client requirement.

**Account provisioning is closed.** There is no public signup page.

- A single **admin account is seeded** on first deployment from environment variables. Per the client (Q4), **v1 launches with this one account only**; further committee members are added later by invite, so the invite flow still ships in v1.
- Any authenticated user can invite another by email from **Settings → Users**; the invite produces a single-use, time-limited link on which the invitee sets their own password.
- Users can be **deactivated** (login blocked) but never deleted, so their historical attribution on past transactions survives.

> **Note for the client:** the doc says "no complex user roles". This design honours that — everyone has equal permissions. If the committee later wants "only the treasurer may delete", that is an additive change to a single permission check, not a rearchitecture.

---

## 3. Scope

### 3.1 In scope (v1)

- Login / logout / session management, invite-based user creation, profile & password change
- Income entry: amount, category, date, optional description
- Expense entry: amount, category, date, optional description
- Unified transaction list: search, filter by type / category / date range, sort by date or amount, paginate
- Edit and delete (with confirmation) of any transaction
- Dashboard: total income, total expenses, current balance, with Today / This Week / This Month / This Year / Custom period filters
- Dashboard charts: income vs expense trend, category breakdown *(added — see §3.3)*
- Reports: period summary with category-wise breakdown for income and expenses
- Report export: **CSV** and **print-to-PDF** *(added — see §3.3)*
- Category management: create, rename, archive, per type
- Soft delete with restore, plus a full audit trail of create / edit / delete *(added — see §3.3)*
- Responsive layout: phone, tablet, laptop, desktop

### 3.2 Out of scope (v1) — as specified by the client

Multiple masjids · subscription plans · payment gateway · bank integration · payment-method (cash/bank/UPI/cheque) tracking · online donation collection · donor management · Zakat calculation · payroll · inventory · asset management · double-entry bookkeeping · multi-level permissions · public-facing website · native mobile app · **import of historical data from the existing paper register** *(client answer to Q3 — the ledger starts empty)*.

### 3.3 Additions beyond the client document

These were agreed as v1 scope because they materially raise the product's value or protect the data, at low incremental cost:

| Addition | Rationale |
|---|---|
| Dashboard charts (Recharts) | Turns a table of numbers into something a committee can read at a glance in a meeting. |
| CSV export | Backup and accountant hand-off; the committee's insurance against vendor lock-in. |
| Print / PDF report | Masjid committees present and post financial summaries. Implemented as a dedicated print stylesheet using the browser's native print-to-PDF — no headless-Chromium dependency in the container. |
| Soft delete + audit log | A financial register that can silently lose a row is not trustworthy. Deleted rows are hidden and excluded from every total, but recoverable, and every mutation records who did what and when. |

### 3.4 Deferred (recommended for v1.1)

- **Automated nightly database backups** (`pg_dump` sidecar with retention). **The client has decided against automation for v1 — manual backups only (Q6).** This decision is recorded rather than argued: on a self-hosted VPS it leaves the single largest risk to the product's core promise unmitigated, since the committee's only financial record then depends on someone remembering to run a command. The manual runbook in §12.5 ships as the sole backup mechanism, and automation remains the top v1.1 recommendation.
- Configurable currency/timezone in Settings; recurring transactions; monthly email summary; attachment/receipt upload; light roles (Admin vs Member).

---

## 4. Assumptions & decisions

| ID | Decision |
|---|---|
| A1 | **Currency: INR (₹)**, formatted `en-IN` (e.g. `₹1,50,000.00`). Hardcoded in v1. *Confirmed by client (Q1).* |
| A2 | **Timezone: Asia/Kolkata (IST).** All period boundaries (Today, This Week, …) are computed in IST regardless of the client device's timezone. *Confirmed by client (Q1).* |
| A3 | **Week starts Monday**, ends Sunday. |
| A4 | **Financial year is not modelled.** "This Year" means the calendar year, **1 Jan – 31 Dec**, computed in IST. *Confirmed by client (Q5).* Should the committee later need Apr–Mar reporting, a Custom Range covers it manually, and making the year boundary configurable is a v1.1 addition to the period engine alone. |
| A5 | Transaction dates are stored as **calendar dates** (`DATE`, no time component) to eliminate timezone drift. |
| A6 | Amounts are stored as `DECIMAL(14,2)` — exact, never floating point. Max single transaction ₹99,99,99,999.99. |
| A7 | **Future-dated transactions are allowed** (e.g. a post-dated commitment) but the UI warns. Dates before 1 Jan 2000 are rejected. |
| A8 | Expected data volume is small — a few thousand transactions per year. No archival or partitioning strategy required. |
| A9 | Single-language UI: **English**. Layout must not break if labels are later translated to Urdu/Malayalam. |
| A10 | Amounts are always positive. Direction is expressed by the transaction's `type`, never by a negative sign. |
| A11 | **Masjid display name defaults to "AITJ Ledger"** (§5.7 FR-S3), used in headers and printed reports until the client supplies the formal name. No logo is supplied for v1; report headers are text-only. *Client answer to Q2.* |
| A12 | **The system launches with an empty ledger.** No historical data is imported from the existing paper register; the first transaction is entered by hand. *Client answer to Q3.* |

---

## 5. Functional requirements

### 5.1 Authentication & accounts

| ID | Requirement | Priority |
|---|---|---|
| FR-A1 | A user logs in with email + password. Invalid credentials return a single generic error ("Invalid email or password") that does not reveal whether the email exists. | Must |
| FR-A2 | All routes except `/login` and `/invite/[token]` require an authenticated session. Unauthenticated access redirects to `/login` preserving the intended destination. | Must |
| FR-A3 | Sessions are httpOnly, secure, sameSite=lax cookies with a 7-day sliding expiry. | Must |
| FR-A4 | A user can log out from any page; the session is invalidated immediately. | Must |
| FR-A5 | On first boot, if no user exists, an admin account is seeded from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. The app forces a password change on that account's first login. | Must |
| FR-A6 | A user can invite another by email. The system generates a single-use token, valid 72 hours, delivered as a copyable link (email delivery is optional and not required for v1). | Must |
| FR-A7 | An invitee sets their own name and password via the invite link. The token is consumed on use. | Must |
| FR-A8 | A user can change their own name and password. Password change requires the current password. | Must |
| FR-A9 | A user can deactivate another user. Deactivated users cannot log in; their name still appears on historical records. A user cannot deactivate themselves or the last active account. | Must |
| FR-A10 | Passwords: minimum 10 characters, hashed with bcrypt (cost 12). Never logged, never returned by any API. | Must |
| FR-A11 | Login is rate-limited to 5 failed attempts per email per 15 minutes. | Should |

### 5.2 Categories

| ID | Requirement | Priority |
|---|---|---|
| FR-C1 | Every category belongs to exactly one type: `INCOME` or `EXPENSE`. | Must |
| FR-C2 | Seeded income categories: Donation, Zakat, Sadaqah, Jumu'ah Collection, Membership/Contribution, Other. | Must |
| FR-C3 | Seeded expense categories: Electricity, Water, Maintenance, Cleaning, Salary/Wages, Construction, Equipment, Events/Programs, Office Expenses, Other. | Must |
| FR-C4 | A user can create a category with a name and type. | Must |
| FR-C5 | A user can rename a category. Renaming updates it everywhere — transactions reference the category by ID, not by name. | Must |
| FR-C6 | Category names are unique per type, case-insensitively. "Water" and "water" cannot coexist as expense categories, but an income "Other" and an expense "Other" can. | Must |
| FR-C7 | A category **in use by any transaction cannot be deleted** — it can only be **archived**. Archived categories are hidden from the entry-form dropdown but still render on historical transactions and in reports. | Must |
| FR-C8 | A category with zero transactions can be permanently deleted. | Should |
| FR-C9 | An archived category can be unarchived. | Should |
| FR-C10 | The Categories page lists income and expense categories in separate sections, each showing transaction count and lifetime total. | Should |

### 5.3 Transactions (income & expense)

| ID | Requirement | Priority |
|---|---|---|
| FR-T1 | A transaction consists of: type (Income/Expense), amount, category, date, and an optional description. There is **no payment-method field**. | Must |
| FR-T2 | Amount is required, numeric, greater than 0, maximum 2 decimal places. | Must |
| FR-T3 | Category is required and must match the transaction's type and be non-archived at time of entry. | Must |
| FR-T4 | Date is required and defaults to today (IST). | Must |
| FR-T5 | Description is optional, maximum 500 characters, trimmed. | Must |
| FR-T6 | The Income page provides an add-income form and a list filtered to income only. The Expenses page mirrors this for expenses. | Must |
| FR-T7 | After a successful save, the form clears (keeping the date) so consecutive entries are fast, and a success toast appears with an Undo affordance. | Should |
| FR-T8 | A user can edit any field of an existing transaction, including switching its type — switching type clears the category and forces reselection. | Must |
| FR-T9 | Deletion requires an explicit confirmation dialog reading "Are you sure you want to delete this transaction?" and showing the transaction's amount, category, and date. | Must |
| FR-T10 | Deletion is a **soft delete**: the record is marked deleted with timestamp and actor, excluded from every list, total, chart, and export. | Must |
| FR-T11 | Deleted transactions are visible in **Settings → Deleted transactions** and can be restored. | Should |
| FR-T12 | Every create, update, delete, and restore writes an audit entry recording actor, timestamp, action, and before/after values. | Must |
| FR-T13 | Each transaction detail view shows "Added by {user} on {date}" and, if edited, "Last edited by {user} on {date}". | Should |

### 5.4 Transaction list

| ID | Requirement | Priority |
|---|---|---|
| FR-L1 | The Transactions page lists all non-deleted transactions with columns: Date, Type, Category, Description, Amount. | Must |
| FR-L2 | Income and expense amounts are visually distinguished (colour + sign prefix) without relying on colour alone. | Must |
| FR-L3 | Free-text search matches description and category name, case-insensitive, debounced. | Must |
| FR-L4 | Filter by type (All / Income / Expense). | Must |
| FR-L5 | Filter by one or more categories. | Must |
| FR-L6 | Filter by date range, with the same presets as the dashboard plus Custom. | Must |
| FR-L7 | Sort by date (default, newest first) and by amount, both directions. | Must |
| FR-L8 | Server-side pagination, 25 rows per page, with a total-count indicator. | Must |
| FR-L9 | The list header shows the filtered totals: income, expenses, and net for the **current filter set**, not just the current page. | Must |
| FR-L10 | All filters, sort, and page state are encoded in the URL query string so a view can be bookmarked, shared, and survives a refresh or a back-navigation from an edit. | Should |
| FR-L11 | Row actions: Edit and Delete. On phones the table collapses into stacked cards. | Must |
| FR-L12 | Empty states distinguish "no transactions yet" (with a CTA to add one) from "no results for these filters" (with a Clear filters action). | Should |
| FR-L13 | The current filtered set can be exported to CSV. | Should |

### 5.5 Dashboard

| ID | Requirement | Priority |
|---|---|---|
| FR-D1 | Three headline cards: **Total Income**, **Total Expenses**, **Current Balance**, for the selected period. | Must |
| FR-D2 | `Current Balance = Total Income − Total Expenses`, always computed from transactions. It is never editable or manually entered. | Must |
| FR-D3 | Period selector: Today, This Week, This Month, This Year, Custom Range. Default: This Month. | Must |
| FR-D4 | A negative balance is displayed clearly and without error (a deficit period is legitimate). | Must |
| FR-D5 | Alongside the period balance, the dashboard shows the **all-time balance** — the committee's actual cash position — so a monthly view is never mistaken for total funds. | Must |
| FR-D6 | Chart: income vs expenses over time within the period (daily for short periods, monthly for year/long ranges). | Should |
| FR-D7 | Chart: expense breakdown by category, and income breakdown by category, for the period. | Should |
| FR-D8 | The five most recent transactions are listed with a link to the full list. | Should |
| FR-D9 | The selected period persists in the URL. | Should |

### 5.6 Reports / summary

| ID | Requirement | Priority |
|---|---|---|
| FR-R1 | A report is generated for a selected period using the same period presets plus Custom. | Must |
| FR-R2 | The report shows total income, total expenses, and net balance for the period. | Must |
| FR-R3 | Category-wise income breakdown: category, transaction count, total amount, % of total income. | Must |
| FR-R4 | Category-wise expense breakdown: same columns against total expenses. | Must |
| FR-R5 | Opening balance (all transactions before the period start) and closing balance (opening + period net) are shown, so the report reconciles against the register. | Should |
| FR-R6 | The report can be exported as CSV. | Should |
| FR-R7 | The report has a print view — clean typography, no navigation chrome, masjid name and period in the header — producing a PDF via the browser's print dialog. | Should |
| FR-R8 | Categories with zero activity in the period are omitted. | Should |

### 5.7 Settings / profile

| ID | Requirement | Priority |
|---|---|---|
| FR-S1 | View and edit own name; change own password. | Must |
| FR-S2 | Manage users: list, invite, deactivate, reactivate. | Must |
| FR-S3 | Set the masjid's display name, used in headers and printed reports. Defaults to **"AITJ Ledger"** (§4 A11) and is editable in Settings, so the formal name can be applied without a redeploy. | Should |
| FR-S4 | View and restore soft-deleted transactions. | Should |
| FR-S5 | View the audit log, filterable by user and date. | Could |

---

## 6. Data model

```prisma
enum TransactionType { INCOME EXPENSE }
enum AuditAction    { CREATE UPDATE DELETE RESTORE }

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  isActive     Boolean  @default(true)
  mustChangePassword Boolean @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  createdTransactions Transaction[] @relation("createdBy")
  updatedTransactions Transaction[] @relation("updatedBy")
  deletedTransactions Transaction[] @relation("deletedBy")
  invitesSent         Invite[]      @relation("invitedBy")
  auditLogs           AuditLog[]
}

model Invite {
  id          String    @id @default(cuid())
  email       String
  tokenHash   String    @unique
  expiresAt   DateTime
  acceptedAt  DateTime?
  invitedById String
  invitedBy   User      @relation("invitedBy", fields: [invitedById], references: [id])
  createdAt   DateTime  @default(now())

  @@index([email])
}

model Category {
  id         String          @id @default(cuid())
  name       String
  type       TransactionType
  isArchived Boolean         @default(false)
  sortOrder  Int             @default(0)
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  transactions Transaction[]

  // Case-insensitive uniqueness enforced by a citext column or a
  // functional unique index on (lower(name), type) via raw migration.
  @@unique([name, type])
  @@index([type, isArchived])
}

model Transaction {
  id          String          @id @default(cuid())
  type        TransactionType
  amount      Decimal         @db.Decimal(14, 2)
  occurredOn  DateTime        @db.Date
  description String?         @db.VarChar(500)

  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  createdById String
  createdBy   User     @relation("createdBy", fields: [createdById], references: [id])
  updatedById String?
  updatedBy   User?    @relation("updatedBy", fields: [updatedById], references: [id])

  deletedAt   DateTime?
  deletedById String?
  deletedBy   User?    @relation("deletedBy", fields: [deletedById], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([deletedAt, occurredOn(sort: Desc)])
  @@index([deletedAt, type, occurredOn])
  @@index([deletedAt, categoryId])
}

model AuditLog {
  id         String      @id @default(cuid())
  entityType String                       // "Transaction" | "Category" | "User"
  entityId   String
  action     AuditAction
  actorId    String
  actor      User        @relation(fields: [actorId], references: [id])
  before     Json?
  after      Json?
  createdAt  DateTime    @default(now())

  @@index([entityType, entityId])
  @@index([createdAt(sort: Desc)])
}

model AppSetting {
  key       String   @id          // e.g. "masjidName"
  value     String
  updatedAt DateTime @updatedAt
}
```

### 6.1 Model notes

- `Transaction.type` is denormalized from `Category.type`. A server-side invariant (and a DB check constraint added by raw migration) guarantees they always agree; the denormalization keeps type filtering and totals index-only.
- `onDelete: Restrict` on the category relation enforces FR-C7 at the database level, not just in application code.
- **Every read query must filter `deletedAt: null`.** This is centralized in a single repository layer (§8.2) rather than repeated at call sites, so a forgotten filter cannot corrupt a total.
- Prisma returns `Decimal` objects; amounts are converted to strings at the serialization boundary and formatted with `Intl.NumberFormat('en-IN')` in the UI. Amounts never become JS `number` in code that sums them — aggregation happens in PostgreSQL.

---

## 7. Validation rules (Zod)

A single schema module is the source of truth, imported by the client form, the server action, and the tests. Client-side validation is convenience only; the server always re-validates.

| Field | Rule | Error message |
|---|---|---|
| `amount` | Coerced number, `> 0`, `<= 99999999999.99`, max 2 dp | "Enter an amount greater than 0" |
| `type` | Enum `INCOME` \| `EXPENSE` | "Select a type" |
| `categoryId` | cuid; must exist, match `type`, and be non-archived | "Select a category" |
| `occurredOn` | Valid date, `>= 2000-01-01`, `<= today + 1 year` | "Enter a valid date" |
| `description` | Optional string, trimmed, `<= 500` | "Description is too long (max 500)" |
| `name` (category) | Trimmed, 1–50 chars, unique per type (case-insensitive) | "A category with this name already exists" |
| `email` | Valid email, lowercased, `<= 255` | "Enter a valid email address" |
| `password` | 10–72 chars | "Password must be at least 10 characters" |
| Date range | `from <= to`, span `<= 5 years` | "Start date must be before end date" |

---

## 8. Technical architecture

### 8.1 Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Server Components for data-heavy pages; Server Actions for mutations — no separate API layer to build or secure. |
| Language | **TypeScript** (`strict: true`) | |
| Styling | **Tailwind CSS** | |
| UI | **shadcn/ui** | Dialog, Form, Table, Select, Popover+Calendar, Toast (sonner), Tabs, Card. |
| Database | **PostgreSQL 16** | |
| ORM | **Prisma** | Migrations are the schema source of truth. |
| Validation | **Zod** | Shared client/server schemas. |
| Charts | **Recharts** | Rendered in client components with a server-computed data payload. |
| Auth | **Auth.js v5 (NextAuth)**, Credentials provider, JWT sessions | JWT strategy avoids a session table; no OAuth provider needed. |
| Table | **TanStack Table** (via shadcn data-table) | Sorting/column model; pagination and filtering are server-side. |
| URL state | **nuqs** | Backs FR-L10 / FR-D9 without hand-rolled query-string plumbing. |
| Dates | **date-fns** + `@date-fns/tz` | IST-correct period boundaries (A2). |
| Container | **Docker** + docker compose | |
| Tests | **Vitest** (unit/integration) + **Playwright** (E2E) | |
| Quality | ESLint, Prettier, `tsc --noEmit`, Husky pre-commit | |

**Rationale on the additions to your list:** Auth.js, TanStack Table, nuqs, and date-fns are the four gaps between the stack you named and the requirements as written — authentication (FR-A*), a sortable/paginated grid (FR-L*), shareable filter state (FR-L10), and timezone-correct period math (A2/FR-D3). Each is small and conventional. Nothing else is needed.

### 8.2 Layering

```
app/          Route segments, layouts, pages (Server Components by default)
  (auth)/     login, invite/[token]
  (app)/      dashboard, income, expenses, transactions, reports, categories, settings
  api/        Route handlers: auth, CSV export
components/   ui/ (shadcn primitives) + feature components
lib/
  auth/       Auth.js config, session helpers, password hashing
  db/         Prisma client singleton
  repositories/  ALL data access. Sole owner of the deletedAt filter and of aggregation SQL.
  validation/ Zod schemas shared by forms, actions, and tests
  period/     Period preset -> {from, to} resolution in Asia/Kolkata
  format/     Currency and date formatting (en-IN)
actions/      Server Actions: authenticate -> validate -> repository -> audit -> revalidate
prisma/       schema.prisma, migrations/, seed.ts
```

**Every Server Action follows the same five steps:** assert session → parse input with Zod → call a repository method inside a transaction → write the audit entry in that same transaction → `revalidatePath`. An action that skips the session assert is a security defect; this is enforced by a shared `authedAction` wrapper rather than by discipline.

### 8.3 Aggregation

Totals are computed by SQL `SUM` with a `WHERE deletedAt IS NULL` predicate — never by fetching rows into Node and adding them up. Dashboard, list header totals, and reports all call the same repository functions, so the three surfaces cannot disagree.

---

## 9. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Dashboard and transaction list render in under 1.5s on a 4G connection with 10,000 transactions in the database. |
| NFR-2 | Every mutation is atomic: the transaction row and its audit entry commit together or not at all. |
| NFR-3 | Fully responsive from 360px to 1920px. Tap targets ≥ 44px. Tables become cards below 768px. |
| NFR-4 | WCAG 2.1 AA: keyboard-navigable, labelled form controls, visible focus rings, 4.5:1 contrast, income/expense never distinguished by colour alone. |
| NFR-5 | All secrets come from environment variables. No credential is ever committed. |
| NFR-6 | HTTPS enforced in production; HSTS, `X-Frame-Options: DENY`, and a restrictive CSP set. |
| NFR-7 | Every mutating action is protected against CSRF (native to Server Actions). |
| NFR-8 | Structured server logs for auth events and mutations; no amounts, passwords, or tokens in logs. |
| NFR-9 | Supported browsers: last 2 versions of Chrome, Safari, Firefox, Edge; iOS Safari and Chrome Android. |
| NFR-10 | The app boots against an empty database and self-seeds categories and the admin account. |

---

## 10. Page specifications

| # | Route | Purpose | Key elements |
|---|---|---|---|
| 1 | `/login` | Authenticate | Email, password, submit, generic error |
| 2 | `/` | Dashboard | Period selector · 3 headline cards + all-time balance · trend chart · category charts · recent 5 |
| 3 | `/income` | Fast income entry | Add form (amount, category, date, description) · income-only list |
| 4 | `/expenses` | Fast expense entry | Same, for expenses |
| 5 | `/transactions` | Full register | Search · type/category/date filters · sortable paginated table · filtered totals · row edit/delete · CSV export |
| 6 | `/reports` | Period summary | Period selector · totals · opening/closing balance · income & expense category tables · export CSV · print |
| 7 | `/categories` | Manage categories | Income and expense sections · add/rename/archive/delete · usage counts |
| 8 | `/settings` | Profile & admin | Profile · password · users & invites · masjid name · deleted transactions · audit log |
| — | `/invite/[token]` | Accept invite | Name, password, confirm |

**Navigation:** persistent sidebar on desktop; bottom tab bar on mobile with the five primary destinations (Dashboard, Income, Expenses, Transactions, More).

---

## 11. Key user flows

**Record a Friday collection.** Login → Income → amount `5000`, category `Jumu'ah Collection`, date defaults to today, description `Friday donation` → Save → toast confirms, form resets with the date retained, dashboard totals update on next visit.

**Correct a mistake.** Transactions → search `electricity` → Edit on the wrong row → change amount → Save → audit log records the before/after and the actor.

**Delete safely.** Transactions → Delete → confirmation dialog quoting the amount, category and date → Confirm → row disappears from all lists and totals, remains restorable under Settings → Deleted transactions.

**Monthly committee report.** Reports → This Month → review totals and category breakdowns → Print → save as PDF or print for the meeting.

---

## 12. Deployment

### 12.1 Containers

Two services in `docker-compose.yml`:

- **`app`** — multi-stage Dockerfile (deps → build → runner) using Next.js `output: 'standalone'`, running as a non-root user, with a `/api/health` healthcheck.
- **`db`** — `postgres:16-alpine`, named volume for persistence, healthcheck via `pg_isready`; `app` waits on `db` being healthy.

Migrations (`prisma migrate deploy`) and seeding run at container start before the server accepts traffic. A separate `docker-compose.dev.yml` provides hot reload and an exposed database port.

### 12.2 Environment variables

`DATABASE_URL` · `AUTH_SECRET` · `AUTH_URL` · `SEED_ADMIN_EMAIL` · `SEED_ADMIN_PASSWORD` · `NODE_ENV` · `TZ=Asia/Kolkata`

### 12.3 Target

Single VPS behind a reverse proxy (Caddy or Nginx) terminating TLS with an automatically renewed certificate.

### 12.4 Environments

Local (compose dev) → Staging (optional, for client UAT) → Production.

### 12.5 Backup runbook — manual, by client decision (Q6)

A documented weekly `docker compose exec db pg_dump` command with an off-server copy, handed to whoever administers the deployment. **This is the only backup mechanism in v1** — the client has declined automated backups (§3.4). Consequences to accept explicitly:

- Data loss on failure is bounded by the time since the last manual run, not by a fixed nightly window.
- The runbook is only as reliable as the person executing it; a named owner must be assigned at handover.
- Restore must be rehearsed once during M8 against a real dump, so the procedure is known to work before it is needed.

Automating this remains the top v1.1 recommendation.

---

## 13. Testing

| Level | Coverage |
|---|---|
| Unit | Zod schemas at their boundaries; period resolution across month/year/DST-free IST edges; currency and date formatting; balance arithmetic on decimals. |
| Integration | Repository layer against a real Postgres (Testcontainers or a disposable compose service): totals exclude soft-deleted rows; category-in-use cannot be deleted; audit rows are written in the same transaction; type/category mismatch is rejected. |
| E2E (Playwright) | Login → add income → add expense → verify dashboard balance; filter and search the list; edit a transaction; delete with confirmation and restore; generate a report; accept an invite. Run at both desktop and mobile viewports. |
| Manual | Real-device check on one Android phone and one iPhone; print output verified from Chrome and Safari. |

**Definition of done** for any requirement: implemented, validated on the server, covered by at least one automated test, responsive at 360px, keyboard-accessible, and reflected in the audit log if it mutates data.

---

## 14. Delivery plan

| Milestone | Contents | Est. |
|---|---|---|
| M0 — Foundation | Repo, Next.js + TS + Tailwind + shadcn, Prisma schema, Docker compose, CI, seed script | 3 d |
| M1 — Auth | Login/logout, session middleware, admin seed, invites, profile, password change | 4 d |
| M2 — Categories | CRUD, archive, seeded defaults, in-use protection | 2 d |
| M3 — Transactions | Income & expense entry, edit, soft delete + confirm, audit log | 5 d |
| M4 — Transaction list | Search, filters, sort, pagination, URL state, filtered totals, mobile cards | 4 d |
| M5 — Dashboard | Period engine, headline cards, all-time balance, Recharts visuals, recent activity | 4 d |
| M6 — Reports | Period summary, category breakdowns, opening/closing balance, CSV, print view | 3 d |
| M7 — Settings & admin | User management, deleted-transaction restore, audit viewer, masjid name | 2 d |
| M8 — Hardening | Accessibility pass, responsive QA, E2E suite, security headers, production deploy, handover docs, **rehearsed restore from a real `pg_dump`** (§12.5) | 4 d |

**Total: ~31 working days** for a single developer, excluding client review cycles. M1–M3 constitute a demonstrable vertical slice worth showing the client early.

---

## 15. Client answers & remaining questions

Answers received from the client on **19 August 2026**. **All six are resolved — no client input is outstanding and no milestone is blocked.**

| # | Question | Answer | Status | Applied to |
|---|---|---|---|---|
| Q1 | Currency and timezone? | **INR (₹) and IST (Asia/Kolkata).** | ✅ Resolved | §4 A1, A2 |
| Q2 | Exact masjid name and logo? | **"AITJ Ledger"** for now; no logo supplied. Editable in Settings when the formal name is decided. | ✅ Resolved | §4 A11, §5.7 FR-S3 |
| Q3 | Import historical data at launch? | **No.** The ledger starts empty; no import script is built. | ✅ Resolved | §3.2, §4 A12 |
| Q4 | How many committee members need accounts? | **One admin account** at launch. The invite flow still ships so members can be added later without a code change. | ✅ Resolved | §2, §5.1 FR-A5/A6 |
| Q5 | Should the financial year be April–March rather than the calendar year? | **Calendar year (1 Jan – 31 Dec).** "This Year" resolves to the calendar year in every dashboard and report preset. | ✅ Resolved | §4 A4, §5.5 FR-D3, §5.6 FR-R1 |
| Q6 | Automated backups, or manual only? | **Manual only.** Automated backups stay deferred to v1.1. | ✅ Resolved *(risk accepted)* | §3.4, §12.5 |

### Q5 — decision recorded

The client selected the **calendar year**. "This Year" therefore means 1 January – 31 December, resolved in IST, everywhere the period preset appears (dashboard §5.5 FR-D3, reports §5.6 FR-R1).

The Indian financial year (1 Apr – 31 Mar) was the alternative and is the standard for accounts presented to a trust board, auditor, or registrar. It was not chosen. Two things make this low-risk to have decided this way:

- **Custom Range already covers it.** Anyone needing 1 Apr – 31 Mar figures for an external audience can select those dates and get a correct, complete report — no feature is missing, only a one-click preset.
- **Reversing it is contained.** The year boundary lives in the period-resolution engine (§8.3). Changing or making it configurable touches that module and its unit tests, not the dashboard, reports, or data model — a v1.1 change of hours, not days.

### Remaining decisions before handover

| # | Item | Needed by |
|---|---|---|
| D1 | Name the person responsible for running the weekly manual backup (§12.5), since no automation ships. | Before M8 |
| D2 | Supply the formal masjid name (and logo, if wanted) to replace the "AITJ Ledger" default. Not blocking — the default ships and is editable in Settings. | Before M6 |

Neither is a blocker for starting development; both are operational items for handover.
