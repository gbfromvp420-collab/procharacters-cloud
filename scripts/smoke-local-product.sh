#!/usr/bin/env bash
# Offline product smoke — when Railway is down, prove the Node chat stack locally.
#
# Usage (repo root):
#   bash scripts/smoke-local-product.sh
#   bash scripts/smoke-local-product.sh --skip-install
#   API_BASE=http://127.0.0.1:3001 bash scripts/smoke-local-product.sh --external
#
# Default: starts backend on :3001 (JSON accounts, no xAI required), hits health +
# characters + session create, then tears down. Does not start Next.js (optional).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
API_BASE="${API_BASE:-http://127.0.0.1:3001}"
PORT="${PORT:-3001}"
HOST="${HOST:-127.0.0.1}"
SKIP_INSTALL=0
EXTERNAL=0
KEEP=0

for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=1 ;;
    --external) EXTERNAL=1 ;;
    --keep) KEEP=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
  esac
done

PID=""
cleanup() {
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
}
if [[ "$EXTERNAL" -eq 0 && "$KEEP" -eq 0 ]]; then
  trap cleanup EXIT
fi

echo ""
echo "🔥 Procharacters local product smoke"
echo "   API_BASE=$API_BASE"
echo ""

if [[ "$EXTERNAL" -eq 0 ]]; then
  if [[ "$SKIP_INSTALL" -eq 0 ]]; then
    echo "→ ensure deps + prisma client"
    bash "$ROOT/scripts/ensure-prisma-link.sh"
    (cd "$BACKEND" && npm ci --silent)
    bash "$ROOT/scripts/ensure-prisma-link.sh"
    (cd "$BACKEND" && DATABASE_URL="${DATABASE_URL:-postgresql://u:p@127.0.0.1:5432/ci}" npm run prisma:generate)
  else
    bash "$ROOT/scripts/ensure-prisma-link.sh" || true
  fi

  if [[ ! -d "$BACKEND/dist" ]]; then
    echo "→ build backend"
    (cd "$BACKEND" && DATABASE_URL="${DATABASE_URL:-postgresql://u:p@127.0.0.1:5432/ci}" npm run build)
  fi

  echo "→ start backend on ${HOST}:${PORT}"
  (
    cd "$BACKEND"
    export HOST PORT
    export NODE_ENV="${NODE_ENV:-test}"
    export ACCOUNTS_PROVIDER="${ACCOUNTS_PROVIDER:-json}"
    export DATABASE_URL="${DATABASE_URL:-}"
    # Intentionally blank XAI — stub chat path must still session+WS
    export XAI_API_KEY="${XAI_API_KEY:-}"
    node dist/index.js
  ) >"$ROOT/.local-product-smoke.log" 2>&1 &
  PID=$!

  echo "→ wait for /health"
  ok=0
  for _ in $(seq 1 40); do
    if curl -fsS "$API_BASE/health" >/tmp/pc-health.json 2>/dev/null; then
      ok=1
      break
    fi
    if ! kill -0 "$PID" 2>/dev/null; then
      echo "backend exited early — log:"
      tail -n 80 "$ROOT/.local-product-smoke.log" || true
      exit 1
    fi
    sleep 0.5
  done
  if [[ "$ok" -ne 1 ]]; then
    echo "health timeout — log:"
    tail -n 80 "$ROOT/.local-product-smoke.log" || true
    exit 1
  fi
fi

fail=0
check() {
  local name="$1"
  local detail="$2"
  echo "  ✓ $name — $detail"
}
bad() {
  local name="$1"
  local detail="$2"
  echo "  ✗ $name — $detail"
  fail=1
}

# 1) Health
if curl -fsS "$API_BASE/health" >/tmp/pc-health.json; then
  status=$(python3 -c "import json;print(json.load(open('/tmp/pc-health.json')).get('status',''))" 2>/dev/null || echo "")
  if [[ "$status" == "ok" ]]; then
    check "health" "status=ok"
  else
    bad "health" "unexpected body status=$status"
  fi
else
  bad "health" "request failed"
fi

# 2) Characters catalog (API returns { live: [...], custom, registry, ... })
if curl -fsS "$API_BASE/api/v1/characters" >/tmp/pc-chars.json; then
  count=$(python3 -c "import json;d=json.load(open('/tmp/pc-chars.json'));print(len(d.get('live') or d.get('characters') or (d if isinstance(d,list) else [])))" 2>/dev/null || echo 0)
  if [[ "${count:-0}" -ge 2 ]]; then
    check "characters" "live=$count"
  else
    bad "characters" "expected >=2 live got $count"
  fi
else
  bad "characters" "request failed"
fi

# 3) Session create
char_id=$(python3 -c "import json;d=json.load(open('/tmp/pc-chars.json'));cs=d.get('live') or d.get('characters') or (d if isinstance(d,list) else []);print(cs[0].get('id','twink-default') if cs else 'twink-default')" 2>/dev/null || echo twink-default)
if curl -fsS -X POST "$API_BASE/api/v1/sessions" \
  -H 'Content-Type: application/json' \
  -d "{\"characterId\":\"$char_id\"}" >/tmp/pc-session.json; then
  sid=$(python3 -c "import json;print(json.load(open('/tmp/pc-session.json')).get('sessionId') or json.load(open('/tmp/pc-session.json')).get('id') or '')" 2>/dev/null || echo "")
  if [[ -n "$sid" ]]; then
    check "session_create" "id=${sid:0:12}… character=$char_id"
  else
    bad "session_create" "no sessionId in response"
    cat /tmp/pc-session.json || true
  fi
else
  bad "session_create" "request failed"
fi

# 4) Optional full deploy smoke when backend script exists
if [[ -f "$BACKEND/scripts/smoke-deploy.ts" ]] && command -v npx >/dev/null; then
  echo "→ npm run smoke:deploy (API_BASE=$API_BASE)"
  if (cd "$BACKEND" && API_BASE="$API_BASE" npm run smoke:deploy -- --base "$API_BASE"); then
    check "smoke:deploy" "passed"
  else
    bad "smoke:deploy" "failed (see above)"
  fi
fi

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "Local product smoke FAILED"
  exit 1
fi
echo "Local product smoke OK — offline stack is healthy"
echo "Next: cd frontend && npm run dev   # UI against $API_BASE"
exit 0
