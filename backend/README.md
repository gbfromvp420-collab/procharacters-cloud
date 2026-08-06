# Procharacters.cloud Backend (v2)

Live session API for real-time chat. Built on the v1 prompt library and character registry.

## Quick start

```powershell
cd backend
copy .env.example .env
npm install
npm run dev
```

Server runs at `http://localhost:3001`.

## API (v2.0 scaffold)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1/characters` | List active characters + prompt versions |
| POST | `/api/v1/sessions` | Create live session |
| GET | `/api/v1/sessions/:id` | Session metadata |
| POST | `/api/v1/sessions/:id/end` | End session |
| WS | `/ws/sessions/:id?token=...` | Real-time chat |

### Create session

```bash
curl -X POST http://localhost:3001/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d "{\"characterId\": \"twink-default\"}"
```

### WebSocket events

**Client → server:** `user_message`, `ping`, `end_session`

**Server → client:** `session_ready`, `assistant_stream`, `assistant_complete`, `avatar_update`, `pong`, `session_ended`, `error`

## Project layout

```
backend/src/
├── config/          # env + constants
├── lib/
│   ├── characters/  # registry + model.json loading
│   └── prompts/     # manifest, v1.3.0 prompts, assembler
├── routes/          # HTTP handlers
├── services/        # session, memory, chat orchestration
├── types/           # shared TypeScript types
└── ws/              # WebSocket handler
```

## Live prompt injection (`src/lib/live/`)

Loads v1.3.0 character prompts from the existing library and injects them into every live turn.

### Supported characters

| ID | Prompt version | Library path |
|----|----------------|--------------|
| `twink-default` | v1.3.0 | `prompts/library/naughty-syntax/twink-default/v1.3.0/prompt.md` |
| `female-default` | v1.3.0 | `prompts/library/naughty-syntax/female-default/v1.3.0/prompt.md` |

### How injection works

1. **Session start** — `createPromptSnapshot()` pins the character prompt + system-core at that version (immune to later manifest edits).
2. **Each chat turn** — `LivePromptInjector.injectTurn()` builds:
   - **Platform** — `system-core` (rules, brand voice, live session rules)
   - **Character** — pinned v1.3.0 prompt body
   - **Consistency** — trait checklist + `model.json` appearance anchor
   - **Memory** — rolling session summary
   - **Live format** — `avatar_intent` JSON response instructions
3. **Conversation** — user/assistant messages kept separate in the `messages` array (LLM-ready).
4. **Consistency guard** — soft trait check; optional retry if LLM drifts off-character.

### Session memory (`src/lib/memory/`)

Lightweight v2 memory — three files only:

| File | Purpose |
|------|---------|
| `types.ts` | `MemoryMessage`, `SessionMemoryData`, `RecentContext` |
| `session-memory.ts` | Add messages, get recent context, clear |
| `prompt-formatter.ts` | Format memory block for system prompt + LLM message array |

```bash
curl http://localhost:3001/api/v1/sessions/<sessionId>/memory
curl http://localhost:3001/api/v1/sessions/<sessionId>/prompt-preview
```

### Memory smoke test (no frontend)

Terminal 1 — start the API:

```powershell
cd backend
npm install
npm run dev
```

Terminal 2 — run the WebSocket memory test:

```powershell
cd backend
npm run test:memory
npm run test:memory -- --character female-default
```

The script creates a session, sends 3 test messages over WebSocket, and prints memory state after each turn.

### Grok / xAI live chat

1. Copy `.env.example` → `.env` and set `XAI_API_KEY` from [console.x.ai](https://console.x.ai/)
2. Restart `npm run dev` — log should show `Grok/xAI chat enabled`
3. Run `npm run test:memory` — replies should be real in-character text (not stubs)

## v1 integration

- Prompts indexed in `prompts/manifest.json` (system + characters)
- Character models from `characters/registry.json` + `model.json`
- Library layout: `prompts/library/<brand>/<name>/<version>/prompt.md`

## Next steps

1. Wire xAI Grok streaming in `chat-orchestrator.ts`
2. Add Redis session store interface
3. Add PostgreSQL persistence on session end
4. LiveKit token endpoint for video track