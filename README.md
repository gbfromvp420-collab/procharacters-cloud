# Procharacters.cloud — v1 Foundation

**KGC Ventures / Naughty Syntax**

Live uncensored NSFW AI video chat platform. This repo is **Version 1: Foundation only** — stable structure for prompts, characters, and agent workflows. No streaming, accounts, or public UI yet.

## Quick start

**PowerShell (Windows — no install needed):**

```powershell
.\scripts\prompt_list.ps1
.\scripts\prompt_get.ps1 -Id twink-default
.\scripts\character_list.ps1
```

**Python (if installed):**

```bash
python scripts/prompt_list.py
python scripts/prompt_get.py --id twink-default
python scripts/character_list.py
```

## Project structure

| Path | Purpose |
|------|---------|
| `.grok/skills/kgc-delegate/` | KGC Grok Delegate persona for agents |
| `docs/` | Gary-friendly guides and v1 scope |
| `prompts/` | Versioned prompt library |
| `characters/` | Character model registry |
| `scripts/` | CLI retrieval tools |

## For Gary

Start here: [`docs/README-for-Gary.md`](docs/README-for-Gary.md)

## v1 scope

**In:** Project structure, delegate persona, prompt library, character management, documentation.

**Out:** Streaming, accounts, payments, real-time assistants, complex UI, public features.

Full details: [`docs/v1-scope.md`](docs/v1-scope.md)

## Default characters (Naughty Syntax)

| Slot | Character | Status |
|------|-----------|--------|
| `default_male` | Twink Default | active |
| `default_female` | Female Default | active |

## Agent workflow

1. Load `/kgc-delegate` skill at session start
2. Check `docs/v1-scope.md` before building
3. Use prompt/character scripts for retrieval
4. End with 1–3 proactive next-step suggestions

## License

Private — KGC Ventures. All rights reserved.