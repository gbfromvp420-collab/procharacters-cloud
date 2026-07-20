#!/usr/bin/env bash
# GG Ventures Stage 2: Prime → 4× loopable engine clips
# Alias-friendly name (Gary: cut-loops.sh). Same as prime-to-pack-loops.sh.
#
# Usage:
#   bash scripts/cut-loops.sh path/to/your_prime.mp4
#   bash scripts/cut-loops.sh path/to/prime.mp4 female-playful-brat
#   OFFSETS='2 8 14 20' DURATIONS='5 6 6 7' bash scripts/cut-loops.sh prime.mp4 twink-gym
#
# Outputs (engine names — not loop_0…):
#   packs/<model-id>/idle.mp4
#   packs/<model-id>/teasing.mp4
#   packs/<model-id>/playful.mp4
#   packs/<model-id>/aroused.mp4
#
# Then: cp packs/<id>/*.mp4 frontend/public/avatar/<id>/
# Tell King Grok: packs ready: <id>

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
exec bash "$ROOT/prime-to-pack-loops.sh" "$@"
