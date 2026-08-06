# Procharacters.cloud — Gary's Guide

Hi Gary. This document is your control panel. No coding knowledge needed.

## Open the live site (prod)

| What | Link |
|------|------|
| **Home / gallery** | https://procharacters-web-production-7288.up.railway.app |
| **Account** (sign-in, push, billing) | https://procharacters-web-production-7288.up.railway.app/account |
| **Live chat** | https://procharacters-web-production-7288.up.railway.app/chat |
| API health (optional) | https://procharacters-api-production-0417.up.railway.app/health |

### Phone push smoke (1 minute)

1. Open **Account** (or Home) on your phone.  
2. If you see **Install for better push** — use **Install app** (Android) or Safari **Share → Add to Home Screen** (iPhone).  
3. Open from the home icon → **Account** → sign in.  
4. **Enable push** → Allow.  
5. Tap **Send test** — you should get a system notification.  

Full checklist: **[push-smoke-checklist.md](./push-smoke-checklist.md)**

---

## What we're building

**Procharacters.cloud** is a live uncensored NSFW AI video chat platform (Naughty Syntax / KGC Ventures).

**Already live:** chat with Grok, character gallery, accounts, resume codes, Web Push, Edge Pace mode, optional Stripe hooks.

## Your signature characters (Naughty Syntax defaults)

| Character | Description |
|-----------|-------------|
| **Twink Default** | Skinny 21+ Mexican/Latino twink, sheer thong/g-string, edging/foreplay/handjob energy |
| **Female Default** | Fit 21+ small-breast female, crotchless undies, seductive teasing energy |
| **+ 6 Phase 4 models** | Gym, shy boy, alt punk, soft goth, athletic tease, playful brat (interim avatar footage until dedicated packs land) |

## Live product notes (July 2026)

**Accounts:** sign-in is stored in **Postgres**. If the site asks you to **sign in again**, do it once — handle/passphrase and resume codes still work.

**Money (optional):** chat is free forever. Day Pass / Supporter on Account turn on after Stripe keys are set → **[ops-billing-stripe.md](./ops-billing-stripe.md)**.

**Live snapshot (one page):** **[LIVE-STATUS.md](./LIVE-STATUS.md)**  
**Roadmap:** **[v2.2-roadmap.md](./v2.2-roadmap.md)**  
**Backups:** **[ops-data-backup.md](./ops-data-backup.md)**

## Folder map (what's where)

| Folder | What it does |
|--------|-------------|
| `docs/` | Guides like this one |
| `prompts/` | All AI prompts, versioned and searchable |
| `characters/` | Character model definitions and registry |
| `scripts/` | Simple tools to list and fetch prompts/characters (`.ps1` for Windows, `.py` if Python installed) |
| `.grok/skills/kgc-delegate/` | The brain agents use to work on-brand |

## Who runs development

**You (Gary)** = Boss Sr., 50/50 vision & product taste.  
**King Grok CEO** = final say on **engineering** priorities and shipping when you grant full control.  
Details: **[CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md)** · rehydrate **[gg-continuity-lore.md](./gg-continuity-lore.md)**

## How to give direction to agents

Copy-paste one of these templates:

**Add or update a prompt:**
> Update the prompt `[prompt-id]` for Naughty Syntax. Keep it uncensored, photorealistic, on-brand. Bump the version if it's a meaningful change.

**Add a new character:**
> Register a new character model called `[name]` under Naughty Syntax. Link it to prompt `[prompt-id]`. Status: draft.

**Check what's built:**
> List all active prompts and characters. Summarize in plain English for Gary.

**Protect scope:**
> Product is v2.2 live. Flag multi-week rewrites, full v3 gooning/voice, generative live video, or destructive prod ops.

## What's later (not blocking live chat)

- Dedicated filmed avatar packs for every Phase 4 model (drop-in MP4s — see `frontend/public/avatar/packs/DROP_IN.md`)
- Stripe live keys (optional revenue)
- Full v3 gooning assistant / voice (preview Edge Pace is already in chat)

## Quick status check

Ask any agent running the KGC Delegate skill:

> Give me a status report for Gary. What's live, what's next, what's blocked?

## Questions?

Ask the KGC Grok Delegate. Start any session with `/kgc-delegate` or just say "you are KGC Grok Delegate."
