#!/usr/bin/env bash
# GG Ventures Stage 2 v2 — Prime → engine loops
#   idle.mp4  teasing.mp4  playful.mp4  aroused.mp4
#
# Usage:
#   bash scripts/cut-loops.sh path/to/foo_prime_25s.mp4
#   bash scripts/cut-loops.sh path/to/foo_prime_25s.mp4 female-playful-brat
#   OFFSETS='2 8 14 20' DURATIONS='5 6 6 7' bash scripts/cut-loops.sh prime.mp4 twink-gym
#
# Output:
#   packs/<model-id>/{idle,teasing,playful,aroused}.mp4
#
# Then:
#   cp packs/<id>/*.mp4 frontend/public/avatar/<id>/
#   packs ready: <id>

set -euo pipefail

PRIME="${1:-}"
MODEL_ID="${2:-}"
OUT_ROOT="${OUT_ROOT:-./packs}"

# Default windows into a ~25s prime (override via env)
# order: idle, teasing, playful, aroused
OFFSETS=(${OFFSETS:-0 6 12 18})
DURATIONS=(${DURATIONS:-6 5 7 5})
VIBES=(idle teasing playful aroused)

FADE="${FADE:-0.4}"
CRF="${CRF:-22}"
# 9:16 target when SCALE_9_16=1 (default off — keep source aspect, even dims only)
SCALE_9_16="${SCALE_9_16:-0}"
TARGET_W="${TARGET_W:-1080}"
TARGET_H="${TARGET_H:-1920}"

usage() {
  echo "Usage: $0 <prime.mp4> [model-id]" >&2
  echo "  Phase 4 ids: female-playful-brat twink-gym female-soft-goth" >&2
  echo "               twink-shy-boy female-athletic-tease twink-alt-punk" >&2
  exit 1
}

[ -n "$PRIME" ] && [ -f "$PRIME" ] || usage

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found" >&2
  exit 1
fi

if [ -z "$MODEL_ID" ]; then
  base=$(basename "$PRIME")
  base="${base%.*}"
  MODEL_ID=$(echo "$base" \
    | sed -E 's/_prime_[0-9]+s$//; s/_prime$//; s/-prime$//' \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
  [ -n "$MODEL_ID" ] || MODEL_ID="custom-pack"
fi

OUT_DIR="$OUT_ROOT/$MODEL_ID"
mkdir -p "$OUT_DIR"

# Even dimensions (yuv420p-safe). Optional 9:16 letterbox/crop path.
if [ "$SCALE_9_16" = "1" ]; then
  # Fit inside 9:16 then pad to exact TARGET
  VF_SCALE="scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=decrease,pad=${TARGET_W}:${TARGET_H}:(ow-iw)/2:(oh-ih)/2"
else
  # Keep aspect; force even width/height
  VF_SCALE="scale=trunc(iw/2)*2:trunc(ih/2)*2"
fi

echo "Prime:     $PRIME"
echo "Model id:  $MODEL_ID"
echo "Out:       $OUT_DIR"
echo "Offsets:   ${OFFSETS[*]}"
echo "Durations: ${DURATIONS[*]}"
echo "Fade:      ${FADE}s  CRF: $CRF  9:16 force: $SCALE_9_16"
echo ""

for i in 0 1 2 3; do
  start="${OFFSETS[$i]}"
  len="${DURATIONS[$i]}"
  vibe="${VIBES[$i]}"
  out="$OUT_DIR/${vibe}.mp4"

  fade_out_st=$(awk -v L="$len" -v F="$FADE" 'BEGIN {
    s = L - F
    if (s < 0) s = 0
    printf "%.2f", s
  }')

  if [ -f "$out" ]; then
    echo "skip (exists): $out"
    continue
  fi

  ffmpeg -hide_banner -loglevel error -y \
    -ss "$start" -i "$PRIME" -t "$len" \
    -vf "fade=t=in:st=0:d=${FADE},fade=t=out:st=${fade_out_st}:d=${FADE},${VF_SCALE},format=yuv420p" \
    -an \
    -c:v libx264 -crf "$CRF" -preset medium \
    -movflags +faststart \
    "$out"

  echo "ok  ${vibe}.mp4  (${len}s from ${start}s)"
done

echo ""
echo "Pack complete: $OUT_DIR"
ls -la "$OUT_DIR"/*.mp4 2>/dev/null || true
echo ""
echo "Next:"
echo "  cp $OUT_DIR/*.mp4 frontend/public/avatar/${MODEL_ID}/"
echo "  packs ready: ${MODEL_ID}"
echo ""
echo "Retweak example:"
echo "  OFFSETS='2 8 14 20' DURATIONS='6 5 7 5' FADE=0.4 \\"
echo "    bash scripts/cut-loops.sh \"$PRIME\" $MODEL_ID"
echo "Force 9:16 1080x1920:"
echo "  SCALE_9_16=1 bash scripts/cut-loops.sh \"$PRIME\" $MODEL_ID"
