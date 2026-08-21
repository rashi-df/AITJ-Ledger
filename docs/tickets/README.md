# AITJ Ledger — ticket index

59 tickets across 9 milestones, derived from `docs/PRD.md`. Every one of the PRD's 79 requirement IDs (FR-* and NFR-*) is cited by at least one ticket.

**Read first:** [`_CONVENTIONS.md`](_CONVENTIONS.md) — authoring rules · [`_WORKFLOW.md`](_WORKFLOW.md) — the dev → review → QA pipeline · [`_TEMPLATE.md`](_TEMPLATE.md) — ticket structure

All tickets start at 🔴 RED. Move a ticket to 🟢 GREEN only when its full Definition of Done is satisfied.

## Ordering

Work M0 → M8, respecting each ticket's `Depends on`. Three cross-milestone dependencies matter:

- **AITJ-M5-01** (IST period engine) blocks **AITJ-M4-04** and all of M6. It is pure, self-contained logic — building it early, ahead of its milestone, removes the awkwardest ordering constraint in the plan.
- **AITJ-M5-02** (aggregation) is *extended* by M6, never reimplemented — PRD §8.3 requires the dashboard, list header and reports to share it so they cannot disagree.
- **AITJ-M7-04** (masjid name) feeds the print header in **AITJ-M6-06**, which falls back to "AITJ Ledger" (A11) if M7 lands later.

M1–M3 together form the vertical slice worth demoing to the client early (§14).

## M0 — Foundation

7 tickets · PRD §14 estimate: **3 d**

| Ticket | Title | PRD refs | Phase |
|---|---|---|---|
| [AITJ-M0-01](AITJ-M0-01-init-repo-tooling.md) | Initialise repository, TypeScript, ESLint, Prettier and Husky | §8.1, NFR-5 | 🟢 GREEN |
| [AITJ-M0-02](AITJ-M0-02-scaffold-next-tailwind-shadcn.md) | Scaffold Next.js 15 App Router with Tailwind and shadcn/ui | §8.1, §8.2, NFR-5 | 🟢 GREEN |
| [AITJ-M0-03](AITJ-M0-03-define-prisma-schema.md) | Define Prisma schema and initial migration | §6, A5, A6 | 🟢 GREEN |
| [AITJ-M0-04](AITJ-M0-04-add-raw-migration-constraints.md) | Add raw migration for case-insensitive category uniqueness and type check constraint | §6.1, FR-C6 | 🟢 GREEN |
| [AITJ-M0-05](AITJ-M0-05-docker-compose-setup.md) | Docker compose for app and PostgreSQL 16, plus the Makefile task runner | §12.1, §12.2, NFR-5 | 🟢 GREEN |
| [AITJ-M0-06](AITJ-M0-06-test-harness-setup.md) | Vitest, Testcontainers and Playwright test harness | §13, NFR-1 | 🟢 GREEN |
| [AITJ-M0-07](AITJ-M0-07-database-seed-script.md) | Database seed script for default categories and admin account | NFR-10, FR-C2, FR-C3, FR-A5, §12.2 | 🟢 GREEN |

## M1 — Auth

8 tickets · PRD §14 estimate: **4 d**

| Ticket | Title | PRD refs | Phase |
|---|---|---|---|
| [AITJ-M1-01](AITJ-M1-01-authjs-credentials-jwt.md) | Configure Auth.js v5 with Credentials provider and JWT sessions | FR-A3, FR-A4, FR-A10, §8.2 | 🟢 GREEN |
| [AITJ-M1-02](AITJ-M1-02-login-page-and-error.md) | Login page and generic authentication error | FR-A1, FR-A11, §10 | 🟢 GREEN |
| [AITJ-M1-03](AITJ-M1-03-route-protection-and-redirect.md) | Route protection middleware and post-login redirect | FR-A2, NFR-7 | 🟢 GREEN |
| [AITJ-M1-04](AITJ-M1-04-forced-password-change.md) | Forced password change for the seeded admin account | FR-A5, NFR-10 | 🔴 RED |
| [AITJ-M1-05](AITJ-M1-05-generate-and-manage-invites.md) | Generate and manage user invites | FR-A6, §6 Invite model | 🔴 RED |
| [AITJ-M1-06](AITJ-M1-06-accept-invite-set-name-password.md) | Accept an invite and set name and password | FR-A7, FR-A10, §6 Invite model, §10 | 🔴 RED |
| [AITJ-M1-07](AITJ-M1-07-profile-and-password-change.md) | Profile edit and self-service password change | FR-A8, FR-A10, §10 (Settings page), §5.7 FR-S1 | 🔴 RED |
| [AITJ-M1-08](AITJ-M1-08-deactivate-and-reactivate-users.md) | Deactivate and reactivate users with safety guards | FR-A9, §2, §5.7 FR-S2 | 🔴 RED |

## M2 — Categories

5 tickets · PRD §14 estimate: **2 d**

| Ticket | Title | PRD refs | Phase |
|---|---|---|---|
| [AITJ-M2-01](AITJ-M2-01-category-repository.md) | Category repository with type scoping and usage counts | FR-C1, §6, §6.1, §8.2, §8.3, §13, NFR-2 | 🔴 RED |
| [AITJ-M2-02](AITJ-M2-02-create-rename-categories.md) | Create and rename categories with case-insensitive uniqueness | FR-C4, FR-C5, FR-C6, §7, §8.2, §10 page 7 | 🔴 RED |
| [AITJ-M2-03](AITJ-M2-03-archive-delete-categories.md) | Archive, unarchive and delete categories with in-use protection | FR-C7, FR-C8, FR-C9, §6, §6.1, §8.2, §10 page 7 | 🔴 RED |
| [AITJ-M2-04](AITJ-M2-04-categories-page.md) | Categories page with income and expense sections | FR-C10, §8.2, §8.3, §10 page 7, NFR-3, NFR-4 | 🔴 RED |
| [AITJ-M2-05](AITJ-M2-05-category-audit-logging.md) | Category audit logging | FR-T12, §5.3 FR-T12, §6 AuditLog model, §8.2, NFR-2, NFR-8 | 🔴 RED |

## M3 — Transactions

8 tickets · PRD §14 estimate: **5 d**

| Ticket | Title | PRD refs | Phase |
|---|---|---|---|
| [AITJ-M3-01](AITJ-M3-01-transaction-zod-schema.md) | Build shared Zod transaction validation schema | FR-T1, FR-T2, FR-T3, FR-T4, FR-T5, §7, A1, A2, A5, A6, A10, §6.1 | 🔴 RED |
| [AITJ-M3-02](AITJ-M3-02-transaction-repository.md) | Build transaction repository with centralized soft-delete filtering | FR-T10, FR-T11, FR-T13, §6.1, §8.2, §8.3, NFR-1, A5, A6 | 🔴 RED |
| [AITJ-M3-03](AITJ-M3-03-audit-log-writer.md) | Build audit log writer bound to mutation transactions | FR-T12, NFR-2, §6, §8.2 | 🔴 RED |
| [AITJ-M3-04](AITJ-M3-04-create-transaction-action.md) | Build createTransaction Server Action with type and category invariants | FR-T1, FR-T2, FR-T3, FR-T4, FR-T5, §8.2, NFR-2, NFR-8 | 🔴 RED |
| [AITJ-M3-05](AITJ-M3-05-income-page-form.md) | Build Income page with fast-entry form | FR-T1, FR-T4, FR-T6, FR-T7, §10, A2, NFR-3, NFR-4 | 🔴 RED |
| [AITJ-M3-06](AITJ-M3-06-expenses-page-form.md) | Build Expenses page with fast-entry form | FR-T1, FR-T4, FR-T6, FR-T7, §10, A2, NFR-3, NFR-4 | 🔴 RED |
| [AITJ-M3-07](AITJ-M3-07-edit-transaction.md) | Edit a transaction including type switching and audit trails | FR-T8, FR-T13, §8.2, NFR-2, NFR-3, NFR-4 | 🔴 RED |
| [AITJ-M3-08](AITJ-M3-08-soft-delete-confirmation.md) | Soft delete transaction with confirmation dialog | FR-T9, FR-T10, FR-T11, §8.2, NFR-2, NFR-3, NFR-4 | 🔴 RED |

## M4 — Transaction list

7 tickets · PRD §14 estimate: **4 d**

| Ticket | Title | PRD refs | Phase |
|---|---|---|---|
| [AITJ-M4-01](AITJ-M4-01-paginated-transaction-query.md) | Paginated and sortable transaction query in the repository | FR-L7, FR-L8, §6 (indexes), §6.1 (deletedAt filter), §8.3 (aggregation), NFR-1 | 🔴 RED |
| [AITJ-M4-02](AITJ-M4-02-transactions-table-income-expense.md) | Transactions page table with income and expense distinction | FR-L1, FR-L2, FR-L7, §10 page 5, §8.1 (TanStack Table), NFR-3, NFR-4 | 🔴 RED |
| [AITJ-M4-03](AITJ-M4-03-debounced-search.md) | Debounced free-text search across description and category | FR-L3, §8.1 (nuqs for URL state, no library specified for debounce), §10 page 5 | 🔴 RED |
| [AITJ-M4-04](AITJ-M4-04-type-category-date-filters.md) | Type, category and date-range filters | FR-L4, FR-L5, FR-L6, §7 (date range validation), §8.1 (date-fns for IST), NFR-3 | 🔴 RED |
| [AITJ-M4-05](AITJ-M4-05-filtered-totals-csv-export.md) | Filtered totals header computed over the whole filter set | FR-L9, FR-L13, §8.3 (aggregation in SQL), NFR-1 | 🔴 RED |
| [AITJ-M4-06](AITJ-M4-06-url-state-nuqs.md) | URL-encoded filter, sort and page state with nuqs | FR-L10, §8.1 (nuqs), §10 page 5 | 🔴 RED |
| [AITJ-M4-07](AITJ-M4-07-mobile-cards-actions-empty-states.md) | Mobile card layout, row actions and empty states | FR-L11, FR-L12, §10 page 5, NFR-3, NFR-4, §8.1 (shadcn table) | 🔴 RED |

## M5 — Dashboard

6 tickets · PRD §14 estimate: **4 d**

| Ticket | Title | PRD refs | Phase |
|---|---|---|---|
| [AITJ-M5-01](AITJ-M5-01-ist-period-engine.md) | IST period resolution engine for all presets | FR-D3, A2, A3, A4, A5, §8.2, §8.3 | 🔴 RED |
| [AITJ-M5-02](AITJ-M5-02-aggregation-repository.md) | Aggregation repository for period totals and balance | FR-D1, FR-D2, FR-L9, FR-R2, §8.3, §6.1, A6, A10 | 🔴 RED |
| [AITJ-M5-03](AITJ-M5-03-dashboard-headline-cards.md) | Dashboard headline cards and all-time balance | FR-D1, FR-D2, FR-D4, FR-D5, §5.7, §8.1, §8.2, A1, A2, NFR-1, NFR-3, NFR-4 | 🔴 RED |
| [AITJ-M5-04](AITJ-M5-04-period-selector-url-state.md) | Period selector with URL persistence | FR-D3, FR-D9, FR-L6, §8.1, §8.2, A2, A3, A4 | 🔴 RED |
| [AITJ-M5-05](AITJ-M5-05-income-expense-trend-chart.md) | Income versus expense trend chart | FR-D6, §8.1, §8.3, A2, A6, NFR-1, NFR-3, NFR-4 | 🔴 RED |
| [AITJ-M5-06](AITJ-M5-06-category-charts-recent-activity.md) | Category breakdown charts and recent activity | FR-D7, FR-D8, FR-C7, §8.1, §8.3, A6, NFR-1, NFR-3, NFR-4 | 🔴 RED |

## M6 — Reports

6 tickets · PRD §14 estimate: **3 d**

| Ticket | Title | PRD refs | Phase |
|---|---|---|---|
| [AITJ-M6-01](AITJ-M6-01-report-aggregation-repository.md) | Report aggregation repository with category breakdowns | FR-R2, FR-R3, FR-R4, FR-R8, §8.3, §6.1 | 🔴 RED |
| [AITJ-M6-02](AITJ-M6-02-opening-closing-balance-calculation.md) | Opening and closing balance calculation | FR-R5, §6.1, A2 | 🔴 RED |
| [AITJ-M6-03](AITJ-M6-03-reports-page-period-selector-totals.md) | Reports page with period selector and totals | FR-R1, FR-R2, §5.6, §10 page 6, §8.2 | 🔴 RED |
| [AITJ-M6-04](AITJ-M6-04-category-breakdown-tables-percentages.md) | Category breakdown tables with percentage shares | FR-R3, FR-R4, FR-R8, NFR-4 | 🔴 RED |
| [AITJ-M6-05](AITJ-M6-05-csv-export-report.md) | CSV export of the report | FR-R6, A1, §6.1, NFR-1 | 🔴 RED |
| [AITJ-M6-06](AITJ-M6-06-print-stylesheet-print-view.md) | Print stylesheet and print view | FR-R7, A11, §8.1, §3.3, §13, NFR-4 | 🔴 RED |

## M7 — Settings & admin

5 tickets · PRD §14 estimate: **2 d**

| Ticket | Title | PRD refs | Phase |
|---|---|---|---|
| [AITJ-M7-01](AITJ-M7-01-settings-shell-profile.md) | Settings shell with profile and password sections | FR-S1, §10 page 8, §5.1 FR-A8, NFR-3, NFR-4 | 🔴 RED |
| [AITJ-M7-02](AITJ-M7-02-user-management-invites.md) | User management, invites and deactivation UI | FR-S2, FR-A6, FR-A7, FR-A9, §2, §5.1 FR-A6 to FR-A9, §10 page 8, NFR-3, NFR-4 | 🔴 RED |
| [AITJ-M7-03](AITJ-M7-03-deleted-transactions-restore.md) | Deleted transactions view with restore | FR-S4, FR-T10, FR-T11, FR-T12, FR-C7, §2, §6 models, §8.2, NFR-2, NFR-3, NFR-4 | 🔴 RED |
| [AITJ-M7-04](AITJ-M7-04-masjid-display-name-setting.md) | Masjid display name setting | FR-S3, §4 A11, §10 page 8, §5.6 FR-R7, NFR-3, NFR-4, §7 validation | 🔴 RED |
| [AITJ-M7-05](AITJ-M7-05-audit-log-viewer-filters.md) | Audit log viewer with user and date filters | FR-S5, §6 AuditLog model, §8.3 aggregation, NFR-3, NFR-4, NFR-8, §4 A2, §8.2 | 🔴 RED |

## M8 — Hardening

7 tickets · PRD §14 estimate: **4 d**

| Ticket | Title | PRD refs | Phase |
|---|---|---|---|
| [AITJ-M8-01](AITJ-M8-01-accessibility-audit.md) | Accessibility audit and WCAG 2.1 AA remediation | NFR-4, FR-T9, FR-T7, FR-D4, FR-D6, FR-D7, FR-L2, §13 Manual row | 🔴 RED |
| [AITJ-M8-02](AITJ-M8-02-responsive-qa.md) | Responsive QA from 360px to 1920px | NFR-3, NFR-9, FR-L11, FR-R7, §13 Manual row | 🔴 RED |
| [AITJ-M8-03](AITJ-M8-03-e2e-playwright-suite.md) | End-to-end Playwright suite for the key user flows | §11 key flows, §13 E2E row, NFR-9, FR-A6, FR-A7, FR-T9, FR-T11, FR-R1 | 🔴 RED |
| [AITJ-M8-04](AITJ-M8-04-security-headers-csp.md) | Security headers, CSP and HTTPS enforcement | NFR-5, NFR-6, NFR-7, NFR-8, §12.3 | 🔴 RED |
| [AITJ-M8-05](AITJ-M8-05-performance-validation.md) | Performance validation against 10,000 transactions | NFR-1, §6 Indexes, §8.3 Aggregation | 🔴 RED |
| [AITJ-M8-06](AITJ-M8-06-production-deployment.md) | Production deployment on a VPS behind a reverse proxy | §12.1 Containers, §12.2 env vars, §12.3 VPS + reverse proxy, §12.4 Local/Staging/Prod, NFR-10 | 🔴 RED |
| [AITJ-M8-07](AITJ-M8-07-backup-restore-handover.md) | Backup runbook, rehearsed restore and handover documentation | §12.5 backup runbook, §15 D1, NFR-10, §13 Manual row | 🔴 RED |

