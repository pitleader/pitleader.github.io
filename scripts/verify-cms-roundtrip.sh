#!/usr/bin/env bash
# verify-cms-roundtrip.sh — Pre-flight and manual checklist for CMS round-trip verification
# Usage: ./scripts/verify-cms-roundtrip.sh <worker-subdomain>
# Example: ./scripts/verify-cms-roundtrip.sh my-project

set -euo pipefail

SUBDOMAIN="${1:-}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="$REPO_ROOT/static/admin/config.yml"
INDEX_FILE="$REPO_ROOT/static/admin/index.html"
PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

echo "=== CMS Round-Trip Verification ==="
echo ""

# --- Check 1: Subdomain argument ---
if [ -z "$SUBDOMAIN" ]; then
  echo "Usage: $0 <worker-subdomain>"
  echo "  e.g. $0 my-project"
  echo ""
  echo "The subdomain is the Cloudflare Workers subdomain used when deploying"
  echo "the sveltia-cms-auth worker (see workers/sveltia-auth/README.md)."
  exit 1
fi

WORKER_URL="https://sveltia-cms-auth.$SUBDOMAIN.workers.dev"

echo "--- Automated Checks ---"
echo ""

# --- Check 2: config.yml base_url placeholder ---
echo "[1] Checking config.yml base_url..."
if grep -q 'YOUR-SUBDOMAIN' "$CONFIG_FILE"; then
  fail "config.yml still contains YOUR-SUBDOMAIN placeholder"
  echo "       Update static/admin/config.yml base_url to your actual worker URL"
else
  pass "config.yml base_url has been updated (no placeholder found)"
fi

# --- Check 3: static/admin/index.html exists and references sveltia ---
echo "[2] Checking static/admin/index.html..."
if [ ! -f "$INDEX_FILE" ]; then
  fail "static/admin/index.html does not exist"
elif grep -q 'sveltia' "$INDEX_FILE"; then
  pass "index.html exists and references Sveltia CMS"
else
  fail "index.html exists but does not reference Sveltia CMS"
fi

# --- Check 4: Worker health ---
echo "[3] Checking worker health at $WORKER_URL ..."
if RESPONSE=$(curl -sf --max-time 10 "$WORKER_URL/" 2>/dev/null); then
  if echo "$RESPONSE" | grep -qi 'running\|ok\|sveltia'; then
    pass "Worker responded with expected content"
  else
    fail "Worker responded but content unexpected: $(echo "$RESPONSE" | head -c 120)"
  fi
else
  fail "Worker not reachable at $WORKER_URL (deploy it first — see workers/sveltia-auth/README.md)"
fi

echo ""
echo "--- Results: $PASS passed, $FAIL failed ---"
echo ""

# --- Manual Checklist ---
echo "--- Manual CMS Round-Trip Checklist ---"
echo ""
echo "After all automated checks pass, complete these steps manually:"
echo ""
echo "  1. Visit your site's /admin/ page (e.g., https://peoriait.com/admin/)"
echo "  2. Log in via GitHub OAuth — you should be redirected through the Cloudflare Worker"
echo "  3. Edit any field (e.g., Homepage > Hero > Heading) and click Publish"
echo "  4. Confirm a new commit appears in the GitHub repo (pitleader/pitleader.github.io)"
echo "  5. Confirm GitHub Actions workflow triggers and completes successfully"
echo "  6. Confirm the live site reflects your edit (allow 1-2 minutes for deployment)"
echo "  7. Create a new page via CMS (Pages > New Page), publish it"
echo "  8. Confirm the new page appears on the live site with correct styling"
echo ""
echo "If all steps succeed, the CMS round-trip is fully verified."
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "⚠️  $FAIL automated check(s) failed — resolve before proceeding with manual checklist."
  exit 1
else
  echo "✅ All automated checks passed — proceed with the manual checklist above."
  exit 0
fi
