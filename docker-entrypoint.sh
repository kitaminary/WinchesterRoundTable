#!/bin/sh
set -e

PORT=${PORT:-3000}

bore_wanted() {
  _v=$(printf '%s' "${ENABLE_BORE:-0}" | tr '[:upper:]' '[:lower:]')
  case "$_v" in 0|false|no|off) return 1 ;; esac
  return 0
}

echo ""
echo "Winchester Round Table"
echo "  Port:         $PORT"
echo "  Chat version: ${CHAT_HISTORY_VERSION:-1}"
echo ""

# Start Node.js server in background
node dist/server/index.js &
SERVER_PID=$!

BORE_PID=""

cleanup() {
  [ -n "$BORE_PID" ] && kill "$BORE_PID" 2>/dev/null || true
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup INT TERM

# Wait until the app responds (max 30 s)
echo "Waiting for app to be ready..."
TRIES=0
until curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge 30 ]; then
    echo "ERROR: App did not start within 30 s -- check server logs."
    kill "$SERVER_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done
echo "App is ready."
echo ""

# Optional bore tunnel. Set ENABLE_BORE=1 to activate (default: 0 = off).
# When disabled, expose with ngrok externally: ngrok http $PORT
if bore_wanted; then
  BORE_TO=${BORE_SERVER:-bore.pub}
  echo "Starting bore tunnel..."
  echo "  Relay: $BORE_TO -> local :$PORT"
  echo "  Public forwarding address: check bore lines in this container's logs (relay host plus remote port)."
  bore local "$PORT" --to "$BORE_TO" &
  BORE_PID=$!
  echo "  bore PID: $BORE_PID  (set ENABLE_BORE=0 to disable)"
  echo ""
else
  echo "Bore tunnel disabled (ENABLE_BORE=0)."
  echo "  Run ngrok externally: ngrok http $PORT"
  echo ""
fi

wait "$SERVER_PID"
