#!/usr/bin/env bash
# GG Ventures — batch Stage 2: all primes → packs/<id>/engine loops
#
# Usage:
#   bash scripts/cut-loops-batch.sh ./new_chars_batch
#   bash scripts/cut-loops-batch.sh ./new_chars_batch ./id-map.txt
#
# id-map.txt optional lines:
#   foo_prime_25s.mp4  female-playful-brat
#   gym_heat_prime_25s.mp4  twink-gym
#
# Without a map, model-id is derived from the prime filename
# (strip _prime_25s etc.) — prefer mapping for Phase 4 ids.

set -euo pipefail

PRIME_DIR="${1:-./new_chars_batch}"
ID_MAP="${2:-}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
CUT="$ROOT/cut-loops.sh"

if [ ! -d "$PRIME_DIR" ]; then
  echo "Prime dir not found: $PRIME_DIR" >&2
  exit 1
fi

lookup_id() {
  local file base
  file=$(basename "$1")
  base="${file%.*}"
  if [ -n "$ID_MAP" ] && [ -f "$ID_MAP" ]; then
    # match full filename or stem
    local hit
    hit=$(awk -v f="$file" -v b="$base" '
      $1 == f || $1 == b || index(f, $1) == 1 { print $2; exit }
    ' "$ID_MAP" || true)
    if [ -n "${hit:-}" ]; then
      echo "$hit"
      return
    fi
  fi
  echo ""
}

shopt -s nullglob
primes=("$PRIME_DIR"/*_prime_*.mp4 "$PRIME_DIR"/*_prime_*.MP4 "$PRIME_DIR"/*prime*.mp4)
# de-dupe empty
real=()
for p in "${primes[@]}"; do
  [ -f "$p" ] && real+=("$p")
done

if [ ${#real[@]} -eq 0 ]; then
  echo "No prime mp4s in $PRIME_DIR (expect *prime*.mp4)"
  exit 0
fi

echo "Batch Stage 2 — ${#real[@]} prime(s) from $PRIME_DIR"
echo ""

n=0
for p in "${real[@]}"; do
  mid=$(lookup_id "$p")
  if [ -n "$mid" ]; then
    echo "── $(basename "$p") → $mid"
    bash "$CUT" "$p" "$mid" || echo "FAIL: $p" >&2
  else
    echo "── $(basename "$p") → (derive from name)"
    bash "$CUT" "$p" || echo "FAIL: $p" >&2
  fi
  n=$((n + 1))
  echo ""
done

echo "Batch done: $n prime(s)."
echo "Review packs/*/ then:"
echo "  cp packs/<id>/*.mp4 frontend/public/avatar/<id>/"
echo "  packs ready: <id> [ <id2> … ]"
