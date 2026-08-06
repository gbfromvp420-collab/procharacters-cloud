# Ops — Railway `/data` volume backup

**Audience:** Gary + builders  
**Service:** `procharacters-api`  
**Goal:** Don’t lose accounts, resumes, customs, or chat archives on redeploy.

---

## What lives on the volume

Mount a Railway volume at **`/data`** on `procharacters-api`. Typical layout:

| Path | Contents |
|------|----------|
| `/data/custom-characters.json` | Runtime custom / My Characters |
| `/data/sessions/` | Session transcripts (JSON per session) |
| `/data/accounts.json` (or `ACCOUNTS_PATH`) | **Legacy** accounts + resume codes (JSON provider). Prod cutover: live auth is Postgres. |
| `/data/accounts.json.pre-prisma-backup-*` | Cold JSON snapshot after Prisma cutover (disaster recovery only) |
| Postgres (`ACCOUNTS_PROVIDER=prisma`) | Live accounts, credentials, tokens, magic links, resume codes, plan fields |
| `/data/push-subscriptions.json` | Web Push subscriptions |
| `/data/cross-session-notes.json` | Opt-in cross-session memory notes |
| `/data/uploads/` | Custom clip uploads (if configured) |

Env vars that should point at the volume (examples):

```
CUSTOM_CHARACTERS_PATH=/data/custom-characters.json
SESSIONS_PATH=/data/sessions
ACCOUNTS_PATH=/data/accounts.json
PUSH_SUBSCRIPTIONS_PATH=/data/push-subscriptions.json
CROSS_SESSION_NOTES_PATH=/data/cross-session-notes.json
```

Without a volume, data may still write under `/data` inside the container but **vanishes on redeploy**.

---

## Backup cadence (recommended)

| Cadence | Action |
|---------|--------|
| **Weekly** | Snapshot full `/data` |
| **Before risky deploys** | Ad-hoc snapshot |
| **After big content days** | Extra snapshot of `custom-characters.json` + `sessions/` |

---

## Manual backup (Railway CLI / shell)

If you have a one-off shell on the API service:

```bash
# From the container (paths may vary by Railway tooling)
tar -czf /tmp/procharacters-data-$(date +%Y%m%d).tgz -C /data .
# Then download /tmp/procharacters-data-*.tgz via Railway file UI or scp workflow
```

Or copy critical files only:

```bash
cp /data/custom-characters.json ~/backups/
cp /data/accounts.json ~/backups/
cp -R /data/sessions ~/backups/sessions-$(date +%Y%m%d)
```

Store backups **off Railway** (encrypted drive, S3, etc.).

---

## Accounts / Prisma cutover (production)

**Status:** Live on `ACCOUNTS_PROVIDER=prisma` + Railway `Postgres-Hw0Y` (2026-07-16).

| Asset | Where |
|-------|--------|
| Live auth | Postgres tables (`UserAccount`, `AuthCredential`, `AuthToken`, `MagicLink`, `ResumeCode`) |
| Volume cold backup | `/data/accounts.json.pre-prisma-backup-2026-07-16` |
| Laptop cold backup | `data/backups/accounts-2026-07-16-pre-prisma-cutover.json` (**gitignored** — keep off-repo copy) |

**Disaster restore (JSON → Postgres):**

```bash
# Prefer public DATABASE_URL proxy from Railway Postgres vars
cd backend
npm run accounts:import-json -- --path ../data/backups/accounts-YYYY-MM-DD.json --dry-run
npm run accounts:import-json -- --path ../data/backups/accounts-YYYY-MM-DD.json
# Keep ACCOUNTS_PROVIDER=prisma
```

**Do not** flip back to `json` without understanding you will drop Postgres-only accounts created after cutover.

---

## Restore (high level)

1. Stop or pause traffic if possible (or accept brief inconsistency).  
2. Restore files into `/data` with the same names.  
3. Restart `procharacters-api`.  
4. Smoke: `GET /health`, sign-in, list My Characters, open a resume code.  
5. For accounts on Prisma: restore DB (or re-import JSON backup) — volume JSON alone is not enough.

---

## Observability hooks (Phase 8)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness + LiveKit + observability flags |
| `GET /metrics` | In-process counters (requests, errors, sessions, chat turns) |

Optional:

| Env | Purpose |
|-----|---------|
| `LOG_LEVEL` | `info` (default), `debug`, `warn` |
| `ERROR_WEBHOOK_URL` | POST JSON on 5xx (Slack/Discord-compatible text field) |
| `SENTRY_DSN` | Flag only in health for now — wire SDK later if needed |

Request logs include `requestId`, `method`, `path`, `statusCode`, `durationMs` (no bodies — NSFW/PII safe).

---

## Deploy smoke (after every production ship)

From `backend/`:

```bash
npm run smoke:deploy
# or local:
API_BASE=http://localhost:3001 npm run smoke:deploy
```

Covers health, metrics, 8-model catalog, gallery, prefill, Edge Pace session create, My Character auth/private, billing free path.

## Checklist

- [ ] Volume mounted at `/data` on production API  
- [ ] Persistence env vars point under `/data`  
- [ ] Weekly backup reminder on calendar  
- [ ] Off-site copy of last known-good tarball  
- [ ] `GET /metrics` bookmarked for ops  
- [ ] `npm run smoke:deploy` green after deploy  
