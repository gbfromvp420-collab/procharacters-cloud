# Procharacters.cloud — v2 Planning

**Status:** Draft (Started June 25, 2026)  
**Goal:** Define the scope, features, and technical direction for v2 — the first version with real-time live chat + video capabilities.

---

## 1. Vision & Goals for v2

### Primary Vision
Turn Procharacters.cloud from a prompt/character foundation into a **live, interactive NSFW AI experience** where users can have real-time video + chat sessions with high-quality, consistent characters (starting with Naughty Syntax models).

### Key Goals for v2
- Deliver a working live video + text chat experience
- Maintain strong character consistency using our refined prompts (v1.2.0+)
- Support both default Naughty Syntax models and user-created custom characters
- Keep the experience uncensored, high-quality, and on-brand
- Create a foundation that can scale in future versions

---

## 2. Core Features (Live Experience)

### Must-Have for v2
- Real-time text chat with character
- Basic live video/avatar streaming (character reacting in real time)
- Session memory (character remembers context within a session)
- Easy switching between default models (Twink Default + Female Default)
- Ability for users to create and save simple custom characters

### Nice-to-Have (v2.1+)
- Voice input/output
- More advanced emotional/reactive video behavior
- Multi-character sessions
- Persistent long-term memory across sessions

---

## 3. Technical Considerations

### Recommended Direction
- Use a modern stack that supports low-latency real-time communication
- Separate concerns: Frontend (chat + video UI), Backend (session management), Model Layer (character logic + generation)

### Key Technical Areas to Decide
- **Frontend:** Web app (React/Next.js) or desktop app?
- **Real-time Communication:** WebRTC, WebSockets, or a service like LiveKit / Daily.co?
- **Character Logic:** How do we keep the character “in character” during live sessions? (Using our prompt system + memory layer)
- **Media Generation:** How do we handle real-time or near real-time video/image responses?
- **Infrastructure:** Self-hosted vs managed services for video streaming

### Performance Targets
- Chat response latency under 2–3 seconds
- Video/avatar updates as smooth as possible
- Support for multiple concurrent sessions (start small)

---

## 4. Phased Approach

### v2.0 (MVP)
- Basic live text chat with one default character
- Simple video/avatar display
- Session-based memory only
- One default model active

### v2.1
- Add second default model + model switching
- Basic custom character creation
- Improved response quality and consistency

### v2.2+
- Voice features
- Better reactive video behavior
- Persistent memory
- Multi-character sessions

---

## 5. Open Questions & Risks

- What is the best technical approach for real-time video/avatar generation?
- How do we balance quality vs latency?
- What happens when the character “breaks” during a live session?
- How do we handle moderation / safety while staying uncensored?
- Cost of running live sessions at scale?

---

## 6. Next Steps After v2 Planning

- Finalize tech stack decisions
- Build a very small technical prototype / proof of concept
- Test character consistency in live sessions
- Define user onboarding flow for v2

---

*This document will evolve as we learn more. Update it regularly.*