# Phase 1 — Status audit (evidence-based)

**Date:** 2026-09-10 (Stage 1 close-out notes 2026-09-13 — see [STAGE-1.md](./STAGE-1.md))
**Deploy audited:** `00bb201` (matches `main` HEAD at audit time; later `4ada4b0` + this PR)
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
this is visible without reading a chat reply. Follow-up: the same failures now
page `ERROR_WEBHOOK_URL` (**BRAIN DOWN** / **BRAIN BACK**) so nobody has to be
reading `/health` — see [`ops-error-webhook.md`](./ops-error-webhook.md).

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

**4. ~~No age gate.~~** *(closed #103 — hard interstitial)*
`AgeFloor.tsx` is a blocking 21+ dialog (`pc_age_verified_21`, 30-day TTL).
Leave redirects off-site. Residual 18+ chrome is still rewritten. This is
**self-attestation**, not identity verification: disabling JS or fetching
HTML/MP4 URLs still returns content. Real verification would have to gate the
HTML response server-side — Stage 2 / later, not a Stage 1 reopen.

**5. ~~Memory silently forgets.~~** *(closed — window roll-off)*
Overflow now folds dropped turns into `sessionNotes` (heuristic Scene lock +
user-beat snippets) before the live window slices. No extra xAI call. Opt-in
cross-session dossiers were already separate. Guard: `npm run test:memory-window`.

**6. Pack 02/03 prompts are templates.** *(pilot started 2026-09-11 — Jenny
v1.1.0; 41 of 50 still thin)*

42 of 50 characters shared one of two 134-word prompts. Consistency and
distinctiveness are the claimed edge; that edge existed for 8 characters.

Jenny is the pilot: `jenny/v1.1.0/prompt.md` is 663 words in the Pack 01
structure (mind lock vs Mila / Luna / Vesper, ivory crotchless as signature,
hover-finger as the signature action, voice bank, anti-loop and resume
rehydration). v1.0.0 stays on disk. If she holds voice for four turns plus a
resume in a live smoke, the remaining featured thin characters follow, then the
rest in batches. The continuity paywall stays behind this — selling "she
remembers you and she's distinctly her" while the second half is false is a
refund pipeline.

Bumping a version exposed two bugs that would have made the bump a no-op or
worse, both fixed in the same PR:

- `resolvePromptPath` returned the manifest path whenever the file existed, so
  the requested version was ignored. Pinning `jenny@v1.0.0` returned the v1.1.0
  text under a v1.0.0 label. Every multi-version character had this — 12 pin
  misses across 9 characters with the fix reverted.
- `createSession` and session import substituted the global
  `DEFAULT_PROMPT_VERSION` (`v1.3.0`) for a missing pin instead of the
  character's catalog `defaultVersion`. Production sessions for Jenny reported
  `promptVersion: v1.3.0`, a version she has never had. Fixing only the loader
  would have silently downgraded Cruz and Vesper to the `v1.3.0` folders they
  still carry. Sessions now fall through to the catalog.

`npm run check:prompts` (backend) now guards all three: default resolution,
catalog/manifest agreement, and pin reachability, and prints the thin count.

**Jenny smoke result (prod `343b63a`, two runs, 23/24 each):** voice held —
zero rival lexicon across 10 replies, hover gap narrowed every turn (an inch →
half → quarter → a hair's breadth → "a fraction closer" after resume), resume
picked up mid-float with no seed replay, Cruz and Vesper stayed on v1.3.1. The
one miss was the same in both runs: she used the planted name in 10/10 replies
but never brought back the planted gym detail. Run 2 also opened 4 of 5 replies
with "hey marcus…". A Cruz control run showed the detail miss is model-wide,
not Jenny's.

**Featured batch (this change):** Jenny v1.1.1 adds two directives — keep what
he tells you about himself and bring it back unprompted; never start two
replies the same way. The seven remaining featured thin tiles get v1.1.0 at the
same depth with the same two directives baked in, each with an explicit
mechanic so they can't collapse into one another: Sarah (black silk,
inch-ledger), Emma (cream, hips locked), Olivia (ivory silk + gold, one
movement per reply), Peter (white sheer, one-stroke-stop), Justin (navy,
edge-and-smile), Liam (silver, staged twitch-hold), Noah (blush, apologetic
stop). Every seed matches its catalog `openingMessage` byte for byte. Deep
count 9 → 16 of 50; every featured tile is now deep; 34 thin remain, none
featured.

`npm run smoke:voice -- --character <id>` (backend) is the same voice-lock run
made repeatable: create at catalog version, four turns scored for own lexicon
and rival tells, plant + recall, end → resume continuity, opener variety,
brain-failure fallbacks flagged separately, Cruz/Vesper as controls. Validated
on prod against Cruz before the batch shipped — that run also caught one xAI
timeout served through the in-character fallback (`/health` `llm.totalFailures:
1`), which is the P0 error guard working and a reminder the alert is still not
wired.

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

The "Heat locked in" `SessionWinToast` half was closed separately in #109. It
was wrapped in an `absolute inset-x-3 top-2 z-10` div inside the scrolling
transcript, so for the 4.5s it is visible it painted over the character's first
message — measured at 141px of a 154px bubble, which made the opening line
unreadable. Both wrappers are gone and the toast sits in normal flow;
`SessionWinToast` already returns `null` when hidden, so in-flow leaves no gap.
Overlap is now 0px.

**P1-7 is fully closed.**

### P2 — blocks the Phase 2 revenue loop

**8. No durable analytics.** All counters are in-process and reset on every
redeploy (`metrics.ts`). There is no per-user event log and no third-party
analytics. **We cannot currently answer "how many sessions last week" or "what
is our conversion rate."** Phase 2 asks for conversion measurement; it must be
built, not enabled.

**9. ~~`checkoutConfirms` double-counts.~~** *(closed)*
`grantAccountPlan` now returns `newlyGranted`. Webhook and `/billing/confirm`
bump the counter only on the first grant of that Checkout Session.

**10. Single-instance only.** Live sessions live in an in-process Map; a second
replica breaks WebSocket auth. We cannot scale horizontally without a shared
session store.

**11. Unauthenticated endpoints.** *(prompt-preview closed)*
`GET /sessions/:id/prompt-preview` now requires `?token=` (401 without). The
body was already memory + last-4 dialogue only — it does not return the
assembled system/character prompt. `GET /sessions/:id` metadata and the
LiveKit token route remain unauthenticated (Stage 2; do not block Stage 1).

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

**Deploy `17a1644` (#109 — win toast in flow, 03:48 UTC).** The toast covered
141px of the 154px opening message; now 0px, and it is no longer lifted out of
flow. 3/3 checks. Because the toast lives for only ~4.5s once `messageCount`
reaches 3, this was caught by polling a real production session every 150ms
rather than by eye. Re-ran the #106 and #107 checks on the same deploy as a
regression guard: avatar still 366x288 active on mobile and 384 wide on
desktop, banner lifecycle still 7/7.

---

## Frozen per directive

2.0 empire / workforce / phase theater is frozen. Not touched in this change,
and not to be resumed unless it directly serves revenue or reliability.

---

*Honest status beats a green badge. Corrections belong here first.*
