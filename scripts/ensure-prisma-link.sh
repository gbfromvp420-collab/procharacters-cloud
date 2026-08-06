#!/usr/bin/env bash
# Monorepo helper: Prisma schema lives at repo-root prisma/, packages in backend/.
# Prisma 7 resolves @prisma/client from the schema directory's node_modules.
# Docker already full-symlinks backend/node_modules → /app/node_modules.
# Local + CI need the same resolution without a second npm install at root.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_NM="$ROOT/backend/node_modules"
ROOT_NM="$ROOT/node_modules"

if [[ ! -d "$BACKEND_NM/@prisma" ]]; then
  echo "ensure-prisma-link: backend/node_modules/@prisma missing — run: cd backend && npm ci" >&2
  exit 1
fi

mkdir -p "$ROOT_NM"
ln -sfn "$BACKEND_NM/@prisma" "$ROOT_NM/@prisma"
ln -sfn "$BACKEND_NM/prisma" "$ROOT_NM/prisma"
if [[ -d "$BACKEND_NM/.prisma" ]]; then
  ln -sfn "$BACKEND_NM/.prisma" "$ROOT_NM/.prisma"
fi
if [[ -d "$BACKEND_NM/@prisma/client" ]]; then
  ln -sfn "$BACKEND_NM/@prisma/client" "$ROOT_NM/@prisma/client" 2>/dev/null || true
fi

echo "ensure-prisma-link: root node_modules → backend prisma packages OK"
