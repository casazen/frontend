#!/usr/bin/env bash
# Starts the ephemeral stack of the Golden Journey L3 (FN-03): throw-away PostgreSQL database, real backend,
# mock IdP + mock mail (mock-services.mjs) and the Vite frontend. Stops with down.sh. Runbook: backend
# docs/runbooks/golden-journey-l3.md.
#
# Required: a reachable PostgreSQL (PGHOST/PGPORT/PGUSER/PGPASSWORD), dotnet, node, openssl.
# Optional: E2E_BACKEND_DIR (default ../backend), E2E_API_PORT (5100), E2E_FE_PORT (5173), E2E_DB_NAME,
#           STRIPE_TEST_SECRET_KEY / STRIPE_TEST_PUBLISHABLE_KEY / STRIPE_TEST_WEBHOOK_SECRET /
#           STRIPE_TEST_CONNECT_WEBHOOK_SECRET (Stripe test mode, from CI secrets, never from the repo).
set -euo pipefail

FE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STACK_DIR="$FE_DIR/e2e/.stack"
BACKEND_DIR="${E2E_BACKEND_DIR:-$FE_DIR/../backend}"
API_PORT="${E2E_API_PORT:-5100}"
FE_PORT="${E2E_FE_PORT:-5173}"
IDP_PORT="${E2E_IDP_PORT:-9443}"
MAIL_PORT="${E2E_MAIL_PORT:-9444}"
RUN_ID="${E2E_RUN_ID:-$(date -u +%Y%m%d%H%M%S)}"
DB_NAME="${E2E_DB_NAME:-gj_l3_${RUN_ID}}"
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"

mkdir -p "$STACK_DIR"
rm -f "$STACK_DIR"/*.pid
echo "$DB_NAME" > "$STACK_DIR/db-name"
echo "$RUN_ID" > "$STACK_DIR/run-id"

wait_for() { # url, label, seconds, extra curl args
  local url="$1" label="$2" secs="$3"; shift 3
  for _ in $(seq 1 "$secs"); do
    if curl -fsS -o /dev/null "$@" "$url" 2>/dev/null; then echo "up: $label"; return 0; fi
    sleep 1
  done
  echo "TIMEOUT waiting for $label ($url)"; tail -n 40 "$STACK_DIR"/*.log || true; return 1
}

# 1. Throw-away database (the backend applies every EF migration at startup).
psql -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)" -c "CREATE DATABASE \"$DB_NAME\""
CONN="Host=$PGHOST;Port=$PGPORT;Database=$DB_NAME;Username=$PGUSER;Password=${PGPASSWORD:-}"

# 2. Throw-away TLS certificate of the mock IdP. The backend trusts it through SSL_CERT_FILE (system roots + this one),
#    so it validates the mock tokens with the unchanged production JwtBearer configuration.
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
  -keyout "$STACK_DIR/idp.key" -out "$STACK_DIR/idp.crt" 2>/dev/null
SYSTEM_ROOTS="/etc/ssl/certs/ca-certificates.crt"
[ -f "$SYSTEM_ROOTS" ] || SYSTEM_ROOTS="${SSL_CERT_FILE:-/dev/null}"
cat "$SYSTEM_ROOTS" "$STACK_DIR/idp.crt" > "$STACK_DIR/trust-bundle.pem"

# 3. Mock IdP + mock mail.
E2E_STACK=1 E2E_IDP_PORT="$IDP_PORT" E2E_MAIL_PORT="$MAIL_PORT" \
E2E_TLS_KEY="$STACK_DIR/idp.key" E2E_TLS_CERT="$STACK_DIR/idp.crt" \
  nohup node "$FE_DIR/e2e/stack/mock-services.mjs" > "$STACK_DIR/mock.log" 2>&1 &
echo $! > "$STACK_DIR/mock.pid"
wait_for "http://localhost:$MAIL_PORT/__health" "mock mail" 20

# 4. Backend (real, Development environment: migrations at startup, no external provider required).
STRIPE_ARGS=()
if [ -n "${STRIPE_TEST_SECRET_KEY:-}" ]; then
  STRIPE_ARGS=(
    "Stripe__SecretKey=$STRIPE_TEST_SECRET_KEY"
    "Stripe__PublishableKey=${STRIPE_TEST_PUBLISHABLE_KEY:-}"
    "Stripe__WebhookSecret=${STRIPE_TEST_WEBHOOK_SECRET:-}"
    "Stripe__ConnectWebhookSecret=${STRIPE_TEST_CONNECT_WEBHOOK_SECRET:-}"
  )
fi
# CI builds the backend first (E2E_BACKEND_NO_BUILD=1); locally `dotnet run` builds when needed.
NO_BUILD=""; [ "${E2E_BACKEND_NO_BUILD:-0}" = "1" ] && NO_BUILD="--no-build"
BACKEND_CMD="${E2E_BACKEND_CMD:-dotnet run --project $BACKEND_DIR/Casazen.Web -c Release --no-launch-profile $NO_BUILD}"
env ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS="http://localhost:$API_PORT" \
  "ConnectionStrings__DefaultConnection=$CONN" \
  "Auth0__Domain=localhost:$IDP_PORT" "Auth0__Audience=https://casazen-api" \
  "Auth0__ManagementClientId=e2e-m2m" "Auth0__ManagementClientSecret=e2e-m2m-secret" \
  "App__PublicSiteBaseUrl=http://localhost:$FE_PORT" "App__ApiBaseUrl=http://localhost:$API_PORT" "Cors__AllowedOrigins=http://localhost:$FE_PORT" \
  "Email__Provider=Resend" "Email__ApiKey=re_e2e_mock" "Email__FromAddress=noreply@casazen-e2e.test" \
  "Email__ApiUrl=http://localhost:$MAIL_PORT" \
  "SSL_CERT_FILE=$STACK_DIR/trust-bundle.pem" \
  "RateLimiting__PublicBookingCreate__PermitLimit=1000" "RateLimiting__PublicBookingLookup__PermitLimit=1000" \
  ${STRIPE_ARGS[@]+"${STRIPE_ARGS[@]}"} \
  nohup $BACKEND_CMD > "$STACK_DIR/backend.log" 2>&1 &
echo $! > "$STACK_DIR/backend.pid"
wait_for "http://localhost:$API_PORT/api/health/live" "backend" 240

# 5. Frontend (Vite dev server, real Auth0 SDK pointed at the mock IdP: no demo mode).
( cd "$FE_DIR" && env VITE_HTTPS=0 VITE_API_BASE_URL="http://localhost:$API_PORT/api" \
    VITE_AUTH0_DOMAIN="localhost:$IDP_PORT" VITE_AUTH0_CLIENT_ID=e2e-spa-client VITE_AUTH0_AUDIENCE=https://casazen-api \
    nohup npx vite --host localhost --port "$FE_PORT" --strictPort > "$STACK_DIR/vite.log" 2>&1 &
  echo $! > "$STACK_DIR/vite.pid" )
wait_for "http://localhost:$FE_PORT/" "frontend" 120

cat > "$STACK_DIR/env.json" <<JSON
{"apiUrl":"http://localhost:$API_PORT/api","feUrl":"http://localhost:$FE_PORT","mailUrl":"http://localhost:$MAIL_PORT",
 "dbName":"$DB_NAME","runId":"$RUN_ID",
 "password":"${E2E_USER_PASSWORD:-E2e-test-password-1}","stripe":$([ -n "${STRIPE_TEST_SECRET_KEY:-}" ] && echo true || echo false)}
JSON
echo "stack ready: $STACK_DIR/env.json"
