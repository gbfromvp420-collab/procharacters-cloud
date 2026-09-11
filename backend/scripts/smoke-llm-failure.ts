/**
 * Procharacters.cloud — LLM failure-path smoke test
 *
 * Regression guard for the incident where a dead xAI account made every
 * character in production reply with:
 *   *[System: xAI credits / spending limit hit — top up or raise limit at console.x.ai]*
 *
 * Boots the real app against a stub xAI that returns the real 403 credit error,
 * drives a real WebSocket session, then asserts:
 *   1. The user-facing reply leaks no vendor / billing / key detail.
 *   2. The failure is NOT persisted as character dialogue in the transcript.
 *   3. The user's own message survives the failed turn.
 *   4. /health reports llm.ok=false with a coarse reason for ops.
 *   5. Once the provider recovers, llm.ok flips back and turns persist normally.
 *   6. The outage pages the ops webhook exactly once (BRAIN DOWN), repeated
 *      failures do not re-page, recovery pages once more (BRAIN BACK), and no
 *      alert carries the provider's raw billing text.
 *
 * Usage:
 *   npm run test:llm-failure
 */

import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Verbatim shape of the xAI 403 that took production chat down. */
const CREDIT_ERROR_BODY = JSON.stringify({
  error: {
    message:
      "Your team has either used all available credits or reached its monthly spending limit. " +
      "Please purchase more credits or raise your limit at console.x.ai",
    code: "forbidden",
  },
});

const GOOD_REPLY_TEXT =
  "mmm… come sit closer. i'm not going anywhere.\n" +
  '{"avatar_intent":{"emotion":"teasing","arousalLevel":0.4}}';

const GOOD_REPLY_BODY = JSON.stringify({
  choices: [{ message: { content: GOOD_REPLY_TEXT }, finish_reason: "stop" }],
});

/** Strings that must never reach an end user's chat transcript. */
const LEAK_PATTERNS = [
  "xai",
  "console.x.ai",
  "credit",
  "spending limit",
  "xai_api_key",
  ".env",
  "[system:",
  "api key",
];

type StubMode = "credit_error" | "ok";

let stubMode: StubMode = "credit_error";
let stubCalls = 0;

/** Every JSON body posted to the fake ERROR_WEBHOOK_URL, in order. */
const hookPosts: Array<Record<string, unknown>> = [];

/** Raw provider phrasing that must never leave the process, even to ops. */
const PROVIDER_RAW_PATTERNS = ["your team has", "purchase more credits", "console.x.ai"];

function startStubWebhook(): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const c of req) body += c;
      try {
        hookPosts.push(JSON.parse(body) as Record<string, unknown>);
      } catch {
        hookPosts.push({ raw: body });
      }
      res.writeHead(204);
      res.end();
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}/hook` });
    });
  });
}

/** Alerts are fire-and-forget from the chat turn; give the webhook a moment to land. */
async function waitForHookCount(n: number, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (hookPosts.length < n && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

function hookText(post: Record<string, unknown>): string {
  return String(post.content ?? post.text ?? post.message ?? "").toLowerCase();
}

function startStubXai(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      stubCalls += 1;

      let body = "";
      for await (const c of req) body += c;
      const wantsStream = JSON.parse(body || "{}").stream === true;

      if (stubMode === "credit_error") {
        // Error responses are plain JSON even when SSE was requested.
        res.writeHead(403, { "content-type": "application/json" });
        res.end(CREDIT_ERROR_BODY);
        return;
      }

      if (wantsStream) {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
        });
        for (const piece of GOOD_REPLY_TEXT.match(/\S+\s*/g) ?? []) {
          res.write(
            `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`,
          );
        }
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(GOOD_REPLY_BODY);
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}/v1` });
    });
  });
}

const failures: string[] = [];
const passes: string[] = [];

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passes.push(label);
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

interface ChatResult {
  reply: string;
  history: Array<{ role: string; content: string }>;
}

/** Open a session socket, send one message, return the reply + server history. */
function chatOnce(wsUrl: string, message: string): Promise<ChatResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let history: Array<{ role: string; content: string }> = [];
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("timed out waiting for assistant_complete"));
    }, 20_000);

    ws.onerror = () => {
      /* close handler reports */
    };
    ws.onmessage = (raw) => {
      const msg = JSON.parse(String(raw.data));
      if (msg.type === "session_ready") {
        history = msg.messages ?? [];
        ws.send(JSON.stringify({ type: "user_message", content: message }));
      } else if (msg.type === "assistant_complete") {
        clearTimeout(timer);
        ws.close();
        resolve({ reply: msg.content ?? "", history });
      } else if (msg.type === "error") {
        clearTimeout(timer);
        ws.close();
        reject(new Error(`ws error event: ${JSON.stringify(msg)}`));
      }
    };
  });
}

/** Reconnect to read back exactly what the server persisted. */
function readHistory(wsUrl: string): Promise<Array<{ role: string; content: string }>> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("timed out waiting for session_ready"));
    }, 20_000);
    ws.onmessage = (raw) => {
      const msg = JSON.parse(String(raw.data));
      if (msg.type === "session_ready") {
        clearTimeout(timer);
        ws.close();
        resolve(msg.messages ?? []);
      }
    };
    ws.onerror = () => {
      /* timeout handles */
    };
  });
}

async function main() {
  console.log("=== LLM failure-path smoke ===\n");

  const stub = await startStubXai();
  const hook = await startStubWebhook();

  // Must be set before importing app/env — env.ts parses process.env at import.
  const dataDir = mkdtempSync(join(tmpdir(), "pcc-llm-smoke-"));
  process.env.NODE_ENV = "test";
  process.env.ACCOUNTS_PROVIDER = "json";
  process.env.XAI_API_KEY = "test-key-not-a-placeholder-000";
  process.env.XAI_BASE_URL = stub.baseUrl;
  process.env.ERROR_WEBHOOK_URL = hook.url;
  delete process.env.ERROR_ALERT_EMAIL;
  process.env.SESSIONS_PATH = join(dataDir, "sessions");
  process.env.ACCOUNTS_PATH = join(dataDir, "accounts.json");
  process.env.CUSTOM_CHARACTERS_PATH = join(dataDir, "custom-characters.json");
  delete process.env.DATABASE_URL;
  delete process.env.LIVEKIT_URL;

  const { buildApp } = await import("../src/app.js");
  const app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  try {
    // --- Provider is down (403 credits) ---
    console.log("[1] provider returning 403 credits/spending-limit\n");

    const createRes = await fetch(`${base}/api/v1/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId: "twink-default" }),
    });
    const session = (await createRes.json()) as { sessionId: string; wsUrl: string };
    check("session create returns 201", createRes.status === 201, `got ${createRes.status}`);

    const wsUrl = session.wsUrl.replace(/^ws:\/\/[^/]+/, `ws://127.0.0.1:${port}`);
    const userLine = "hey, my name is Marcus — remember that";
    const failed = await chatOnce(wsUrl, userLine);

    console.log(`\n  reply shown to user: ${JSON.stringify(failed.reply)}\n`);

    const lowerReply = failed.reply.toLowerCase();
    const leaked = LEAK_PATTERNS.filter((p) => lowerReply.includes(p));
    check("reply leaks no vendor/billing/key detail", leaked.length === 0, `leaked: ${leaked.join(", ")}`);
    check("reply is non-empty", failed.reply.trim().length > 0);
    check("provider was actually called", stubCalls > 0, `calls=${stubCalls}`);

    const afterFail = await readHistory(wsUrl);
    const assistantLines = afterFail.filter((m) => m.role === "assistant");
    const pollutedAssistant = assistantLines.filter((m) =>
      LEAK_PATTERNS.some((p) => m.content.toLowerCase().includes(p)),
    );
    check(
      "failure is not persisted as character dialogue",
      pollutedAssistant.length === 0,
      `polluted: ${JSON.stringify(pollutedAssistant.map((m) => m.content))}`,
    );
    check(
      "failure reply is not stored in transcript at all",
      !afterFail.some((m) => m.content === failed.reply),
    );
    check(
      "user's message survives the failed turn",
      afterFail.some((m) => m.role === "user" && m.content === userLine),
      `history: ${JSON.stringify(afterFail.map((m) => `${m.role}:${m.content.slice(0, 40)}`))}`,
    );

    const downHealth = (await (await fetch(`${base}/health`)).json()) as {
      llm: {
        ok: boolean;
        configured: boolean;
        lastFailureReason: string | null;
        consecutiveFailures: number;
        pagedReason: string | null;
      };
    };
    console.log(`\n  /health llm: ${JSON.stringify(downHealth.llm)}\n`);
    check("health reports llm.ok=false", downHealth.llm.ok === false);
    check("health reports llm.configured=true", downHealth.llm.configured === true);
    check(
      "health classifies reason as credits_or_spending_limit",
      downHealth.llm.lastFailureReason === "credits_or_spending_limit",
      `got ${downHealth.llm.lastFailureReason}`,
    );
    check("health counts consecutive failures", downHealth.llm.consecutiveFailures >= 1);

    // --- Outage pages ops exactly once ---
    console.log("[1b] outage pages the ops webhook\n");
    await waitForHookCount(1);
    check("brain-down alert posted to ERROR_WEBHOOK_URL", hookPosts.length === 1, `posts=${hookPosts.length}`);
    const down = hookPosts[0] ?? {};
    console.log(`  alert: ${JSON.stringify(down.content ?? down.text)}\n`);
    check("alert is named LlmBrainDown", down.name === "LlmBrainDown", `name=${String(down.name)}`);
    check("alert says BRAIN DOWN", hookText(down).includes("brain down"));
    check(
      "alert carries the coarse reason",
      hookText(down).includes("credits_or_spending_limit"),
    );
    check("alert carries the provider status", down.statusCode === 403, `statusCode=${String(down.statusCode)}`);
    const rawLeaks = PROVIDER_RAW_PATTERNS.filter((p) => JSON.stringify(down).toLowerCase().includes(p));
    check("alert carries no raw provider billing text", rawLeaks.length === 0, `leaked: ${rawLeaks.join(", ")}`);
    check(
      "health exposes the paged reason",
      downHealth.llm.pagedReason === "credits_or_spending_limit",
      `got ${String(downHealth.llm.pagedReason)}`,
    );

    await chatOnce(wsUrl, "still nothing?");
    await new Promise((r) => setTimeout(r, 300));
    check("second failed turn does not re-page", hookPosts.length === 1, `posts=${hookPosts.length}`);

    // --- Provider recovers ---
    console.log("[2] provider recovered (200 OK)\n");
    stubMode = "ok";

    const recovered = await chatOnce(wsUrl, "you still there?");
    console.log(`  reply shown to user: ${JSON.stringify(recovered.reply.slice(0, 80))}\n`);
    check("recovered reply is real character text", recovered.reply.includes("come sit closer"));

    const afterOk = await readHistory(wsUrl);
    check(
      "recovered turn IS persisted as character dialogue",
      afterOk.some((m) => m.role === "assistant" && m.content.includes("come sit closer")),
    );

    const upHealth = (await (await fetch(`${base}/health`)).json()) as {
      llm: { ok: boolean; consecutiveFailures: number; pagedReason: string | null };
    };
    console.log(`  /health llm: ${JSON.stringify(upHealth.llm)}\n`);
    check("health recovers to llm.ok=true", upHealth.llm.ok === true);
    check("consecutive failures reset to 0", upHealth.llm.consecutiveFailures === 0);
    check("health clears the paged reason", upHealth.llm.pagedReason === null);

    // --- Recovery pages once ---
    console.log("[2b] recovery pages the ops webhook\n");
    await waitForHookCount(2);
    check("exactly one more alert on recovery", hookPosts.length === 2, `posts=${hookPosts.length}`);
    const back = hookPosts[1] ?? {};
    console.log(`  alert: ${JSON.stringify(back.content ?? back.text)}\n`);
    check("recovery is named LlmBrainRecovered", back.name === "LlmBrainRecovered", `name=${String(back.name)}`);
    check("recovery says BRAIN BACK", hookText(back).includes("brain back"));
    check("recovery is a calm notice, not a red alert", back.level === "info", `level=${String(back.level)}`);
  } finally {
    await app.close();
    stub.server.close();
    hook.server.close();
  }

  console.log(`\n=== ${passes.length} passed, ${failures.length} failed ===`);
  if (failures.length > 0) {
    failures.forEach((f) => console.log(`  FAILED: ${f}`));
    process.exit(1);
  }
  console.log("LLM failure path is safe for a paying stranger.");
  process.exit(0);
}

void main().catch((error) => {
  console.error("smoke crashed:", error);
  process.exit(1);
});
