/**
 * Procharacters.cloud — Session Memory Smoke Test
 *
 * Tests the v2 memory loop without a frontend:
 *   1. Create session (HTTP)
 *   2. Connect WebSocket
 *   3. Send test messages
 *   4. Inspect memory after each turn (HTTP)
 *
 * Prerequisites: backend running (`npm run dev` in backend/)
 *
 * Usage:
 *   npm run test:memory
 *   npm run test:memory -- --character female-default
 *   API_BASE=http://localhost:3001 CHARACTER_ID=twink-default npm run test:memory
 */

import WebSocket from "ws";

// --- Config (override via env or CLI) ---

const API_BASE = process.env.API_BASE ?? "http://localhost:3001";
const API_PREFIX = "/api/v1";

function parseArgs(): { characterId: string } {
  const args = process.argv.slice(2);
  const charFlag = args.findIndex((a) => a === "--character" || a === "-c");
  const characterId =
    charFlag >= 0 && args[charFlag + 1]
      ? args[charFlag + 1]
      : (process.env.CHARACTER_ID ?? "twink-default");
  return { characterId };
}

/** Sample messages — each triggers a user + assistant turn in memory */
const TEST_MESSAGES = [
  "Hey, keep it slow and teasing tonight.",
  "What are you wearing right now?",
  "Remember what I said about going slow?",
];

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(section: string, detail?: unknown): void {
  console.log(`\n── ${section} ──`);
  if (detail !== undefined) {
    console.log(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  }
}

interface CreateSessionResponse {
  sessionId: string;
  wsToken: string;
  characterId: string;
  promptVersion: string;
  wsUrl: string;
}

interface MemoryResponse {
  messageCount: number;
  recentMessages: Array<{ id: string; role: string; content: string; createdAt: string }>;
}

/** Step 1: Create a live session via REST */
async function createSession(characterId: string): Promise<CreateSessionResponse> {
  const res = await fetch(`${API_BASE}${API_PREFIX}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create session (${res.status}): ${err}`);
  }

  return res.json() as Promise<CreateSessionResponse>;
}

/** Step 4: Read memory state via REST (same data SessionMemory stores) */
async function fetchMemory(sessionId: string): Promise<MemoryResponse> {
  const res = await fetch(`${API_BASE}${API_PREFIX}/sessions/${sessionId}/memory`);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch memory (${res.status}): ${err}`);
  }

  return res.json() as Promise<MemoryResponse>;
}

/** Wait for a specific WebSocket event type */
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
        if ((event as { type: string }).type === "error") {
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

/** Step 2: Open WebSocket using wsUrl from session create */
function connectWebSocket(wsUrl: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => resolve(ws));
    ws.on("error", (err) => reject(err));
  });
}

/** Step 3: Send one user_message and wait for assistant_complete */
async function sendUserMessage(ws: WebSocket, content: string): Promise<string> {
  ws.send(JSON.stringify({ type: "user_message", content }));

  const complete = await waitForEvent<{ type: string; content: string }>(ws, "assistant_complete");

  return complete.content;
}

function printMemory(label: string, memory: MemoryResponse): void {
  log(label, {
    messageCount: memory.messageCount,
    recentMessages: memory.recentMessages.map((m) => ({
      role: m.role,
      content: m.content.slice(0, 120) + (m.content.length > 120 ? "…" : ""),
    })),
  });
}

// --- Main test flow ---

async function main(): Promise<void> {
  const { characterId } = parseArgs();

  log("Config", { API_BASE, characterId });

  // 1. Create session
  log("Creating session…");
  const session = await createSession(characterId);
  log("Session created", session);

  // 2. Connect WebSocket
  log("Connecting WebSocket…", session.wsUrl);
  const ws = await connectWebSocket(session.wsUrl);

  const ready = await waitForEvent<{ type: string; characterName: string }>(ws, "session_ready");
  log("WebSocket ready", ready);

  // Memory should be empty before any messages
  printMemory("Memory BEFORE messages", await fetchMemory(session.sessionId));

  // 3. Send messages and check memory after each turn
  for (let i = 0; i < TEST_MESSAGES.length; i++) {
    const userMsg = TEST_MESSAGES[i];
    log(`Sending message ${i + 1}/${TEST_MESSAGES.length}`, userMsg);

    const reply = await sendUserMessage(ws, userMsg);
    log("Assistant reply (truncated)", reply.slice(0, 200) + (reply.length > 200 ? "…" : ""));

    await sleep(300);
    printMemory(`Memory AFTER message ${i + 1}`, await fetchMemory(session.sessionId));
  }

  // Optional: preview how memory appears in the system prompt
  const previewRes = await fetch(
    `${API_BASE}${API_PREFIX}/sessions/${session.sessionId}/prompt-preview`,
  );
  if (previewRes.ok) {
    const preview = (await previewRes.json()) as { memoryPreview: string; turnNumber: number };
    log("Prompt memory preview", {
      turnNumber: preview.turnNumber,
      memoryPreview: preview.memoryPreview.slice(0, 500) + "…",
    });
  }

  // Clean up
  ws.send(JSON.stringify({ type: "end_session" }));
  await sleep(500);
  ws.close();

  const memoryAfterEnd = await fetchMemory(session.sessionId).catch(() => null);
  if (memoryAfterEnd) {
    printMemory("Memory AFTER session end (should be cleared)", memoryAfterEnd);
  }

  log("Done", "Memory smoke test finished successfully.");
}

main().catch((err) => {
  console.error("\n✗ Smoke test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
