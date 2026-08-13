#!/usr/bin/env bash
# Unpack packs/inbox → (optional) cut loops → copy into live avatar folders.
# Usage:
#   bash scripts/unpack-packs.sh
#   bash scripts/unpack-packs.sh https://share-link
#   bash scripts/unpack-packs.sh https://share-link maria_prime_25s.mp4
#   INBOX=./packs/inbox bash scripts/unpack-packs.sh
#
# Does not invent MP4s. Empty inbox = print the 6 prime names and exit 0.
# A URL arg fetches into inbox first (default name: maria_prime_25s.mp4).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INBOX="${INBOX:-$ROOT/packs/inbox}"
MAP="${MAP:-$ROOT/scripts/id-map.pack01.txt}"
CUT_BATCH="$ROOT/scripts/cut-loops-batch.sh"
LIVE_ROOT="$ROOT/frontend/public/avatar"
VIBES=(idle teasing playful aroused)

mkdir -p "$INBOX"

if [ "${1:-}" != "" ]; then
  case "$1" in
    http://*|https://*)
      bash "$ROOT/scripts/fetch-prime.sh" "$1" "${2:-maria_prime_25s.mp4}"
      ;;
    *)
      echo "Unknown arg: $1 (pass an http(s) URL or nothing)" >&2
      exit 2
      ;;
  esac
fi

echo "Pack unpack — inbox: $INBOX"
echo ""

unzipped=0
shopt -s nullglob
for z in "$INBOX"/*.zip "$INBOX"/*.ZIP; do
  [ -f "$z" ] || continue
  echo "unzip $(basename "$z")"
  unzip -o -q "$z" -d "$INBOX"
  unzipped=$((unzipped + 1))
done

lookup_id() {
  local file base hit
  file=$(basename "$1")
  base="${file%.*}"
  if [ -f "$MAP" ]; then
    hit=$(awk -v f="$file" -v b="$base" '
      /^[[:space:]]*#/ { next }
      NF < 2 { next }
      $1 == f || $1 == b { print $2; exit }
    ' "$MAP" || true)
    if [ -n "${hit:-}" ]; then
      echo "$hit"
      return
    fi
  fi
  echo ""
}

copy_loops() {
  local src="$1" dest_id="$2"
  local dest="$LIVE_ROOT/$dest_id"
  mkdir -p "$dest"
  local v missing=0
  for v in "${VIBES[@]}"; do
    if [ -f "$src/$v.mp4" ]; then
      cp -f "$src/$v.mp4" "$dest/$v.mp4"
      echo "  + $dest_id/$v.mp4"
    else
      echo "  ! missing $src/$v.mp4"
      missing=$((missing + 1))
    fi
  done
  return "$missing"
}

found_primes=()
for p in "$INBOX"/*_prime_*.mp4 "$INBOX"/*_prime_*.MP4 "$INBOX"/*prime*.mp4; do
  [ -f "$p" ] || continue
  found_primes+=("$p")
done

placed=0
if [ ${#found_primes[@]} -gt 0 ]; then
  echo "Found ${#found_primes[@]} prime(s)."
  if command -v ffmpeg >/dev/null 2>&1 && ffmpeg -version >/dev/null 2>&1; then
    bash "$CUT_BATCH" "$INBOX" "$MAP"
    for p in "${found_primes[@]}"; do
      mid=$(lookup_id "$p")
      if [ -z "$mid" ]; then
        echo "SKIP $(basename "$p") — not in $MAP"
        continue
      fi
      if [ -d "$ROOT/packs/$mid" ]; then
        copy_loops "$ROOT/packs/$mid" "$mid" && placed=$((placed + 1)) || true
      fi
    done
  else
    echo "ffmpeg not installed — cannot cut 4 loops here."
    echo "Drop finished idle/teasing/playful/aroused.mp4 in inbox/<live-folder>/"
    echo "or say packs ready after you cut them."
    echo ""
    for p in "${found_primes[@]}"; do
      mid=$(lookup_id "$p")
      echo "  $(basename "$p") → ${mid:-UNMAPPED}"
    done
  fi
fi

# Pre-cut loops: packs/inbox/<live-folder>/{idle,teasing,playful,aroused}.mp4
for dir in "$INBOX"/*/; do
  [ -d "$dir" ] || continue
  folder=$(basename "$dir")
  [ "$folder" = "." ] && continue
  has=0
  for v in "${VIBES[@]}"; do
    [ -f "$dir$v.mp4" ] && has=1
  done
  if [ "$has" -eq 1 ]; then
    echo "Pre-cut loops: $folder"
    if copy_loops "$dir" "$folder"; then
      placed=$((placed + 1))
    fi
  fi
done

echo ""
if [ ${#found_primes[@]} -eq 0 ] && [ "$placed" -eq 0 ] && [ "$unzipped" -eq 0 ]; then
  echo "Inbox empty. Drop one of:"
  echo "  maria_prime_25s.mp4   → female-playful-brat"
  echo "  sofia_prime_25s.mp4   → female-soft-goth"
  echo "  luna_prime_25s.mp4    → female-athletic-tease"
  echo "  hector_prime_25s.mp4  → twink-gym"
  echo "  diego_prime_25s.mp4   → twink-shy-boy"
  echo "  alex_prime_25s.mp4    → twink-alt-punk"
  echo "Start tonight: maria_prime_25s.mp4"
  exit 0
fi

echo "Placed $placed live folder(s)."
echo "Next: packs ready: <folder>   or   cd backend && npm run avatar:check-packs -- --write"
