#!/usr/bin/env bash
# Back-compat alias → cut-loops.sh (Stage 2 v2)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec bash "$ROOT/cut-loops.sh" "$@"
