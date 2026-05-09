#!/bin/sh
set -e

echo ""
echo "Winchester Round Table — dev container"
echo ""

# Re-install / rebuild if node_modules is missing or stale.
# The node_modules volume is separate from the bind-mount so native
# modules (better-sqlite3) are always compiled for Linux/Alpine,
# not copied from the Windows host.
STAMP=/app/node_modules/.install-stamp

if [ ! -f "$STAMP" ] || [ /app/package-lock.json -nt "$STAMP" ]; then
  echo "→ Installing dependencies (first run or package-lock.json changed)…"
  npm ci --include=dev
  touch "$STAMP"
  echo "→ Done."
else
  # Rebuild native modules in case the volume was built on a different
  # node version or architecture.
  echo "→ Rebuilding native modules…"
  npm rebuild
  echo "→ Done."
fi

echo ""
echo "Starting dev servers…"
echo "  API  → http://localhost:3000"
echo "  UI   → http://localhost:5173"
echo ""

exec npm run dev:docker
