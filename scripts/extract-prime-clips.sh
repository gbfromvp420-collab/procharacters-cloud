#!/usr/bin/env bash
# GG Ventures — Prime clip extractor (stage 1 of pack pipeline)
#
# Takes long source .mp4/.mov files → one ~20–30s “prime” cut each.
# Next step (human / CapCut): cut each prime into 4 engine loops:
#   idle.mp4 · teasing.mp4 · playful.mp4 · aroused.mp4  (4–8s each)
# Drop into: frontend/public/avatar/<model-id>/
# Then: packs ready: <id>
#
# Usage:
#   cd /path/to/your/source/videos
#   bash /path/to/procharacters-cloud/scripts/extract-prime-clips.sh
#   # or:
#   IN_DIR=~/Footage OUT_DIR=~/Footage/primes DURATION=25 MAX_CHARS=10 \
#     bash extract-prime-clips.sh

set -euo pipefail

IN_DIR="${IN_DIR:-.}"
OUT_DIR="${OUT_DIR:-./new_chars_batch}"
DURATION="${DURATION:-25}"
MAX_CHARS="${MAX_CHARS:-10}"
# Prefer a “prime” moment after cold open; fallback to 0 if short
PRIME_SS="${PRIME_SS:-10}"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found — install ffmpeg first." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
count=0
shopt -s nullglob
vids=("$IN_DIR"/*.mp4 "$IN_DIR"/*.mov "$IN_DIR"/*.MP4 "$IN_DIR"/*.MOV)

if [ ${#vids[@]} -eq 0 ]; then
  echo "No .mp4/.mov in: $IN_DIR"
  exit 0
fi

for vid in "${vids[@]}"; do
  [ -f "$vid" ] || continue
  base=$(basename "$vid")
  base="${base%.*}"
  # Safe folder-ish name
  safe=$(echo "$base" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
  [ -n "$safe" ] || safe="clip"
  out="$OUT_DIR/${safe}_prime_${DURATION}s.mp4"

  if [ -f "$out" ]; then
    echo "skip (exists): $out"
  else
    # -c copy is fast but cuts on keyframes; re-encode if you need frame-exact
    if ! ffmpeg -hide_banner -loglevel error -n -ss "$PRIME_SS" -i "$vid" -t "$DURATION" -c copy "$out" 2>/dev/null; then
      ffmpeg -hide_banner -loglevel error -y -ss 0 -i "$vid" -t "$DURATION" -c copy "$out"
    fi
    echo "created: $out"
  fi

  count=$((count + 1))
  if [ "$count" -ge "$MAX_CHARS" ]; then
    break
  fi
done

echo ""
echo "Batch complete: $count prime clip(s) → $OUT_DIR"
echo ""
echo "Next (engine-ready packs — not primes):"
echo "  1. Per character, cut 4 loops (4–8s, loopable, H.264, 9:16 preferred):"
echo "       idle.mp4  teasing.mp4  playful.mp4  aroused.mp4"
echo "  2. Drop into Phase 4 folders (vibe match, not real names):"
echo "       female-playful-brat | twink-gym | female-soft-goth"
echo "       twink-shy-boy | female-athletic-tease | twink-alt-punk"
echo "     path: frontend/public/avatar/<model-id>/"
echo "  3. Tell King Grok:  packs ready: <id>"
echo "  4. Or: docs/PACK-CHEAT-SHEET.md"
echo ""
echo "Theme + integrate when ready — 50/50."
