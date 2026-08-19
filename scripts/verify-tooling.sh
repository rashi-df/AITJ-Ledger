#!/usr/bin/env bash
# AITJ-M0-01 — tooling verification harness.
#
# Encodes T1-T4 from the ticket's test plan. This script is committed
# UNCHANGED across the RED and GREEN phases:
#   - RED  (today): tooling does not exist yet -> every check below fails
#     for the right reason (missing tsconfig / eslint config / prettier
#     config / husky hook), so the script exits non-zero.
#   - GREEN (after implementation): every check succeeds, so the script
#     exits zero.
#
# Must be run inside a container with pnpm available (see CLAUDE.md —
# never run pnpm/node/tsc on the host).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

overall=0
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

section() { echo; echo "== $1 =="; }
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; overall=1; }

# ---------------------------------------------------------------------------
# T1 — tsc --noEmit
# ---------------------------------------------------------------------------
section "T1: tsc --noEmit"
if [ ! -f tsconfig.json ]; then
  fail "T1 (tsconfig.json does not exist)"
elif ! command -v pnpm >/dev/null 2>&1; then
  fail "T1 (pnpm not available)"
elif pnpm exec tsc --noEmit >"$TMP_DIR/t1.out" 2>&1; then
  pass "T1 (pnpm exec tsc --noEmit exited 0)"
else
  fail "T1 (pnpm exec tsc --noEmit exited non-zero) -- $(tail -n 3 "$TMP_DIR/t1.out" | tr '\n' ' ')"
fi

# ---------------------------------------------------------------------------
# T2 — pnpm lint
# ---------------------------------------------------------------------------
section "T2: pnpm lint"
if [ ! -f .eslintrc.json ] && [ ! -f .eslintrc.js ] && [ ! -f .eslintrc.cjs ] \
  && [ ! -f eslint.config.js ] && [ ! -f eslint.config.mjs ] && [ ! -f eslint.config.cjs ]; then
  fail "T2 (no ESLint config exists)"
elif ! command -v pnpm >/dev/null 2>&1; then
  fail "T2 (pnpm not available)"
elif pnpm run lint >"$TMP_DIR/t2.out" 2>&1; then
  pass "T2 (pnpm lint exited 0)"
else
  fail "T2 (pnpm lint exited non-zero) -- $(tail -n 3 "$TMP_DIR/t2.out" | tr '\n' ' ')"
fi

# ---------------------------------------------------------------------------
# T3 — prettier / pnpm format
# ---------------------------------------------------------------------------
section "T3: prettier should be configurable and should catch bad formatting"
cat >"$TMP_DIR/unformatted.js" <<'EOF'
const   x = {a:1,b:2}
EOF
if [ ! -f .prettierrc.json ] && [ ! -f .prettierrc ] && [ ! -f .prettierrc.js ] && [ ! -f .prettierrc.cjs ]; then
  fail "T3 (no .prettierrc exists)"
elif ! command -v pnpm >/dev/null 2>&1; then
  fail "T3 (pnpm not available)"
elif pnpm exec prettier --check "$TMP_DIR/unformatted.js" >"$TMP_DIR/t3.out" 2>&1; then
  fail "T3 (prettier --check unexpectedly passed on deliberately bad file)"
elif ! pnpm run format >"$TMP_DIR/t3b.out" 2>&1; then
  fail "T3 (pnpm format failed on the repository) -- $(tail -n 3 "$TMP_DIR/t3b.out" | tr '\n' ' ')"
else
  pass "T3 (prettier configured: catches bad formatting, pnpm format succeeds)"
fi

# ---------------------------------------------------------------------------
# T4 — husky pre-commit hook
# ---------------------------------------------------------------------------
section "T4: husky pre-commit hook"
if [ ! -f .husky/pre-commit ]; then
  fail "T4 (.husky/pre-commit does not exist)"
elif [ ! -x .husky/pre-commit ]; then
  fail "T4 (.husky/pre-commit exists but is not executable)"
else
  pass "T4 (.husky/pre-commit exists and is executable)"
fi

echo
if [ "$overall" -ne 0 ]; then
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS"
exit 0
