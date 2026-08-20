#!/usr/bin/env bash
# AITJ-M0-02 — Next.js/Tailwind/shadcn scaffold verification harness.
#
# Encodes T1-T4 from the ticket's test plan. This script is committed
# UNCHANGED across the RED and GREEN phases:
#   - RED  (today): the scaffold does not exist yet -> every check below
#     fails for the right reason (Next.js not installed, app/ and
#     components/ui/ missing, no dev server to talk to), so the script
#     exits non-zero.
#   - GREEN (after implementation): every check succeeds, so the script
#     exits zero.
#
# pnpm is not guaranteed to be on PATH; resolve it the same way the
# husky pre-commit hook does.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if command -v pnpm >/dev/null 2>&1; then
  PNPM="pnpm"
elif command -v corepack >/dev/null 2>&1; then
  PNPM="corepack pnpm"
else
  echo "verify-scaffold: neither pnpm nor corepack found on PATH" >&2
  exit 1
fi

overall=0
TMP_DIR="$(mktemp -d)"
DEV_PID=""
cleanup() {
  if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" >/dev/null 2>&1; then
    kill "$DEV_PID" >/dev/null 2>&1
    wait "$DEV_PID" 2>/dev/null
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

section() { echo; echo "== $1 =="; }
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; overall=1; }

# ---------------------------------------------------------------------------
# T1 — next dev should fail without Next.js installed
# ---------------------------------------------------------------------------
section "T1: next should be installed and runnable"
if [ ! -d node_modules/next ]; then
  fail "T1 (node_modules/next does not exist -- Next.js not installed)"
elif $PNPM exec next --version >"$TMP_DIR/t1.out" 2>&1; then
  pass "T1 (next --version exited 0: $(cat "$TMP_DIR/t1.out"))"
else
  fail "T1 (next --version exited non-zero) -- $(tail -n 3 "$TMP_DIR/t1.out" | tr '\n' ' ')"
fi

# ---------------------------------------------------------------------------
# T2 — importing from app/ should fail until the directory exists
# ---------------------------------------------------------------------------
section "T2: app/ directory and page.tsx should exist"
if [ ! -f app/page.tsx ]; then
  fail "T2 (app/page.tsx does not exist)"
elif [ ! -d "app/(auth)" ] || [ ! -d "app/(app)" ] || [ ! -d app/api ]; then
  fail "T2 (app/(auth), app/(app) or app/api missing)"
else
  pass "T2 (app/page.tsx, app/(auth)/, app/(app)/, app/api/ exist)"
fi

# ---------------------------------------------------------------------------
# T3 — importing shadcn components should fail until initialised
# ---------------------------------------------------------------------------
section "T3: components/ui shadcn primitives should exist"
if [ ! -f components.json ]; then
  fail "T3 (components.json does not exist -- shadcn/ui not initialised)"
elif [ ! -d components/ui ] || [ -z "$(find components/ui -name '*.tsx' 2>/dev/null)" ]; then
  fail "T3 (components/ui has no .tsx primitives)"
else
  pass "T3 (components.json present and components/ui has primitives)"
fi

# ---------------------------------------------------------------------------
# T4 — app should render a page without errors (dev server smoke test)
# ---------------------------------------------------------------------------
section "T4: dev server should render a page and return 200"
if [ ! -d node_modules/next ] || [ ! -f app/page.tsx ]; then
  fail "T4 (skipped underlying checks not satisfied yet -- next/app missing)"
else
  PORT=3911
  $PNPM exec next dev -p "$PORT" >"$TMP_DIR/dev.out" 2>&1 &
  DEV_PID=$!

  ready=0
  for _ in $(seq 1 30); do
    if curl -sf "http://localhost:$PORT" >"$TMP_DIR/t4.html" 2>/dev/null; then
      ready=1
      break
    fi
    sleep 1
  done

  if [ "$ready" -eq 1 ] && grep -qi "<html" "$TMP_DIR/t4.html"; then
    pass "T4 (http://localhost:$PORT returned 200 with HTML)"
  else
    fail "T4 (dev server did not return a valid page) -- $(tail -n 5 "$TMP_DIR/dev.out" | tr '\n' ' ')"
  fi

  if kill -0 "$DEV_PID" >/dev/null 2>&1; then
    kill "$DEV_PID" >/dev/null 2>&1
    wait "$DEV_PID" 2>/dev/null
  fi
  DEV_PID=""
fi

echo
if [ "$overall" -ne 0 ]; then
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS"
exit 0
