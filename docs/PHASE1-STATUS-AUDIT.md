# Phase 1 — Status audit (evidence-based)

**Date:** 2026-09-10
**Deploy audited:** `00bb201` (matches `main` HEAD)
**Method:** live probes against production + source read. No claim in this doc comes from another doc.

> This supersedes the green badges in `LIVE-STATUS.md` where the two disagree.
> `LIVE-STATUS.md` was last updated 2026-08-21 and is now wrong in two places
> (chat, age floor). Corrections applied there in the same change.

---

## Headline

**The infrastructure is up. The product is down.**

Every chat turn in production fails. The xAI account is out of credits, so all
50 characters reply with the same string instead of dialogue. Everything
wrapped around the brain — sessions, WebSocket, resume, avatar video, accounts,
Stripe — works. There is nothing to sell until the brain is back on.

Measured on prod, 2026-09-10 20:30–20:35 UTC:

| Signal | Value |
|--------|-------|
| `chatTurns` | 12 |
| `chatLlmErrors` | **12** |
| Chat success rate | **0%** |

What a real user saw, verbatim, on every message to two different characters:

```
*[System: xAI credits / spending limit hit — top up or raise limit at console.x.ai]*
```

---

## The four questions

### 1. Is the Railway production deployment still live and functional right now?

**Live: yes. Functional: no.**

| Check | Result |
|-------|--------|
| Web `/` `/chat` `/account` `/models/studio` | 200 |
| API `/health` | 200 · `status: ok` |
| Postgres | `ok: true` · 3 ms |
| LiveKit | configured · `ready` |
| Stripe | `live` + webhook true |
| Avatar clips (sampled across packs) | 206 · `video/mp4` |
| Session create → WS → resume | works |
| **Chat replies** | **0% success — all 12/12 turns failed** |

One caveat on the API: the first request took **3.7 s** and returned
`uptimeSec: 1`. The service cold-starts. A new user's first message pays that
penalty.

### 2. What is the single biggest thing that breaks in a full session?

**The character has no brain, and the failure is shown to the user as if she
said it.**

This is one root cause (dead xAI account) with a second, separate bug layered
on top that made it far worse than it needed to be:

- The raw vendor error was rendered **in the character's own message bubble**,
  in her voice, telling a paying stranger to go top up an account at
  `console.x.ai`.
- That string was **written into the saved transcript** via `addTurn`, so it
  survived resume and would replay to the model as prior character dialogue
  even after credits were restored.

Bug 2 is fixed in this change (`smoke-llm-failure.ts` guards it). **Bug 1 is a
billing action only Gary can take.**

### 3. Is a payment processor set up?

**Yes — Stripe is live and wired, but it does not gate anything.**

| | |
|--|--|
| Mode | `live` |
| Webhook | configured, signature verified, `checkout.session.completed` |
| Day Pass | $4.99 one-time → 1 day |
| Supporter | $9.99 one-time → 30 days |
| Subscriptions | **none** — both products are one-time payments |

The gap is not plumbing, it is **what money buys**. Today paying upgrades the
My Characters cap from 10 → 40 and raises clip-upload rate limits. Chat, all 50
characters, memory, resume, and Edge Pace are free to everyone, including
signed-out guests. `billing.freePath: true` is a hardcoded product statement,
not a bypass flag.

**There is currently no reason for a chat user to pay.**

### 4. Existing content assets, character packs, Bluesky cadence?

**Strong content. Zero distribution.**

| Asset | Reality |
|-------|---------|
| Characters | 50 live, all with registry + model + catalog entries |
| Avatar loops | **200 MP4s (50 × 4), ~510 MB**, committed and serving |
| Pack 01 (8) | Deep hand-authored personas — 467–987 words each |
| Pack 02 (13) | **Templated prompts — 134 words, identical structure** |
| Pack 03 (29) | **Templated prompts — 135 words, identical structure** |
| Bluesky / X / Reddit / TikTok | **Nothing. No integration, no scripts, no calendar.** |
| Content pipeline | ffmpeg loop-cutting + GitHub cook workflows (asset prep only) |

So: 42 of 50 characters are a name, a video, and a shared template. The
differentiation lives in gallery copy, not in the prompt the model actually
receives. That directly undercuts "character consistency is our edge."

The only social reference anywhere in the repo is a line in a Grok skill file.
Phase 3 distribution starts from zero.

---

## Prioritized blocker list

Ordered by what stops a stranger from having a session worth paying for.

### P0 — nothing else matters until these are done

**1. xAI account is out of credits.** *(Gary — billing, not code)*
Top up or raise the spending limit. Chat is 0% until then. Then set a balance
alert; there was no signal that this happened.

**2. No ops signal for a dead brain.** *(fixed in this change)*
`/health` reported `status: ok` the entire time chat was 100% broken. It now
carries an `llm` block (`ok`, `lastFailureReason`, `consecutiveFailures`) so
this is visible without reading a chat reply.

**3. ~~Session data sits on ephemeral disk.~~** *(verified safe — 2026-09-10)*
Transcripts, resume codes, custom characters, and JSON accounts are files, not
Postgres, so a missing Railway volume at `/data` would wipe paying users' chats
on every redeploy. Tested empirically against production instead of trusting the
dashboard: six resume codes were minted across three different deploys
(`00bb201`, `7b5b4da`, `bf9c4fe`) and all six were redeemed after the later
redeploys. Every one returned HTTP 200 with its full 11-message transcript and
correct character binding, including sessions created two deploys earlier. The
volume is mounted and persisting.

Migrating sessions to Postgres is still worth doing (files do not survive a
service move or give us backups), but it is no longer a launch blocker.

### P1 — will embarrass us with real users

**4. No age gate.** `AgeFloor.tsx` is not a gate — it is a client-side text
rewriter that swaps the string "18+" to "21+" after hydration. Explicit content
is served to anyone who loads the URL, with no interstitial. This is a
compliance problem for adult processors and for the Phase 3 tube placement
plan. `LIVE-STATUS.md` claiming "Age floor 🟢 21+" was cosmetic.

**5. Memory silently forgets.** The window truncates at 20–80 messages with no
summarization (`session-memory.ts`: "No summarization or fact extraction"). A
long session drops early context permanently while we market memory.

**6. Pack 02/03 prompts are templates.** 42 of 50 characters share one of two
134-word prompts. Consistency and distinctiveness are the claimed edge; right
now that edge exists for 8 characters.

**7. Chat page UI defects.** *(banner half fixed in #107, verified live
2026-09-11; toast half still open)*

The "Sign in for alerts" banner rendered twice because there were two render
sites, not because `HintRail` was broken. `HintRail` correctly shows one child
at a time via `.hint-rail > * + * { display: none }`, but `app/chat/page.tsx`
rendered its own `PushEnableHint` in a `sticky top-0 z-30` strip on top of the
one `ChatApp` already rendered — two separate React subtrees, which CSS inside
one rail can never dedupe. The sticky copy was also the one pinned over the
avatar. #107 removes the page-level duplicate and gates the promo hints
(`PushEnableHint`, `InstallAppHint`, `SoftSupportHint`) on `!sessionActive`, so
only `NetworkOfflineBanner` and `SessionAuthBanner` can appear during a live
session. Measured on a 390x844 session: 2 banners and 74px of the 288px avatar
covered, down to 0 and 0. The banner still returns after the session ends.

**Still open:** the "Heat locked in" `SessionWinToast` overlaying the
character's opening message. Not touched in #107.

### P2 — blocks the Phase 2 revenue loop

**8. No durable analytics.** All counters are in-process and reset on every
redeploy (`metrics.ts`). There is no per-user event log and no third-party
analytics. **We cannot currently answer "how many sessions last week" or "what
is our conversion rate."** Phase 2 asks for conversion measurement; it must be
built, not enabled.

**9. `checkoutConfirms` double-counts.** Both the webhook and the return-page
confirm bump it, so the one conversion number we do have is inflated.

**10. Single-instance only.** Live sessions live in an in-process Map; a second
replica breaks WebSocket auth. We cannot scale horizontally without a shared
session store.

**11. Unauthenticated endpoints.** `GET /sessions/:id/prompt-preview` returns
the full assembled system prompt to anyone with a session id — that is the
prompt library, our actual IP. `GET /sessions/:id` and the LiveKit token
endpoint are also unauthenticated.

---

## Minimum viable paid experience — proposal

**Decision required from King Grok CEO + Gary.** This reverses the standing
"free chat never paywalls" promise, which is currently written into product
copy. It is the only way to answer Phase 2's "what does a user get for money."

Charge for **continuity and control**, not for access. Access is the demo; the
relationship is the product.

| | Free | Paid |
|--|------|------|
| Browse all 50 characters | yes | yes |
| Session length | capped daily message allowance | unlimited |
| **Cross-session memory** | off — she resets each time | **on — she remembers you** |
| Edge Pace mode | preview | full |
| Studio Forge custom characters | 1 | 40 |
| Transcript export / resume codes | no | yes |

The paywall lands **after the user has had a good session**, at the moment she
would otherwise forget them. That moment is already built — `SessionWinToast`
fires there today with a Day Pass CTA.

Keep both existing price points; add a real recurring subscription for
Supporter, since the 550-sub goal is a subscription goal and today's Supporter
is a 30-day one-time charge that silently lapses.

**This is worth zero until P0 is cleared.** A paywall on a product that returns
an error string is a refund pipeline.

---

## What is genuinely solid

Worth stating plainly, because the failure is loud and the foundation is not:

- Session lifecycle: create → WS chat → end → resume all work, verified live
- Resume codes work; a resumed session restored full 5-message history
- 200 avatar loops serve correctly with per-character fallback
- Stripe Checkout is correctly implemented with verified webhook signatures
- Accounts use scrypt passphrases and hashed bearer tokens
- Custom characters (Studio Forge) are real and reach the live chat path
- Edge Pace and the DNA tree genuinely alter the prompt, not just the UI

---

## Verification log

Measured against live production, not staging.

**Deploy `00bb201` (baseline, 22:36 UTC).** Chat worked but every turn was
rewritten: `chatConsistencyRewrites` 10/10 = 100%. Every reply cost two xAI
calls. Average full reply 10,710 ms. This is very likely a large share of why
the credits died.

**Deploy `7b5b4da` (#101 — LLM guardrail + real streaming, 23:09 UTC).** Vendor
errors no longer leak into dialogue or get written into transcripts, `/health`
carries an `llm` block, and replies stream token-by-token with the
`avatar_intent` JSON tail gated out of the visible text.

**Deploy `bf9c4fe` (#102 — drift detector fix, 23:30 UTC).** Two-character
smoke, 10 turns:

| | Before | After |
|--|--------|-------|
| `chatConsistencyRewrites` / `chatTurns` | 10 / 10 (100%) | **0 / 10 (0%)** |
| `chatLlmErrors` | 0 | 0 |
| Average full reply | 10,710 ms | **~5,880 ms** |
| Time to first text | n/a (no streaming) | ~3.5–4.0 s |

Time to first text is now provider time-to-first-token and will not improve
without a faster model; the win is that the user sees prose at ~3.5 s instead of
a spinner until ~10.7 s.

**Volume persistence (23:34 UTC).** 6/6 resume codes spanning three deploys
redeemed successfully with intact transcripts. See P0-3.

**Deploy `00b158f` (#106 — bigger character screens, 02:25 UTC).** The chat
avatar was capped at `max-h-36` while a session was live. Measured on a real
session at 390x844, the rail went from 366x144 to 366x288; desktop width went
from 288 to 384 (desktop height was never capped — `lg:self-stretch` already
stretched it). Composer stays fully on screen at 360x640 and 375x667.

**Deploy `8f69b70` (#107 — promo banner off the avatar, 03:09 UTC).** Push
banners during a live session went from 2 to 0, and avatar pixels covered from
74 to 0. 7/7 checks including the banner correctly returning after End. See
P1-7.

---

## Frozen per directive

2.0 empire / workforce / phase theater is frozen. Not touched in this change,
and not to be resumed unless it directly serves revenue or reliability.

---

*Honest status beats a green badge. Corrections belong here first.*
