#!/usr/bin/env bash
# CI entry of the Golden Journey L3 (FN-03): ephemeral stack up, Playwright suite `gj-l3`, stack down, summary.
# Runs from the frontend checkout; the backend checkout is E2E_BACKEND_DIR (default ../backend). PostgreSQL is the
# job's service container (PGHOST/PGPORT/PGUSER/PGPASSWORD). Runbook: backend docs/runbooks/golden-journey-l3.md.
#
# Stripe test mode (secrets of the repository, never in the repo): STRIPE_TEST_SECRET_KEY, STRIPE_TEST_PUBLISHABLE_KEY.
# Without them the online-payment variant is SKIPPED, loudly (annotation + job summary), and the "pay at the
# property" variant still runs: the job never passes silently without saying what did not run.
set -uo pipefail

FE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$FE_DIR"
API_PORT="${E2E_API_PORT:-5100}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
STRIPE_LISTEN_PID=""

if [ -n "${STRIPE_TEST_SECRET_KEY:-}" ] && [ -n "${STRIPE_TEST_PUBLISHABLE_KEY:-}" ]; then
  case "$STRIPE_TEST_SECRET_KEY" in
    sk_test_*|rk_test_*) ;;
    *) echo "::error::STRIPE_TEST_SECRET_KEY is not a test-mode key: refusing to run."; exit 1 ;;
  esac
  if ! command -v stripe >/dev/null 2>&1; then
    echo "::error::Stripe CLI not installed: needed to forward the Connect webhooks (see the workflow step)."; exit 1
  fi
  # The CLI signs every forwarded event (platform and Connect endpoints) with one secret per account.
  WHSEC="$(stripe listen --api-key "$STRIPE_TEST_SECRET_KEY" --print-secret)"
  export STRIPE_TEST_WEBHOOK_SECRET="$WHSEC" STRIPE_TEST_CONNECT_WEBHOOK_SECRET="$WHSEC"
  mkdir -p e2e/.stack
  stripe listen --api-key "$STRIPE_TEST_SECRET_KEY" \
    --forward-to "http://localhost:$API_PORT/webhooks/stripe" \
    --forward-connect-to "http://localhost:$API_PORT/webhooks/stripe/connect" > e2e/.stack/stripe-listen.log 2>&1 &
  STRIPE_LISTEN_PID=$!
else
  unset STRIPE_TEST_SECRET_KEY STRIPE_TEST_PUBLISHABLE_KEY
  echo "::warning title=Golden Journey L3: Stripe variant SKIPPED::STRIPE_TEST_SECRET_KEY / STRIPE_TEST_PUBLISHABLE_KEY are not available in this run (fork PR or secrets not set): the online-payment journey did NOT run. Only the pay-at-the-property variant ran."
fi

cleanup() {
  [ -n "$STRIPE_LISTEN_PID" ] && kill "$STRIPE_LISTEN_PID" 2>/dev/null
  bash e2e/stack/down.sh
}
trap cleanup EXIT

bash e2e/stack/up.sh || { echo "::error::The ephemeral stack did not start (see the uploaded stack logs)."; exit 1; }

export PLAYWRIGHT_JSON_OUTPUT_NAME=playwright-report.json
E2E_GJ_L3=1 npx playwright test --project=gj-l3 --reporter=list,json
RESULT=$?
node e2e/stack/summary.mjs "$SUMMARY"
exit $RESULT
