# Procharacters.cloud — Gary's Guide

Hi Gary. This document is your control panel. No coding knowledge needed.

## What we're building

**Procharacters.cloud** is a live uncensored NSFW AI video chat platform. Version 1 is just the **foundation** — the bones everything else will grow on.

Think of v1 like building the warehouse before opening the store. We're setting up:

- Where prompts live and how they're versioned
- Where character models are defined and switched
- How agents (like Grok) work consistently on our brand
- Simple docs so you can direct development in plain English

## Your two signature characters (Naughty Syntax defaults)

| Character | Description |
|-----------|-------------|
| **Twink Default** | Skinny 18yo Mexican/Latino twink, sheer thong/g-string, edging/foreplay/handjob energy |
| **Female Default** | Fit 18yo small-breast female, crotchless undies, seductive teasing energy |

These are stored in the project now as structured files. Live video chat comes in v2.

## Live product roadmap (v2.2)

We're past foundation — chat, accounts, resumes, gallery, and Web Push are live.

**Next 10 phases (plain English):** see **[v2.2-roadmap.md](./v2.2-roadmap.md)**  
**Push smoke on your phone:** see **[push-smoke-checklist.md](./push-smoke-checklist.md)**

## Folder map (what's where)

| Folder | What it does |
|--------|-------------|
| `docs/` | Guides like this one |
| `prompts/` | All AI prompts, versioned and searchable |
| `characters/` | Character model definitions and registry |
| `scripts/` | Simple tools to list and fetch prompts/characters (`.ps1` for Windows, `.py` if Python installed) |
| `.grok/skills/kgc-delegate/` | The brain agents use to work on-brand |

## How to give direction to agents

Copy-paste one of these templates:

**Add or update a prompt:**
> Update the prompt `[prompt-id]` for Naughty Syntax. Keep it uncensored, photorealistic, on-brand. Bump the version if it's a meaningful change.

**Add a new character:**
> Register a new character model called `[name]` under Naughty Syntax. Link it to prompt `[prompt-id]`. Status: draft.

**Check what's built:**
> List all active prompts and characters. Summarize in plain English for Gary.

**Protect scope:**
> This is v1 only. Do not build streaming, accounts, or public UI. Flag anything that drifts.

## What's NOT in v1

- No live video chat yet
- No user accounts or payments
- No public website
- No edging/gooning real-time assistant (that's v3+)

If an agent starts building any of these, tell it: **"Stop — that's out of v1 scope."**

## Quick status check

Ask any agent running the KGC Delegate skill:

> Give me a v1 status report for Gary. What's built, what's next, what's blocked?

## Questions?

Ask the KGC Grok Delegate. Start any session with `/kgc-delegate` or just say "you are KGC Grok Delegate."