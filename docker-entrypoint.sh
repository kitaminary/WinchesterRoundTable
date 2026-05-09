#!/bin/sh
set -e

PORT=${PORT:-3000}

bore_wanted() {
  _v=$(printf '%s' "${ENABLE_BORE:-1}" | tr '[:upper:]' '[:lower:]')
  case "$_v" in 0|false|no|off) return 1 ;; esac
  return 0
}

echo ""
echo "Winchester Round Table"
echo "  Port:         $PORT"
echo "  Chat version: ${CHAT_HISTORY_VERSION:-1}"
echo ""

# ── Start Node.js server in background ───────────────────────────────────────
node dist/server/index.js &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup INT TERM

# ── Wait until the app responds (max 30 s) ────────────────────────────────────
echo "Waiting for app to be ready…"
TRIES=0
until curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge 30 ]; then
    echo "ERROR: App did not start within 30 s — check server logs."
    kill "$SERVER_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done
echo "App is ready."
echo ""

# ── Optional bore tunnel (blocked networks: set ENABLE_BORE=0 or self-host BORE_SERVER) ──
if bore_wanted; then
  BORE_TO=${BORE_SERVER:-bore.pub}
  echo "Starting bore tunnel…"
  echo "Relay: $BORE_TO — public URL appears below when connected."
  echo ""
  bore local "$PORT" --to "$BORE_TO" || {
    echo "" >&2
    echo "WARN: Bore tunnel to $BORE_TO failed (timeout or blocked). Running local server only on port $PORT." >&2
    echo "      Map port $PORT from the host, use a VPN, set BORE_SERVER to your relay, or ENABLE_BORE=0 to skip this message." >&2
    echo "" >&2
  }
else
  echo "Bore tunnel disabled (ENABLE_BORE)."
  echo ""
fi

wait "$SERVER_PID"
