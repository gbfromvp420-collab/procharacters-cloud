# Smoke — Agent fleet cook loops

**Owner:** Gary (phone) · **Prep:** King Grok / `kgc-smoke`  
**Updated:** 2026-08-21  

**Live web:** https://procharacters-web-production-7288.up.railway.app  
**API health:** https://procharacters-api-production-0417.up.railway.app/health  
Expect `deploy.gitSha` to match latest ship you care about.

---

## Smoke: A — Forge DNA happy path

1. Sign in (Account)  
2. Open **Studio Forge** → type fantasy → **Forge model** → **Save · Chat Now**  
3. Opening should feel *forged* (starter / DNA seeds), not generic custom  
4. Fire chips / heat until **DNA · Tease** or **Edge** on whisper strip  
5. **End** → gallery tile or pause shows **DNA · …** badge  

**Pass if:** tree climbed + trail stamped.  
**Fail →** `/kgc-forge` (create/open) or `/kgc-return` (trail missing).

---

## Smoke: B — Dossier + Forge this heat

1. After A, open **New chat** on same model (not Continue)  
2. DNA should **not** cold-reset to Spark if you climbed past it (signed-in)  
3. Deep heat → **Forge this DNA** (win toast or End banner)  
4. Studio shows **Heat seed loaded** → Forge → Save → Chat Now  

**Pass if:** seed prefilled + new private DNA model chats.  
**Fail →** `/kgc-forge` (seed/CTA) or `/kgc-return` (dossier rehydrate).

---

## Smoke: C — DNA power Continue

1. After climb + End, gallery **DNA power · Edge reclaim** / Continue  
2. Should open Edge Pace + tree node restored  

**Pass if:** not a cold normal session.  
**Fail →** `/kgc-return`.

---

## Smoke: D — Free path

1. Chat without paying  
2. Day Pass only optional  

**Pass if:** no paywall on chat.  
**Fail →** `/kgc-ops` + growth gates.

---

## Smoke: E — Second device heat trail

1. Sign in on phone A · chat Jenny (or anyone) until you have a recap / DNA chip  
2. **End** or leave  
3. Sign in on phone B (or a private window)  
4. Gallery tile / Account Continue should show the **same recap + DNA**, not a blank Continue  

**Pass if:** phone B Continue is warm (quote + DNA chip) and opens Edge when DNA is hot.  
**Fail →** `/kgc-return`.

---

## Ops glance (optional)

```bash
curl -sS https://procharacters-api-production-0417.up.railway.app/health | head -c 800
curl -sS https://procharacters-api-production-0417.up.railway.app/metrics | head -c 800
```

Watch: `forgeExpands`, `customV3Created`, `dnaTreeAdvances`, `dnaDossierReclaims`, `pushDnaPowerReclaims`.

---

*kgc-smoke · King Grok CEO fleet*
