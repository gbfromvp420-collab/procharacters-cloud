#!/usr/bin/env bash
# Procharacters.cloud preview server.
#
# Installs dependencies, builds when needed, then serves the Next.js frontend
# in the FOREGROUND on $PORT (default 3000) with the product API on
# $BACKEND_PORT (default 3001). Writes $OPENCODE_WEB_DIR/deployment-output.json
# ({project, directory}) for the controller. dist/ is a static snapshot for the
# deployment archive (video binaries excluded to keep the zip small); the live
# preview is the real Next.js server, not dist/.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
API_URL="http://127.0.0.1:${BACKEND_PORT}"
SITE_URL="http://127.0.0.1:${PORT}"
DIST_DIR="$PROJECT_DIR/dist"
BACKEND_LOG="$PROJECT_DIR/.backend-preview.log"

echo "[start] project=$PROJECT_DIR port=$PORT backend=$BACKEND_PORT"

# --- dependencies ---------------------------------------------------------
if [[ ! -d frontend/node_modules ]]; then
  /usr/bin/time -p bash -c 'cd frontend && npm ci --no-audit --no-fund'
else
  echo "[start] frontend/node_modules present, skipping install"
fi
if [[ ! -d backend/node_modules ]]; then
  /usr/bin/time -p bash -c 'cd backend && npm ci --no-audit --no-fund'
else
  echo "[start] backend/node_modules present, skipping install"
fi

# --- build when needed ------------------------------------------------------
FRONTEND_STAMP="frontend/.next/BUILD_ID"
if [[ ! -f "$FRONTEND_STAMP" ]] || [[ -n "$(find frontend/src frontend/package.json frontend/package-lock.json frontend/next.config.ts -newer "$FRONTEND_STAMP" -print -quit 2>/dev/null)" ]]; then
  /usr/bin/time -p bash -c "cd frontend && NEXT_PUBLIC_API_URL='$API_URL' NEXT_PUBLIC_SITE_URL='$SITE_URL' npm run build"
else
  echo "[start] frontend build fresh, skipping build"
fi
if [[ ! -f backend/dist/index.js ]] || [[ -n "$(find backend/src backend/package.json prisma prisma.config.ts -newer backend/dist/index.js -print -quit 2>/dev/null)" ]]; then
  /usr/bin/time -p bash -c 'cd backend && npm run build'
else
  echo "[start] backend build fresh, skipping build"
fi

# --- product API (background, killed with this script) ----------------------
cleanup_backend() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup_backend EXIT
/usr/bin/time -p bash -c "PORT='$BACKEND_PORT' HOST='0.0.0.0' ACCOUNTS_PROVIDER='json' nohup node backend/dist/index.js >'$BACKEND_LOG' 2>&1 & echo \$! >'$PROJECT_DIR/.backend-preview.pid'"
BACKEND_PID="$(cat "$PROJECT_DIR/.backend-preview.pid")"
echo "[start] backend pid=$BACKEND_PID log=$BACKEND_LOG"
/usr/bin/time -p bash -c "
  for i in \$(seq 1 30); do
    if curl --fail --silent --max-time 2 'http://127.0.0.1:${BACKEND_PORT}/health' >/dev/null; then exit 0; fi;
    sleep 1;
  done;
  echo '[start] backend health check failed' >&2; tail -n 30 '$BACKEND_LOG' >&2; exit 1
"

# --- static deployment snapshot (for deployment-output.json / zip) ---------
/usr/bin/time -p rm -rf "$DIST_DIR"
/usr/bin/time -p mkdir -p "$DIST_DIR/_next" "$OPENCODE_WEB_DIR"
/usr/bin/time -p bash -c "cp frontend/.next/server/app/*.html '$DIST_DIR/'"
/usr/bin/time -p bash -c "cp -r frontend/.next/static '$DIST_DIR/_next/static'"
# Public files minus video binaries (518MB of clips would bloat the deploy zip).
/usr/bin/time -p bash -c "cd frontend/public && tar cf - --exclude='*.mp4' --exclude='*.MP4' . | tar xf - -C '$DIST_DIR/'"
/usr/bin/time -p test -f "$DIST_DIR/index.html"
/usr/bin/time -p bash -c "printf '{\"project\":\"%s\",\"directory\":\"%s\"}\n' '$PROJECT_DIR' '$DIST_DIR' >'$OPENCODE_WEB_DIR/deployment-output.json'"
/usr/bin/time -p cat "$OPENCODE_WEB_DIR/deployment-output.json"

# --- frontend in the foreground ---------------------------------------------
/usr/bin/time -p bash -c "cd frontend && exec npx next start -H 0.0.0.0 -p '$PORT'"
