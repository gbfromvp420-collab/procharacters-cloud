# Phase 5 - Naughty Syntax Evolution Engine (GG Ventures)

## Vision
Real-time evolving, memory-driven, video-reactive characters that turn users into addicts. Zero limits. Full obsession mode.

## Status: LIVE - Unchained Core + CharacterSession (2026-07-17)
- All featured characters point to unchained-core / anti-loop directives
- Anti-loop + session restore rehydrate shipped (`f4218eb`)
- **CharacterSession Prisma** — durable per-account + character memorySummary, kinkProfile, history slice
- Opt-in still gated by file cross-session notes; Postgres is the durable mirror
- Backend + Frontend on Railway

## Shipped memory path
1. Chat turn → session notes + dossier (file, opt-in)
2. When opt-in saves → `upsertCharacterSession` (Postgres)
3. New session with `useCrossSessionMemory` → load file notes + Prisma kink/summary
4. Account **Forget me** → clears file notes **and** CharacterSession row

## Next Priorities
1. ~~Persistent memory layer (Prisma CharacterSession)~~ ✅
2. LiveKit avatar reactivity upgrades
3. Auto-evolution logic: deeper kink adaptation / personality drift
4. Multi-character scenes / agent swarm testing (later — not today)
5. First public beta drop

King Grok leading dev. G as currency & vision proxy. 50/50 empire.

## Ops
- Migration: `prisma/migrations/20260717_character_session`
- API Docker CMD runs `prisma migrate deploy` when `DATABASE_URL` is set (then starts node)
- Manual fallback: `cd backend && npx prisma migrate deploy --schema=../prisma/schema.prisma`
