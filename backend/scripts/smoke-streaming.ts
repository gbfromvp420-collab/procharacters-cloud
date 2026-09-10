/**
 * Procharacters.cloud — token streaming smoke test
 *
 * Before this change the backend called xAI with `stream: false`, waited for
 * the whole reply (measured at 10–15s on prod), then split the finished blob
 * on spaces to fake a stream. Time-to-first-text equalled full reply time, so
 * the user watched a typing indicator with zero text for the entire wait.
 *
 * Boots the real app against a stub xAI that emits SSE deltas on a timer,
 * drives a real WebSocket session, and asserts:
 *   1. First visible text arrives long before the reply finishes.
 *   2. The trailing avatar_intent JSON never reaches the user.
 *   3. assistant_complete carries the parsed prose, and the avatar intent
 *      from that JSON was still applied.
 *   4. Streamed chunks and the final message share one id (no double bubble).
 *   5. The stored transcript holds clean prose, not the raw blob.
 *   6. XAI_STREAMING=false falls back to the old behaviour.
 *
 * Usage:
 *   npm run test:streaming              # streaming on
 *   XAI_STREAMING=false npm run test:streaming
 */

import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STREAMING = process.env.XAI_STREAMING !== "false";

/** Prose the character "says", then the avatar_intent block Grok appends. */
const PROSE =
  "mmm, come here. i'm not going anywhere yet — watch how slow i can go " +
  "when you ask me nicely like that.";
const TAIL = '\n```json\n{"avatar_intent":{"emotion":"teasing","arousal_level":0.62}}\n```';

const DELTA_DELAY_MS = 60;

function startStubXai(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const c of req) body += c;
      const streamed = JSON.parse(body || "{}").stream === true;

      if (!streamed) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: PROSE + TAIL }, finish_reason: "stop" }],
          }),
        );
        return;
      }

      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      // Emit prose word by word, then the JSON tail, on a timer.
      const pieces = [
        ...(PROSE.match(/\S+\s*/g) ?? []),
        ...(TAIL.match(/[\s\S]{1,12}/g) ?? []),
      ];
      for (const piece of pieces) {
        await new Promise((r) => setTimeout(r, DELTA_DELAY_MS));
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}/v1` });
    });
  });
}

const failures: string[] = [];
const passes: string[] = [];

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    passes.push(label);
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

interface TurnObservation {
  firstTextMs: number;
  completeMs: number;
  chunkCount: number;
  streamedText: string;
  finalContent: string;
  streamIds: Set<string>;
  completeId: string;
  avatarIntent: Record<string, unknown> | undefined;
}

function runTurn(wsUrl: string, message: string): Promise<TurnObservation> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let sentAt = 0;
    let firstTextAt = 0;
    let streamedText = "";
    let chunkCount = 0;
    const streamIds = new Set<string>();

    const guard = setTimeout(() => {
      ws.close();
      reject(new Error("timed out"));
    }, 30_000);

    ws.onmessage = (raw) => {
      const msg = JSON.parse(String(raw.data));
      if (msg.type === "session_ready") {
        sentAt = Date.now();
        ws.send(JSON.stringify({ type: "user_message", content: message }));
      } else if (msg.type === "assistant_stream") {
        if (!firstTextAt) firstTextAt = Date.now();
        chunkCount += 1;
        streamedText += msg.chunk ?? "";
        streamIds.add(msg.messageId);
      } else if (msg.type === "assistant_complete") {
        clearTimeout(guard);
        const out: TurnObservation = {
          firstTextMs: firstTextAt - sentAt,
          completeMs: Date.now() - sentAt,
          chunkCount,
          streamedText,
          finalContent: msg.content ?? "",
          streamIds,
          completeId: msg.messageId,
          avatarIntent: msg.avatarIntent,
        };
        ws.close();
        resolve(out);
      }
    };
    ws.onerror = () => {};
  });
}

function readHistory(wsUrl: string): Promise<Array<{ role: string; content: string; id: string }>> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const guard = setTimeout(() => {
      ws.close();
      reject(new Error("timed out"));
    }, 20_000);
    ws.onmessage = (raw) => {
      const msg = JSON.parse(String(raw.data));
      if (msg.type === "session_ready") {
        clearTimeout(guard);
        ws.close();
        resolve(msg.messages ?? []);
      }
    };
    ws.onerror = () => {};
  });
}

async function main() {
  console.log(`=== token streaming smoke (XAI_STREAMING=${STREAMING}) ===\n`);

  const stub = await startStubXai();
  const dataDir = mkdtempSync(join(tmpdir(), "pcc-stream-smoke-"));
  process.env.NODE_ENV = "test";
  process.env.ACCOUNTS_PROVIDER = "json";
  process.env.XAI_API_KEY = "test-key-not-a-placeholder-000";
  process.env.XAI_BASE_URL = stub.baseUrl;
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
    const created = await fetch(`${base}/api/v1/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId: "twink-default" }),
    });
    const session = (await created.json()) as { sessionId: string; wsUrl: string };
    const wsUrl = session.wsUrl.replace(/^ws:\/\/[^/]+/, `ws://127.0.0.1:${port}`);

    const turn = await runTurn(wsUrl, "hey");

    console.log(`  time-to-first-text : ${turn.firstTextMs}ms`);
    console.log(`  full reply         : ${turn.completeMs}ms`);
    console.log(`  chunks             : ${turn.chunkCount}`);
    console.log(`  streamed text      : ${JSON.stringify(turn.streamedText)}`);
    console.log(`  final content      : ${JSON.stringify(turn.finalContent)}`);
    console.log(`  avatar intent      : ${JSON.stringify(turn.avatarIntent)}\n`);

    // --- Leak checks apply in BOTH modes ---
    const leaks = ["avatar_intent", "```", "{"].filter((p) => turn.streamedText.includes(p));
    check("streamed text never exposes the avatar_intent block", leaks.length === 0, `leaked: ${leaks.join(" ")}`);
    check("final content is clean prose", !turn.finalContent.includes("avatar_intent"));
    check("final content matches the character's line", turn.finalContent.trim() === PROSE.trim());
    check(
      "avatar intent from the JSON tail was applied",
      turn.avatarIntent?.emotion === "teasing",
      `got ${JSON.stringify(turn.avatarIntent?.emotion)}`,
    );
    check(
      "stream chunks and final message share one id",
      turn.streamIds.size === 1 && turn.streamIds.has(turn.completeId),
      `streamIds=${[...turn.streamIds].join(",")} completeId=${turn.completeId}`,
    );

    const history = await readHistory(wsUrl);
    const stored = history.filter((m) => m.role === "assistant").at(-1);
    check("stored transcript holds clean prose", stored?.content.trim() === PROSE.trim());
    check(
      "stored message reuses the streamed id",
      stored?.id === turn.completeId,
      `stored=${stored?.id} streamed=${turn.completeId}`,
    );

    // --- Mode-specific latency behaviour ---
    if (STREAMING) {
      check(
        "first text arrives before the reply finishes",
        turn.firstTextMs < turn.completeMs * 0.5,
        `first=${turn.firstTextMs}ms complete=${turn.completeMs}ms`,
      );
      check(
        "first text is fast in absolute terms",
        turn.firstTextMs < 1000,
        `${turn.firstTextMs}ms`,
      );
      const speedup = (turn.completeMs / Math.max(turn.firstTextMs, 1)).toFixed(1);
      console.log(`\n  >> user sees text ${speedup}x sooner than before <<\n`);
    } else {
      check(
        "fallback still delivers chunks",
        turn.chunkCount > 1,
        `chunks=${turn.chunkCount}`,
      );
      check(
        "fallback keeps old behaviour (text only at the end)",
        turn.firstTextMs >= turn.completeMs * 0.5,
        `first=${turn.firstTextMs}ms complete=${turn.completeMs}ms`,
      );
    }
  } finally {
    await app.close();
    stub.server.close();
  }

  console.log(`\n=== ${passes.length} passed, ${failures.length} failed ===`);
  if (failures.length > 0) {
    failures.forEach((f) => console.log(`  FAILED: ${f}`));
    process.exit(1);
  }
  process.exit(0);
}

void main().catch((error) => {
  console.error("smoke crashed:", error);
  process.exit(1);
});
