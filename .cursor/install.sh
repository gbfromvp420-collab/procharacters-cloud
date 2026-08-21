#!/usr/bin/env bash
# Cloud Agent install — idempotent dependency refresh for the procharacters.cloud monorepo.
# Prepares: Node product API (backend/), Next.js web (frontend/), and the optional
# Python WebRTC + trainer studio side service (app/).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== [1/4] backend deps + prisma client =="
(
  cd backend
  npm ci
  # prisma generate only needs DATABASE_URL to be present, not reachable.
  DATABASE_URL="${DATABASE_URL:-postgresql://u:p@127.0.0.1:5432/ci}" npm run prisma:generate
)

echo "== [2/4] frontend deps =="
(
  cd frontend
  npm ci
)

echo "== [3/4] python venv for optional WebRTC/trainer service =="
# python3-venv (ensurepip) is not in the base image; install best-effort.
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  PYVER="$(python3 -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
  sudo apt-get update -qq && sudo apt-get install -y -qq "python${PYVER}-venv" || \
    echo "WARN: could not install python venv package; optional WebRTC service may be unavailable"
fi
if python3 -c "import ensurepip" >/dev/null 2>&1; then
  [ -d .venv ] || python3 -m venv .venv
  ./.venv/bin/python -m pip install --upgrade pip -q
  ./.venv/bin/pip install -r requirements.txt
else
  echo "SKIP: python venv unavailable — optional WebRTC service not installed"
fi

echo "== [4/4] data dirs =="
mkdir -p data/sessions data/uploads

echo "install complete"
