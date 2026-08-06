#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_SHA="${1:-e0986f5c4bc23c979f48960abd6628af698847f1}"
cd "$ROOT"
git show "${BASE_SHA}:frontend/src/components/ChatApp.tsx" > frontend/src/components/ChatApp.tsx
git apply scripts/restore-chatapp-session-drop.patch
grep -q 'export function ChatApp' frontend/src/components/ChatApp.tsx
echo "Restored ChatApp ($(wc -c < frontend/src/components/ChatApp.tsx) bytes)"
