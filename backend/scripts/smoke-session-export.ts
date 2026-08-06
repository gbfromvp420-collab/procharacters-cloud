/**
 * Smoke: session export never includes secrets.
 * Run: npx tsx scripts/smoke-session-export.ts
 */
import {
  buildAccountSessionsExport,
  buildSessionExport,
  SESSION_EXPORT_SCHEMA,
} from "../src/lib/memory/session-export.js";
import type { SessionRecord } from "../src/types/session.js";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const record: SessionRecord = {
  id: "11111111-2222-3333-4444-555555555555",
  characterId: "twink-default",
  promptVersion: "v1",
  promptSnapshot: {
    characterId: "twink-default",
    characterName: "Leo",
    promptVersion: "v1",
    systemPrompt: "SECRET SYSTEM PROMPT DO NOT LEAK",
    assembledAt: new Date().toISOString(),
  } as SessionRecord["promptSnapshot"],
  wsToken: "super-secret-ws-token-never-export",
  status: "active",
  memory: {
    messages: [
      {
        id: "m1",
        role: "user",
        content: "hey",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        role: "assistant",
        content: "hi there",
        createdAt: "2026-01-01T00:00:01.000Z",
      },
    ],
  },
  avatarState: {
    emotion: "idle",
    pose: "standing",
    action: "none",
    arousalLevel: 0.1,
    clothingState: "dressed",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:01:00.000Z",
  expiresAt: "2026-01-02T00:00:00.000Z",
  accountId: "acct-1",
  resumeCode: "ABCD1234",
};

const doc = buildSessionExport(record);
assert(doc.schema === SESSION_EXPORT_SCHEMA, "schema");
assert(doc.session.messageCount === 2, "count");
assert(doc.session.messages[1]?.content === "hi there", "msg");
assert(doc.session.characterName === "Leo", "name");

const raw = JSON.stringify(doc);
assert(!raw.includes("super-secret-ws-token"), "no wsToken");
assert(!raw.includes("SECRET SYSTEM PROMPT"), "no system prompt");
assert(!raw.includes("systemPrompt"), "no systemPrompt key");
assert(raw.includes("ABCD1234"), "resume code kept for owner");

const bulk = buildAccountSessionsExport({
  accountId: "acct-1",
  handle: "gary",
  records: [record],
});
assert(bulk.sessionCount === 1, "bulk count");
assert(bulk.totalMessages === 2, "bulk msgs");
assert(!JSON.stringify(bulk).includes("super-secret"), "bulk no token");

console.log("smoke-session-export: all checks passed");
console.log({
  messages: doc.session.messageCount,
  keys: Object.keys(doc.session),
});
