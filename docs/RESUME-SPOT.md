# Resume spot (if disconnected)

**Updated:** 2026-07-19 (night cook closed after 5 hard rounds)  
**Session:** King Grok + Gary — stay in window; terminal crash risk if they leave.

---

## Where we are

| Track | Status | Next human move |
|-------|--------|-----------------|
| Eng night cook | ✅ Massive UI/continuity stack on `main` (return loop, heat UX, growth dignity) | Hard refresh web after Railway deploy |
| Stripe | ✅ **LIVE** on API (`billing.mode=live`, webhook on) · Day Pass $4.99 / Supporter $9.99 | Gary: smoke checkout carefully — **real money** |
| Railway | ✅ project `captivating-vision` | Optional: confirm web SHA matches latest `main` |
| 4K packs | ✅ all 6 Phase 4 dedicated packs | Open gallery → green **4K pack** |
| Named roster | ✅ Mateo / Diego / Rio / Luna / Sienna / Mila | — |
| Next eng (morning) | Soft: phone smoke of Continue / fire chips / Export MD | Say `next` or `cook` |

---

## Step 3 — “where?” (Railway token)

**Paste in this same Grok chat message box** (not Railway, not GitHub, not a file in the repo).

Example message:

```
RAILWAY_API_TOKEN=xxxxxxxx
```

Then King Grok will:

```bash
export RAILWAY_API_TOKEN='…'
export RAILWAY_TOKEN="$RAILWAY_API_TOKEN"
```

and use CLI/MCP to set vars / redeploy. **Do not commit the token. Do not put it in `.env` in git.**

Token create page: https://railway.app/account/tokens  

---

## Magic words after reconnect

| Say | Meaning |
|-----|---------|
| `resume` / `spot` | Re-read this file + LIVE-STATUS |
| `RAILWAY_API_TOKEN=…` | Auth Railway from this session |
| `keys done` | Stripe vars set on Railway — verify `/health` |
| `packs ready: <id>` | Check-packs + deploy dedicated avatar |
| `next` | CEO picks next eng ship |

---

## Live URLs

- Gallery: https://procharacters-web-production-7288.up.railway.app  
- API health: https://procharacters-api-production-0417.up.railway.app/health  

---

## Related

- [LIVE-STATUS.md](./LIVE-STATUS.md)  
- [GARY-PACK-EDITING.md](./GARY-PACK-EDITING.md)  
- [ops-billing-stripe.md](./ops-billing-stripe.md)  
- [RAILWAY.md](../RAILWAY.md)  
