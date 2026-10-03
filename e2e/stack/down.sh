#!/usr/bin/env bash
# Stops the ephemeral stack and drops its database.
FE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STACK_DIR="$FE_DIR/e2e/.stack"
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
for name in vite backend mock; do
  pidfile="$STACK_DIR/$name.pid"
  [ -f "$pidfile" ] || continue
  pid="$(cat "$pidfile")"
  # kill the whole process group child tree (npx / dotnet run spawn children)
  pkill -P "$pid" 2>/dev/null || true
  kill "$pid" 2>/dev/null || true
done
sleep 1
[ -f "$STACK_DIR/db-name" ] && psql -d postgres -c "DROP DATABASE IF EXISTS \"$(cat "$STACK_DIR/db-name")\" WITH (FORCE)" || true
echo "stack stopped"
