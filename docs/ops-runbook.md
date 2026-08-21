# Ops runbook — /health & /metrics

Fast on-call reference for the backend API's observability endpoints. What each
field means, what "healthy" looks like, and what to do when it isn't. Related:
[ops-error-webhook.md](./ops-error-webhook.md), [ops-billing-stripe.md](./ops-billing-stripe.md),
[ops-data-backup.md](./ops-data-backup.md), [LIVE-STATUS.md](./LIVE-STATUS.md).

## Endpoints

| Endpoint | Auth | Use |
| --- | --- | --- |
| `GET /health` | none | Liveness + configuration/readiness snapshot |
| `GET /metrics` | none | In-process counters (reset on restart) |
| `GET /avatar-packs` | none | Phase 4 avatar pack readiness |
| `POST /api/v1/ops/error-webhook/test` | none (1/min) | Fire a test alert to the configured channel |

Quick check:

```bash
curl -fsS https://<api-host>/health | jq .status   # expect "ok"
curl -fsS https://<api-host>/metrics | jq '{uptimeSec, httpErrors5xx, chatLlmErrors}'
```

## /health fields

| Field | Healthy | If not |
| --- | --- | --- |
| `status` | `"ok"` | Non-200 or unreachable → service down. Check host/logs/restart. |
| `deploy.gitShaShort` | matches the SHA you shipped | Mismatch → wrong/older build live; redeploy the intended commit. |
| `accounts.provider` | `"prisma"` in prod (`"json"` local/dev) | Unexpected `json` in prod → `ACCOUNTS_PROVIDER`/`DATABASE_URL` missing. |
| `accounts.database.ok` (prisma only) | `true` | `false`/error → Postgres unreachable; check `DATABASE_URL`, DB status, latency. |
| `livekit.badge` | `"ready"` when video sync is expected | `"off"` → `LIVEKIT_*` unset; WS `mediaUrl` still works, multi-client sync won't. |
| `avatar.dedicatedReady` | lists the Phase 4 packs with all loops | Missing ids → clips not deployed; see `/avatar-packs`. |
| `observability.webPush` | `true` when reclaim push is expected | `false` → `VAPID_*` unset; expiry-reclaim push disabled. |
| `observability.alertChannel` | `"discord"`/`"ntfy"`/… (not `"none"`) | `"none"` → no error alerting; set `ERROR_WEBHOOK_URL` (see ops-error-webhook.md). |
| `observability.lastExpiryCron` | recent `at` when push is on | `null` after uptime with push on → cron not ticking; check logs/`RESUME_EXPIRY_PUSH_CRON_MS`. |
| `billing.mode` | `"live"` when charging | `"off"`/`"test"` unexpectedly → `STRIPE_*` misconfigured. `freePath: true` = free access still on. |
| `generativeVideo.configured` | `true` only when opt-in gen video is wired | Default `false` = 4-loop clips only (expected). |

## /metrics fields (in-process counters, reset on restart)

Counters are cumulative since `startedAt`; a low `uptimeSec` means a recent
restart (so low counts are expected, not an incident).

| Field | Watch for |
| --- | --- |
| `uptimeSec` | Dropping to near-zero unexpectedly = crash/restart loop. |
| `httpErrors5xx` | Rising = server-side failures; check logs. |
| `httpErrors4xx` | Spikes = client/abuse or a broken client contract. |
| `wsErrors` | Rising vs `wsConnections` = chat socket instability. |
| `chatLlmErrors` vs `chatTurns` | High ratio = xAI/Grok issues (key, quota, upstream). Stub replies still serve. |
| `sessionsCreated` / `sessionsResumed` | Healthy funnel; resumes ~ returning users. |
| `authFailures` vs `authLogin` | Sustained high ratio = credential-stuffing or a broken login path. |
| `pushExpirySent` / `pushExpirySkipped` / `pushExpiryCronTicks` | Ticks advancing but 0 sent for a long time with subs present = delivery problem. |
| `genVideoErrors` vs `genVideoRequests` | High ratio = gen-video provider down (falls back to loops). |

## Common scenarios

- **`/health` unreachable or non-200** → service down. Check platform status and
  app logs; restart. Confirm `deploy.gitShaShort` after recovery.
- **`accounts.database.ok: false`** (prisma) → Postgres issue. Verify
  `DATABASE_URL`, DB health, and network; the API stays up but account features
  degrade.
- **`chatLlmErrors` climbing** → xAI key/quota/upstream. Chat degrades to stub
  replies (`"set XAI_API_KEY…"`); rotate/renew the key or wait out the upstream.
- **`alertChannel: "none"`** → you are flying blind on errors. Set
  `ERROR_WEBHOOK_URL` (ntfy is the no-Discord option) — see ops-error-webhook.md,
  then fire `POST /api/v1/ops/error-webhook/test` to confirm delivery.
- **`httpErrors5xx` spike** → pull logs, correlate with `deploy.gitShaShort`; roll
  back to the previous good commit if it started after a deploy.

## Local verification

```bash
bash scripts/smoke-local-product.sh   # boots backend, checks health + characters + session
```

The `/health` and `/metrics` contracts are covered by
`backend/tests/health-route.test.ts` and `backend/tests/metrics.test.ts`.
