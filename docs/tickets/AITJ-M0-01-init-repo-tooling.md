# AITJ-M0-01 — Initialise repository, TypeScript, ESLint, Prettier and Husky

| Field | Value |
|---|---|
| Milestone | M0 — Foundation |
| Depends on | none |
| Blocks | AITJ-M0-02, AITJ-M0-03, AITJ-M0-05, AITJ-M0-06, AITJ-M0-07 |
| PRD refs | §8.1, NFR-5 |
| Est. | 0.5 days |
| Phase | 🟢 GREEN |

## Context

This ticket establishes the repository and development tooling foundation. A working Node.js project with TypeScript strict mode, ESLint, Prettier, and Husky pre-commit hooks ensures all downstream work adheres to quality standards and prevents secrets from being committed (NFR-5).

## Acceptance criteria

- [x] AC1 — Repository initialised with pnpm workspace / monorepo structure (if applicable) or a clean Next.js root
- [x] AC2 — TypeScript configured with `strict: true` in tsconfig.json
- [x] AC3 — ESLint configured and runnable via `pnpm lint`
- [x] AC4 — Prettier configured and runnable via `pnpm format`
- [x] AC5 — Husky installed with pre-commit hook that runs `pnpm lint` and `pnpm tsc --noEmit`
- [x] AC6 — `.gitignore` excludes node_modules, .next, .env*, and .DS_Store
- [x] AC7 — package.json contains start-up scripts: `dev`, `build`, `start`, `lint`, `format`, `test`
- [x] AC8 — No secrets committed (checked via hook or manual review)

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Developer tries to commit without running hooks | Pre-commit hook fails; commit is blocked until lint passes |
| E2 | `.env.local` or `.env.*.local` files exist | They are not tracked by git; .gitignore prevents accidental commits |
| E3 | TypeScript has syntax errors | `tsc --noEmit` exits non-zero; pre-commit hook blocks the commit |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | unit | `build > tsc --noEmit should fail with no tsconfig.json` | Running `tsc --noEmit` exits with non-zero status because tsconfig.json does not exist |
| T2 | unit | `build > eslint should fail with no .eslintrc` | Running `pnpm lint` exits non-zero because no ESLint config exists |
| T3 | unit | `build > prettier should be configurable` | Running `pnpm format --check` on a deliberately un-formatted file fails if no .prettierrc exists |
| T4 | unit | `git hooks > husky should not be installed yet` | Running `.husky/pre-commit` fails (file does not exist or hook not registered) |

**Red gate:** All four commands above fail before any scaffolding. Write a shell script or document these as manual verification steps, then commit it. Do not implement the tooling yet.

### 🟢 GREEN — implementation is done when

- [x] Every RED test passes, unchanged
- [x] `pnpm tsc --noEmit` exits 0 with no errors
- [x] `pnpm lint` exits 0 on the current codebase (allowing for auto-fixes)
- [x] `pnpm format` successfully formats the codebase
- [x] `git commit` runs the pre-commit hook and blocks on lint errors
- [x] No `.env*` files are tracked; `.gitignore` prevents them

## Implementation notes

- Initialize a new Node.js project at the root with `pnpm init` or `npm init`, depending on the chosen package manager.
- Create `tsconfig.json` with `"strict": true`, matching §8.1 and common Next.js defaults.
- Create `.eslintrc.json` with recommended rules (flat config or legacy, whichever is current); disable rules that conflict with Prettier.
- Create `.prettierrc.json` with sensible defaults (e.g., 2-space indent, 100-char line length, single quotes).
- Install Husky via `pnpm install husky --save-dev` and `husky install`; add `.husky/pre-commit` hook running `pnpm lint && pnpm tsc --noEmit`.
- Create `.gitignore` with standard Node.js entries, plus `.env*` (except `.env.example`), `.next/`, and `dist/`.
- Add scripts to `package.json`: `dev`, `build`, `start`, `lint`, `format`, `test`.
- Do not commit node_modules or lock file changes in this ticket (will be managed by M0-02).

## Definition of done

- [x] All ACs met and all RED tests green
- [x] No unused variables or dead code
- [x] No secrets, credentials, or API keys present
- [x] Repository is clean: `git status` shows only tracked files and the configuration files added
