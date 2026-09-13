/**
 * Offline Stage 1 proof: create a session, send one WS turn, expect a
 * stub assistant_complete when XAI_API_KEY is unset. No vendor/billing leak.
 *
 * Usage (backend already running):
 *   API_BASE=http://127.0.0.1:3001 npm run smoke:stub-turn
 */

import WebSocket from "ws";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001").replace(/\/$/, "");

function waitForEvent<T extends { type: string }>(
  ws: WebSocket,
  type: string,
  timeoutMs = 15_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error(`Timeout waiting for '${type}'`));
    }, timeoutMs);

    function onMessage(raw: WebSocket.RawData): void {
      try {
        const event = JSON.parse(raw.toString()) as T;
        if (event.type === type) {
          clearTimeout(timer);
          ws.off("message", onMessage);
          resolve(event);
        }
        if (event.type === "error") {
          clearTimeout(timer);
          ws.off("message", onMessage);
          reject(new Error(`Server error: ${JSON.stringify(event)}`));
        }
      } catch {
        // ignore non-JSON
      }
    }

    ws.on("message", onMessage);
  });
}

async function main(): Promise<void> {
  const create = await fetch(`${API_BASE}/api/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId: "twink-default" }),
  });
  if (!create.ok) {
    throw new Error(`session create HTTP ${create.status}: ${await create.text()}`);
  }
  const session = (await create.json()) as {
    sessionId: string;
    wsToken: string;
    wsUrl: string;
  };

  const ws = await new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(session.wsUrl);
    socket.on("open", () => resolve(socket));
    socket.on("error", reject);
  });

  await waitForEvent(ws, "session_ready");
  ws.send(JSON.stringify({ type: "user_message", content: "hey, keep it slow" }));
  const complete = await waitForEvent<{ type: string; content?: string }>(
    ws,
    "assistant_complete",
  );
  const text = complete.content ?? "";

  const leaked =
    /console\.x\.ai|xai credits|spending limit|api[_-]?key|bearer /i.test(text);
  if (!text.trim()) throw new Error("empty assistant_complete");
  if (leaked) throw new Error(`vendor/billing leak in stub reply: ${text.slice(0, 200)}`);

  const unauth = await fetch(
    `${API_BASE}/api/v1/sessions/${session.sessionId}/prompt-preview`,
  );
  if (unauth.status !== 401) {
    throw new Error(`prompt-preview without token expected 401, got ${unauth.status}`);
  }

  const preview = await fetch(
    `${API_BASE}/api/v1/sessions/${session.sessionId}/prompt-preview?token=${encodeURIComponent(session.wsToken)}`,
  );
  if (!preview.ok) {
    throw new Error(`prompt-preview with token HTTP ${preview.status}`);
  }
  const body = (await preview.json()) as {
    memoryPreview?: string;
    conversationPreview?: unknown[];
    systemPrompt?: string;
    layers?: { character?: string };
  };
  if (body.systemPrompt || body.layers?.character) {
    throw new Error("prompt-preview leaked system/character prompt layers");
  }

  ws.send(JSON.stringify({ type: "end_session" }));
  ws.close();

  console.log(`  ✓ stub turn ok (${text.slice(0, 72).replace(/\s+/g, " ")}…)`);
  console.log("  ✓ prompt-preview requires session token");
  console.log("  ✓ prompt-preview omits system/character layers");
}

main().catch((error) => {
  console.error("✗ stub turn failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
