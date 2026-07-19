# Resume spot (if disconnected)

**Updated:** 2026-07-19 (**cook** — ERROR_WEBHOOK fix + test)  
**Session:** King Grok + Gary — stay in window; terminal crash risk if they leave.

---

## Where we are

| Track | Status | Next human move |
|-------|--------|-----------------|
| **Error alerts** | ✅ eng: **ntfy phone** (no Discord/Slack) · optional email · test button · [ops-error-webhook.md](./ops-error-webhook.md) | **You:** set `ERROR_WEBHOOK_URL=https://ntfy.sh/YOUR-SECRET-TOPIC` on **procharacters-api** → install ntfy → Send test alert |
| **Conversion Close** | ✅ unlock ceremony · heat-win Day Pass · return seed | Hard refresh web after deploy |
| Railway | ✅ project `captivating-vision` | Confirm SHA ≈ latest `main` |
| Stripe | ✅ LIVE + webhook | Careful real charge smoke if desired |
| **Next** | After webhook green: heat quality / content | Say `resume` / `spot` / `next` / `cook` |

---

## What shipped this cook (Conversion Close)

1. **PremiumUnlockCeremony** — after Stripe return, Account shows “You’re unlocked” with Create My Character · My models · Models hub · Live chat; scrolls to `#premium-unlocked`
2. **Heat-win owns pay** — SessionWin Day Pass primary when eligible; Soft Support hides while win active + 6h cooldown after win offered checkout
3. **Return seed** — SessionPausedBanner deep sessions: “We’ll hold this heat” + Enable alerts / Sign in CTA
4. Checkout success URL hash `#premium-unlocked`

Tip: `git log --oneline -25` on `main` for the full plate list.

---

## Magic words after reconnect

| Say | Meaning |
|-----|---------|
| `resume` / `spot` | Re-read this file + LIVE-STATUS |
| `next` | CEO picks next eng ship |
| `cook` | Keep shipping within v2.2 surface |
| `RAILWAY_API_TOKEN=…` | Auth Railway from this session (never commit) |

---

## Live URLs

- Gallery: https://procharacters-web-production-7288.up.railway.app  
- My models: https://procharacters-web-production-7288.up.railway.app/?filter=owned  
- Create: https://procharacters-web-production-7288.up.railway.app/chat?create=1  
- Account unlock: https://procharacters-web-production-7288.up.railway.app/account#premium-unlocked  
- API health: https://procharacters-api-production-0417.up.railway.app/health  

---

## Related

- [LIVE-STATUS.md](./LIVE-STATUS.md)  
- [GARY-PACK-EDITING.md](./GARY-PACK-EDITING.md)  
- [ops-billing-stripe.md](./ops-billing-stripe.md)  
- [RAILWAY.md](../RAILWAY.md)  

*Premium should feel usable the second after pay. Free path forever.*
