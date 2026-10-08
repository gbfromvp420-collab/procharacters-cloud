#!/usr/bin/env bash
# Procharacters.cloud preview entrypoint.
#
# Serves the real product for preview: the Fastify backend API (background,
# 127.0.0.1:${BACKEND_PORT:-3001}) plus a statically-exported Next.js
# frontend (foreground on ${PORT:-3000}, served from ./dist).
#
# The static export is build-only scaffolding: five small, temporary patches
# (export-mode config, generateStaticParams for the two [id] routes, Suspense
# around useSearchParams, client-side Studio action) are applied, built, then
# restored, so the committed tree is untouched. Permanent product behaviour
# (Railway `next start` deploys) is unchanged.
#
# Writes ${OPENCODE_WEB_DIR}/deployment-output.json for the deploy controller.
# Every operational command is wrapped in `/usr/bin/time -p` per-command timing.
set -euo pipefail
time -p cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
PORT="${PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
DIST_DIR="$PROJECT_DIR/dist"
WEB_DIR="${OPENCODE_WEB_DIR:-$PROJECT_DIR}"
SCRATCH_DIR="${RUNNER_TEMP:-/tmp}"
BACKUP_DIR="$SCRATCH_DIR/procharacters-export-backup"
BACKEND_PID=""

log() { echo "[start.sh] $*"; }

restore_patches() {
  if [ -d "$BACKUP_DIR" ]; then
    log "restoring pre-export source files"
    /usr/bin/time -p cp "$BACKUP_DIR/next.config.ts" "$PROJECT_DIR/frontend/next.config.ts"
    /usr/bin/time -p cp "$BACKUP_DIR/character-id-page.tsx" "$PROJECT_DIR/frontend/src/app/character/[id]/page.tsx"
    /usr/bin/time -p cp "$BACKUP_DIR/studio-edit-page.tsx" "$PROJECT_DIR/frontend/src/app/models/studio/edit/[id]/page.tsx"
    /usr/bin/time -p cp "$BACKUP_DIR/studio-page.tsx" "$PROJECT_DIR/frontend/src/app/models/studio/page.tsx"
    /usr/bin/time -p cp "$BACKUP_DIR/actions.ts" "$PROJECT_DIR/frontend/src/app/models/studio/actions.ts"
    /usr/bin/time -p rm -rf "$BACKUP_DIR"
  fi
}

on_error() {
  restore_patches
  if [ -n "${BACKEND_PID:-}" ]; then
    /usr/bin/time -p kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap on_error ERR

# ---- 1. Install dependencies (skip when node_modules is newer than lockfile).
if [ ! -d "$PROJECT_DIR/backend/node_modules" ] || [ "$PROJECT_DIR/backend/package-lock.json" -nt "$PROJECT_DIR/backend/node_modules" ]; then
  log "installing backend dependencies"
  /usr/bin/time -p npm ci --prefix "$PROJECT_DIR/backend" --no-audit --no-fund
else
  log "backend dependencies up to date"
fi
if [ ! -d "$PROJECT_DIR/frontend/node_modules" ] || [ "$PROJECT_DIR/frontend/package-lock.json" -nt "$PROJECT_DIR/frontend/node_modules" ]; then
  log "installing frontend dependencies"
  /usr/bin/time -p npm ci --prefix "$PROJECT_DIR/frontend" --no-audit --no-fund
else
  log "frontend dependencies up to date"
fi

# ---- 2. Build the backend when needed (includes prisma generate).
if [ ! -f "$PROJECT_DIR/backend/dist/index.js" ]; then
  log "building backend"
  /usr/bin/time -p env DATABASE_URL="${DATABASE_URL:-}" npm run build --prefix "$PROJECT_DIR/backend"
else
  log "backend dist present"
fi

# ---- 3. Launch the backend API in the background (same tmux session).
if /usr/bin/time -p curl --fail --silent --max-time 3 "http://127.0.0.1:$BACKEND_PORT/api/v1/characters/gallery" >/dev/null; then
  log "backend already healthy on :$BACKEND_PORT, reusing"
else
  log "starting backend on $BACKEND_HOST:$BACKEND_PORT"
  /usr/bin/time -p mkdir -p "$WEB_DIR"
  # shellcheck disable=SC2086
  /usr/bin/time -p env DATABASE_URL="" HOST="$BACKEND_HOST" PORT="$BACKEND_PORT" \
    NODE_ENV="production" ACCOUNTS_PROVIDER="json" \
    nohup node "$PROJECT_DIR/backend/dist/index.js" >"$WEB_DIR/backend.preview.log" 2>&1 &
  BACKEND_PID="$!"
  log "backend pid $BACKEND_PID"
fi

# ---- 4. Wait for backend readiness (the export bakes gallery data at build time).
log "waiting for backend gallery endpoint"
ready=false
for _ in $(/usr/bin/time -p seq 1 30); do
  if /usr/bin/time -p curl --fail --silent --max-time 3 "http://127.0.0.1:$BACKEND_PORT/api/v1/characters/gallery" >/dev/null; then
    ready=true
    break
  fi
  /usr/bin/time -p sleep 2
done
if [ "$ready" != true ]; then
  log "ERROR: backend did not become ready on :$BACKEND_PORT (see $WEB_DIR/backend.preview.log)"
  exit 1
fi
log "backend ready"

# ---- 5. Temporary static-export patches (restored after the build).
log "staging temporary export patches"
/usr/bin/time -p mkdir -p "$BACKUP_DIR"
/usr/bin/time -p cp "$PROJECT_DIR/frontend/next.config.ts" "$BACKUP_DIR/next.config.ts"
/usr/bin/time -p cp "$PROJECT_DIR/frontend/src/app/character/[id]/page.tsx" "$BACKUP_DIR/character-id-page.tsx"
/usr/bin/time -p cp "$PROJECT_DIR/frontend/src/app/models/studio/edit/[id]/page.tsx" "$BACKUP_DIR/studio-edit-page.tsx"
/usr/bin/time -p cp "$PROJECT_DIR/frontend/src/app/models/studio/page.tsx" "$BACKUP_DIR/studio-page.tsx"
/usr/bin/time -p cp "$PROJECT_DIR/frontend/src/app/models/studio/actions.ts" "$BACKUP_DIR/actions.ts"
/usr/bin/time -p python3 - "$PROJECT_DIR" <<'PYEOF'
import sys
root = sys.argv[1]

def patch(path, old, new, count=1):
    with open(path) as f:
        s = f.read()
    found = s.count(old)
    assert found == count, f"{path}: anchor found {found}x, expected {count}x"
    with open(path, "w") as f:
        f.write(s.replace(old, new))

# 5a. Export-mode config (temporary: Railway keeps server-mode `next start`).
patch(root + "/frontend/next.config.ts",
      "  outputFileTracingRoot: frontendRoot,\n};",
      "  outputFileTracingRoot: frontendRoot,\n"
      "  output: \"export\",\n"
      "  distDir: \"../dist\",\n"
      "  images: { unoptimized: true },\n};")

# 5b. Server Actions are unavailable under `output: "export"`; this Forge
# proxy already supports direct REST, so run it client-side for the preview.
patch(root + "/frontend/src/app/models/studio/actions.ts",
      '"use server";',
      '// Preview static export: Server Actions unavailable; runs client-side.')

# 5c. useSearchParams needs a Suspense boundary for static prerendering.
patch(root + "/frontend/src/app/models/studio/page.tsx",
      'import type { Metadata } from "next";\nimport { ModelsStudio } from "@/components/ModelsStudio";',
      'import type { Metadata } from "next";\nimport { Suspense } from "react";\nimport { ModelsStudio } from "@/components/ModelsStudio";')
patch(root + "/frontend/src/app/models/studio/page.tsx",
      '  return <ModelsStudio />;',
      '  return (\n    <Suspense fallback={null}>\n      <ModelsStudio />\n    </Suspense>\n  );')

# 5d. Studio edit route: Suspense + at least one static param (empty export
# lists are rejected under `output: "export"`).
patch(root + "/frontend/src/app/models/studio/edit/[id]/page.tsx",
      'import type { Metadata } from "next";\nimport { ModelsStudio } from "@/components/ModelsStudio";',
      'import type { Metadata } from "next";\nimport { Suspense } from "react";\nimport { ModelsStudio } from "@/components/ModelsStudio";\n\n'
      '// Preview static export only: pre-render a placeholder edit route.\n'
      'export async function generateStaticParams() {\n  return [{ id: "preview" }];\n}')
patch(root + "/frontend/src/app/models/studio/edit/[id]/page.tsx",
      '  return <ModelsStudio editId={decodeURIComponent(id || "")} />;',
      '  return (\n    <Suspense fallback={null}>\n      <ModelsStudio editId={decodeURIComponent(id || "")} />\n    </Suspense>\n  );')
print("export patches applied")
PYEOF

# 5e. Character route: pre-render one page per gallery character known now.
/usr/bin/time -p cat >>"$PROJECT_DIR/frontend/src/app/character/[id]/page.tsx" <<'TSEOF'

// Preview static export only: pre-render one card page per gallery character.
// Falls back to a placeholder id so the export never sees an empty list.
export async function generateStaticParams() {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const res = await fetch(`${base}/api/v1/characters/gallery`, { cache: "no-store" });
    if (!res.ok) return [{ id: "preview" }];
    const data = (await res.json()) as { characters?: { id: string }[] };
    const ids = (data.characters ?? []).map((c) => ({ id: c.id }));
    return ids.length > 0 ? ids : [{ id: "preview" }];
  } catch {
    return [{ id: "preview" }];
  }
}
TSEOF
log "temporary export patches staged"

# ---- 6. Build the static export into ./dist.
/usr/bin/time -p rm -rf "$DIST_DIR" "$PROJECT_DIR/frontend/.next"
log "building static frontend export"
/usr/bin/time -p env NEXT_PUBLIC_API_URL="http://127.0.0.1:$BACKEND_PORT" npm run build --prefix "$PROJECT_DIR/frontend"

# ---- 7. Restore sources immediately; verify output; publish metadata.
restore_patches
trap - ERR
if [ ! -f "$DIST_DIR/index.html" ]; then
  log "ERROR: static export missing $DIST_DIR/index.html"
  exit 1
fi
log "static export ready: $DIST_DIR"
/usr/bin/time -p mkdir -p "$WEB_DIR"
/usr/bin/time -p env PROJECT_DIR_STATE="$PROJECT_DIR" DIST_DIR_STATE="$DIST_DIR" \
  DEPLOY_JSON="$WEB_DIR/deployment-output.json" \
  node -e 'const fs=require("node:fs");fs.writeFileSync(process.env.DEPLOY_JSON,JSON.stringify({project:process.env.PROJECT_DIR_STATE,directory:process.env.DIST_DIR_STATE}));'
log "deployment metadata written to $WEB_DIR/deployment-output.json"

# ---- 8. Serve ./dist in the foreground on $PORT (tiny zero-dependency server).
/usr/bin/time -p cat >"$SCRATCH_DIR/procharacters-static-server.mjs" <<'SERVEOF'
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve, sep } from "node:path";
const root = resolve(process.env.PREVIEW_DIST || ".");
const port = Number(process.env.PORT || 3000);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4",
  ".webm": "video/webm", ".txt": "text/plain", ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon", ".woff2": "font/woff2",
};
const server = createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    let file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(404); res.end("Not found"); return;
    }
    let status = 200;
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file) || statSync(file).isDirectory()) {
      if (extname(file) === "" && existsSync(`${file}.html`)) {
        file = `${file}.html`;
      } else {
        status = 404;
        file = join(root, "404.html");
        if (!existsSync(file)) { res.writeHead(404); res.end("Not found"); return; }
      }
    }
    const ext = extname(file);
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", file.includes(`${sep}_next${sep}static${sep}`) ? "public, max-age=31536000, immutable" : "no-cache");
    res.writeHead(status);
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});
server.listen(port, "0.0.0.0", () => console.log(`[preview] serving ${root} on :${port}`));
SERVEOF
log "serving $DIST_DIR in the foreground on :$PORT"
/usr/bin/time -p env PREVIEW_DIST="$DIST_DIR" PORT="$PORT" node "$SCRATCH_DIR/procharacters-static-server.mjs"
