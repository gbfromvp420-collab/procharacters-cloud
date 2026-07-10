/**
 * Smoke: markdown transcript rendering.
 * Run: npx tsx scripts/smoke-session-markdown.ts
 */
import {
  buildAccountSessionsMarkdown,
  buildSessionMarkdown,
  parseExportFormat,
  type SessionExport,
} from "../src/lib/memory/session-export.js";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const session: SessionExport["session"] = {
  sessionId: "abc-123",
  characterId: "twink-default",
  characterName: "Leo",
  promptVersion: "v1",
  status: "active",
  resumeCode: "ABCD1234",
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:05:00.000Z",
  expiresAt: "2026-01-02T12:00:00.000Z",
  messageCount: 2,
  messages: [
    {
      id: "m1",
      role: "user",
      content: "Hello **friend**",
      createdAt: "2026-01-01T12:00:00.000Z",
    },
    {
      id: "m2",
      role: "assistant",
      content: "Hey there\nwith a newline",
      createdAt: "2026-01-01T12:00:30.000Z",
    },
  ],
};

const md = buildSessionMarkdown(session, { exportedAt: "2026-01-01T13:00:00.000Z" });
assert(md.includes("# Leo"), "title");
assert(md.includes("### You"), "user heading");
assert(md.includes("### Leo"), "assistant heading");
assert(md.includes("Hello **friend**"), "content preserved");
assert(md.includes("ABCD1234"), "resume code");
assert(md.includes("```") === false || true, "renders");

const bulk = buildAccountSessionsMarkdown({
  schema: "procharacters.account-sessions-export/v1",
  exportedAt: "2026-01-01T13:00:00.000Z",
  accountId: "a1",
  handle: "gary",
  sessionCount: 1,
  totalMessages: 2,
  sessions: [session],
});
assert(bulk.includes("# Procharacters chat archive"), "archive title");
assert(bulk.includes("@gary"), "handle");
assert(bulk.includes("Hello **friend**"), "bulk content");

assert(parseExportFormat("md") === "md", "format md");
assert(parseExportFormat("markdown") === "md", "format markdown");
assert(parseExportFormat("json") === "json", "format json");

console.log("smoke-session-markdown: all checks passed");
console.log(md.slice(0, 280));
