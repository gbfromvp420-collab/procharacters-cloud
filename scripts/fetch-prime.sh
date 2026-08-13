#!/usr/bin/env bash
# Pull a remote prime (or zip) into packs/inbox/.
# Usage:
#   bash scripts/fetch-prime.sh <url>
#   bash scripts/fetch-prime.sh <url> maria_prime_25s.mp4
#
# Default name is maria_prime_25s.mp4 (first Pack 01 drop).
# Does not invent footage. URL must be a real file.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INBOX="${INBOX:-$ROOT/packs/inbox}"
URL="${1:-}"
NAME="${2:-maria_prime_25s.mp4}"

if [ -z "$URL" ]; then
  echo "Usage: $0 <url> [filename]" >&2
  echo "  default filename: maria_prime_25s.mp4" >&2
  exit 2
fi

case "$URL" in
  http://*|https://*) ;;
  *)
    echo "Need an http(s) URL, got: $URL" >&2
    exit 2
    ;;
esac

# Dropbox share → direct file
if echo "$URL" | grep -q 'dropbox.com'; then
  if echo "$URL" | grep -q 'dl=0'; then
    URL=$(echo "$URL" | sed 's/dl=0/dl=1/')
  elif ! echo "$URL" | grep -q 'dl='; then
    case "$URL" in
      *\?*) URL="${URL}&dl=1" ;;
      *)    URL="${URL}?dl=1" ;;
    esac
  fi
fi

# Google Drive /file/d/<id>/view → uc export
if echo "$URL" | grep -q 'drive.google.com/file/d/'; then
  id=$(echo "$URL" | sed -n 's#.*drive.google.com/file/d/\([^/]*\).*#\1#p')
  if [ -n "$id" ]; then
    URL="https://drive.google.com/uc?export=download&id=${id}"
  fi
fi

mkdir -p "$INBOX"
DEST="$INBOX/$NAME"

echo "Fetch → $DEST"
echo "  $URL"

tmp=$(mktemp "$INBOX/.fetch.XXXXXX")
trap 'rm -f "$tmp"' EXIT

if ! curl -L --fail --retry 2 --max-filesize 209715200 --connect-timeout 20 \
    -A "procharacters-pack-fetch/1.0" \
    -o "$tmp" "$URL"; then
  echo "Download failed." >&2
  exit 1
fi

size=$(wc -c < "$tmp" | tr -d ' ')
if [ "$size" -lt 10240 ]; then
  echo "File too small (${size} bytes) — not a 20–30s prime." >&2
  exit 1
fi

head=$(head -c 64 "$tmp" | tr -d '\0')
case "$head" in
  \<!DOCTYPE*|\<html*|\<HTML*|\{*)
    echo "Got a web page, not a video. Use a direct mp4 link or Dropbox dl=1." >&2
    exit 1
    ;;
esac

# Zip lands as-is so unpack-packs.sh can unzip it
case "$NAME" in
  *.zip|*.ZIP) ;;
  *)
    case "$head" in
      PK*)
        echo "That URL is a zip — saving as packs.zip"
        NAME="packs.zip"
        DEST="$INBOX/$NAME"
        ;;
    esac
    ;;
esac

mv -f "$tmp" "$DEST"
trap - EXIT
echo "Saved ${size} bytes → $DEST"
