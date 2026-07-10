/**
 * Smoke: parse + sanitize session import payloads.
 * Run: npx tsx scripts/smoke-session-import.ts
 */
import {
  ACCOUNT_SESSIONS_EXPORT_SCHEMA,
  isBulkAccountExport,
  parseImportDocument,
  parseImportDocumentAll,
  SESSION_EXPORT_SCHEMA,
} from "../src/lib/memory/session-export.js";
import { resolveImportCharacterId } from "../src/services/session-manager.js";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const single = {
  schema: SESSION_EXPORT_SCHEMA,
  exportedAt: "2026-01-01T00:00:00.000Z",
  session: {
    sessionId: "old-id",
    characterId: "twink-default",
    characterName: "Leo",
    promptVersion: "v1",
    status: "ended",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    expiresAt: "2026-01-02T00:00:00.000Z",
    messageCount: 2,
    messages: [
      { id: "m1", role: "user", content: "hey", createdAt: "2026-01-01T00:00:00.000Z" },
      {
        id: "m2",
        role: "assistant",
        content: "hi there",
        createdAt: "2026-01-01T00:00:01.000Z",
      },
    ],
  },
};

const ok = parseImportDocument(single);
assert(ok.ok && ok.session.messages.length === 2, "single export");
assert(ok.ok && ok.session.characterId === "twink-default", "character");

const bulk = {
  schema: ACCOUNT_SESSIONS_EXPORT_SCHEMA,
  exportedAt: "2026-01-01T00:00:00.000Z",
  accountId: "a1",
  sessionCount: 2,
  totalMessages: 3,
  sessions: [
    single.session,
    {
      ...single.session,
      sessionId: "other",
      messages: [
        {
          id: "x1",
          role: "user",
          content: "second chat",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
  ],
};

const bulk0 = parseImportDocument(bulk);
assert(bulk0.ok && bulk0.session.messages[1]?.content === "hi there", "bulk default 0");
const bulk1 = parseImportDocument(bulk, { sessionIndex: 1 });
assert(bulk1.ok && bulk1.session.messages[0]?.content === "second chat", "bulk index 1");
assert(bulk1.ok && bulk1.bulkIndex === 1 && bulk1.bulkTotal === 2, "bulk meta");

const bare = parseImportDocument({
  characterId: "female-default",
  messages: [{ role: "user", content: "yo", createdAt: "2026-01-01T00:00:00.000Z" }],
});
assert(bare.ok && bare.session.characterId === "female-default", "bare session");

const bad = parseImportDocument({ schema: "nope" });
assert(!bad.ok && bad.code === "BAD_SCHEMA", "bad schema");

const empty = parseImportDocument({
  schema: SESSION_EXPORT_SCHEMA,
  session: { characterId: "twink-default", messages: [] },
});
assert(!empty.ok && empty.code === "EMPTY", "empty messages");

const wrapped = parseImportDocument({ document: single });
assert(wrapped.ok, "document wrapper");

// drop junk roles
const junk = parseImportDocument({
  characterId: "twink-default",
  messages: [
    { role: "system", content: "nope" },
    { role: "user", content: "ok" },
    { role: "assistant", content: "" },
  ],
});
assert(junk.ok && junk.session.messages.length === 1, "sanitize roles");
assert(junk.ok && junk.dropped === 2, "dropped count");

assert(isBulkAccountExport(bulk) === true, "is bulk");
assert(isBulkAccountExport(single) === false, "not bulk single");

const all = parseImportDocumentAll(bulk);
assert(all.ok && all.entries.length === 2, "parse all entries");
assert(all.ok && all.bulkTotal === 2, "bulk total");
assert(all.ok && all.entries[1]?.session.messages[0]?.content === "second chat", "all order");

const allSingle = parseImportDocumentAll(single);
assert(allSingle.ok && allSingle.entries.length === 1, "all of single");

// Character remap resolution
const live = resolveImportCharacterId("twink-default");
assert(live.characterId === "twink-default" && !live.remappedFrom, "live pass-through");

const mapped = resolveImportCharacterId("custom-gone", {
  characterMap: { "custom-gone": "female-default" },
});
assert(mapped.characterId === "female-default" && mapped.remappedFrom === "custom-gone", "map");

const fallback = resolveImportCharacterId("custom-missing", {
  fallbackCharacterId: "twink-default",
});
assert(
  fallback.characterId === "twink-default" && fallback.remappedFrom === "custom-missing",
  "fallback",
);

let threw = false;
try {
  resolveImportCharacterId("custom-orphan");
} catch {
  threw = true;
}
assert(threw, "missing without map/fallback throws");

console.log("smoke-session-import: all checks passed");
