#!/usr/bin/env bash
# GG Ventures Stage 2 — Prime (20–30s) → 4 engine loops (4–8s)
#
# Product expects EXACT names (case-sensitive):
#   idle.mp4  teasing.mp4  playful.mp4  aroused.mp4
#
# Usage:
#   bash scripts/prime-to-pack-loops.sh /path/to/anna_prime_25s.mp4
#   bash scripts/prime-to-pack-loops.sh ./primes/foo_prime_25s.mp4 female-playful-brat
#   OUT_ROOT=./packs bash scripts/prime-to-pack-loops.sh "$PRIME" twink-gym
#
# Then drop the 4 files into:
#   frontend/public/avatar/<model-id>/
# Tell King Grok: packs ready: <model-id>

set -euo pipefail

PRIME="${1:-}"
MODEL_ID="${2:-}"
OUT_ROOT="${OUT_ROOT:-./packs}"

# Default energy windows into a ~25s prime (tweak per character if needed)
# order: idle, teasing, playful, aroused
OFFSETS=(${OFFSETS:-0 6 12 18})
DURATIONS=(${DURATIONS:-6 6 6 6})
FADE="${FADE:-0.25}"  # seconds in/out for soft loop ends
CRF="${CRF:-23}"

SLOTS=(idle teasing playful aroused)

usage() {
  echo "Usage: $0 <prime.mp4> [model-id]" >&2
  echo "  model-id e.g. female-playful-brat | twink-gym | female-soft-goth" >&2
  echo "           twink-shy-boy | female-athletic-tease | twink-alt-punk" >&2
  exit 1
}

[ -n "$PRIME" ] && [ -f "$PRIME" ] || usage

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found" >&2
  exit 1
fi

# Derive folder name from prime if model-id not given
if [ -z "$MODEL_ID" ]; then
  base=$(basename "$PRIME")
  base="${base%.*}"
  # strip common prime suffixes
  MODEL_ID=$(echo "$base" \
    | sed -E 's/_prime_[0-9]+s$//; s/_prime$//; s/-prime$//' \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
  [ -n "$MODEL_ID" ] || MODEL_ID="custom-pack"
fi

OUT_DIR="$OUT_ROOT/$MODEL_ID"
mkdir -p "$OUT_DIR"

echo "Prime:  $PRIME"
echo "Pack:   $OUT_DIR"
echo "Slots:  ${SLOTS[*]}"
echo "Offsets ${OFFSETS[*]}  Durations ${DURATIONS[*]}  Fade ${FADE}s"
echo ""

for i in 0 1 2 3; do
  slot="${SLOTS[$i]}"
  start="${OFFSETS[$i]}"
  len="${DURATIONS[$i]}"
  out="$OUT_DIR/${slot}.mp4"

  # fade-out start = len - FADE (bash float via awk if needed)
  fade_out_st=$(awk -v L="$len" -v F="$FADE" 'BEGIN { s=L-F; if (s<0) s=0; printf "%.2f", s }')

  if [ -f "$out" ]; then
    echo "skip (exists): $out"
    continue
  fi

  # Re-encode for clean cuts + soft fades (copy would keyframe-glitch)
  # Audio silenced — product mutes avatar often
  ffmpeg -hide_banner -loglevel error -y \
    -ss "$start" -i "$PRIME" -t "$len" \
    -vf "fade=t=in:st=0:d=${FADE},fade=t=out:st=${fade_out_st}:d=${FADE},format=yuv420p" \
    -an \
    -c:v libx264 -crf "$CRF" -preset medium \
    -movflags +faststart \
    "$out"

  echo "ok  ${slot}.mp4  (${len}s @ ${start}s)"
done

echo ""
echo "Pack ready: $OUT_DIR"
echo "  idle.mp4  teasing.mp4  playful.mp4  aroused.mp4"
echo ""
echo "Next:"
echo "  1. Scrub each loop — first≈last frame; retweak OFFSETS/DURATIONS if dead."
echo "  2. Copy into repo:"
echo "       cp $OUT_DIR/*.mp4 frontend/public/avatar/${MODEL_ID}/"
echo "     (create folder if new; Phase 4 ids preferred)"
echo "  3. Tell King Grok:  packs ready: ${MODEL_ID}"
echo ""
echo "Optional per-char offsets example:"
echo "  OFFSETS='2 8 14 20' DURATIONS='5 6 6 7' $0 \"$PRIME\" $MODEL_ID"
