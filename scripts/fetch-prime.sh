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
ck=$(mktemp "$INBOX/.fetch.ck.XXXXXX")
trap 'rm -f "$tmp" "$ck"' EXIT

curl_get() {
  curl -L --retry 2 --max-filesize 209715200 --connect-timeout 20 \
    -A "Mozilla/5.0 procharacters-pack-fetch/1.1" \
    -c "$ck" -b "$ck" \
    -o "$tmp" "$1"
}

if ! curl_get "$URL"; then
  echo "Download failed." >&2
  exit 1
fi

# Google Drive virus-scan interstitial for large files
if grep -q 'Virus scan warning\|drive.usercontent.google.com/download' "$tmp" 2>/dev/null; then
  confirm_id=$(sed -n 's/.*name="id" value="\([^"]*\)".*/\1/p' "$tmp" | head -1)
  confirm_uuid=$(sed -n 's/.*name="uuid" value="\([^"]*\)".*/\1/p' "$tmp" | head -1)
  if [ -n "${confirm_id:-}" ]; then
    echo "Drive confirm page — downloading file $confirm_id"
    URL="https://drive.usercontent.google.com/download?id=${confirm_id}&export=download&confirm=t"
    if [ -n "${confirm_uuid:-}" ]; then
      URL="${URL}&uuid=${confirm_uuid}"
    fi
    if ! curl_get "$URL"; then
      echo "Download failed after Drive confirm." >&2
      exit 1
    fi
  fi
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
rm -f "$ck"
trap - EXIT
echo "Saved ${size} bytes → $DEST"
