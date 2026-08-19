# AITJ-M0-02 — Scaffold Next.js 15 App Router with Tailwind and shadcn/ui

| Field | Value |
|---|---|
| Milestone | M0 — Foundation |
| Depends on | AITJ-M0-01 |
| Blocks | AITJ-M0-03, AITJ-M0-05, AITJ-M0-06 |
| PRD refs | §8.1, §8.2, NFR-5 |
| Est. | 1 day |
| Phase | 🔴 RED |

## Context

This ticket scaffolds the Next.js 15 App Router framework, Tailwind CSS for styling, and shadcn/ui for unstyled, accessible component primitives. It establishes the directory structure specified in §8.2 (Layering), which is the foundation for all subsequent feature work.

## Acceptance criteria

- [ ] AC1 — Next.js 15 installed and configured for App Router (not Pages Router)
- [ ] AC2 — Tailwind CSS integrated with `@tailwindcss/forms` and `@tailwindcss/typography` plugins
- [ ] AC3 — shadcn/ui initialized with a components.json configuration
- [ ] AC4 — Directory structure created per §8.2: `app/`, `components/`, `lib/`, `actions/`, `prisma/`
  - [ ] `app/(auth)/` with layout for login and invite routes (pages not yet implemented)
  - [ ] `app/(app)/` with layout for authenticated routes (pages not yet implemented)
  - [ ] `app/api/` directory for route handlers (not yet implemented)
  - [ ] `components/ui/` for shadcn primitives
  - [ ] `lib/auth/`, `lib/db/`, `lib/repositories/`, `lib/validation/`, `lib/period/`, `lib/format/`
  - [ ] `actions/` directory for Server Actions (not yet implemented)
  - [ ] `prisma/` directory with schema.prisma and migrations/ folder
- [ ] AC5 — A minimal landing/404 page renders without error
- [ ] AC6 — Tailwind build succeeds: `pnpm build` compiles CSS
- [ ] AC7 — No hardcoded secrets in code or config
- [ ] AC8 — `next.config.js` is present and typescript/ESLint integration is configured

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Import a shadcn component that does not exist yet | The component exists in the codebase after running `pnpm exec shadcn-ui@latest add [component]` |
| E2 | Build is run without setting DATABASE_URL | Build succeeds (DATABASE_URL is not read at build time; it is only needed at runtime) |
| E3 | CSS in Tailwind build conflicts with existing styles | No conflicts; Tailwind CSS resets are scoped properly |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | unit | `build > next dev should fail without Next.js installed` | Running `next dev` fails because Next.js is not installed (before implementation) |
| T2 | unit | `build > importing from app/ should fail` | Attempting to import from `app/` fails because the directory does not exist yet |
| T3 | unit | `build > importing from components/ui should fail` | Attempting to import shadcn components fails because they are not initialized |
| T4 | e2e | `smoke > app should render a page without errors` | Navigating to http://localhost:3000 after `next dev` starts returns a 200 status and valid HTML (this will fail until the landing page is built) |

**Red gate:** Create a simple smoke test file that attempts to import from Next.js and the app directory structure and expects failures. Document the pre-work state (no Next.js, no directories). Commit the failing test.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm dev` starts the development server without errors
- [ ] `pnpm build` compiles successfully, producing `.next/` output
- [ ] `pnpm lint` and `pnpm tsc --noEmit` pass
- [ ] The directory structure matches §8.2 exactly
- [ ] A minimal page (e.g., `/page.tsx`) renders without error
- [ ] Tailwind CSS is active (a test page applies a Tailwind class, e.g., `text-red-500`)

## Implementation notes

- Use `create-next-app@15` or manually install `next@15`, `react`, `react-dom` with TypeScript.
- Install Tailwind CSS via `pnpm install -D tailwindcss postcss autoprefixer` and run `npx tailwindcss init -p`.
- Configure Tailwind to scan `app/**/*.{js,ts,jsx,tsx}` and `components/**/*.{js,ts,jsx,tsx}`.
- Initialize shadcn/ui via `pnpm exec shadcn-ui@latest init` with the default configuration.
- Create the directory tree as specified in §8.2; stub out layout files with minimal content.
- Create a `app/page.tsx` that renders a basic "AITJ Ledger" header using Tailwind styling.
- Do not add authentication, database, or feature-specific components yet.
- Ensure no environment variables are hardcoded; any config that varies by environment (DATABASE_URL, AUTH_SECRET) is read from the environment, not baked into the build.

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] `git status` shows only tracked files (no build artifacts, .next/, or node_modules)
- [ ] No hardcoded secrets or API keys
- [ ] TypeScript strict mode passes
- [ ] ESLint and Prettier check pass
- [ ] The app structure is ready for M1 (Auth) work
