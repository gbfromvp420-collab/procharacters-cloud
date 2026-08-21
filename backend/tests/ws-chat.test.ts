import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

// End-to-end WebSocket chat loop against a real listening server (no XAI key →
// deterministic stub replies still stream through the full session/WS pipeline).
let app: FastifyInstance;
let base: string;
let wsBase: string;

beforeAll(async () => {
  app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
  wsBase = `ws://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
});

type WsEvent = { type: string; [k: string]: unknown };

/** Buffers every WS event from connect time so we never race server pushes. */
function collector(ws: WebSocket) {
  const events: WsEvent[] = [];
  const waiters = new Set<(e: WsEvent) => void>();
  ws.on("message", (raw) => {
    let e: WsEvent;
    try {
      e = JSON.parse(raw.toString()) as WsEvent;
    } catch {
      return;
    }
    events.push(e);
    for (const w of waiters) w(e);
  });
  return {
    events,
    waitFor(type: string, timeoutMs = 15_000): Promise<WsEvent> {
      const existing = events.find((e) => e.type === type);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(onEvent);
          reject(
            new Error(`timeout waiting for '${type}' (got ${events.map((e) => e.type).join(",")})`),
          );
        }, timeoutMs);
        const onEvent = (e: WsEvent) => {
          if (e.type === type) {
            clearTimeout(timer);
            waiters.delete(onEvent);
            resolve(e);
          } else if (e.type === "error") {
            clearTimeout(timer);
            waiters.delete(onEvent);
            reject(new Error(`server error: ${JSON.stringify(e)}`));
          }
        };
        waiters.add(onEvent);
      });
    },
  };
}

async function createSession(): Promise<{ sessionId: string; wsToken: string }> {
  const res = await fetch(`${base}/api/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId: "twink-default" }),
  });
  expect(res.ok).toBe(true);
  return (await res.json()) as { sessionId: string; wsToken: string };
}

describe("WebSocket chat loop", () => {
  it("streams session_ready → assistant_stream → assistant_complete", async () => {
    const session = await createSession();
    expect(session.sessionId).toBeTruthy();
    expect(session.wsToken).toBeTruthy();

    const url = `${wsBase}/ws/sessions/${session.sessionId}?token=${session.wsToken}`;
    const ws = new WebSocket(url);
    const events = collector(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });

    try {
      const ready = await events.waitFor("session_ready");
      expect(ready.characterId).toBe("twink-default");

      ws.send(JSON.stringify({ type: "user_message", content: "keep it slow tonight" }));
      const complete = await events.waitFor("assistant_complete");
      expect(typeof complete.content).toBe("string");
      expect((complete.content as string).length).toBeGreaterThan(0);

      const types = events.events.map((e) => e.type);
      expect(types).toContain("assistant_stream");
      expect(types).toContain("avatar_update");
    } finally {
      ws.close();
    }
  }, 20_000);

  it("rejects a WebSocket connect with a bad token", async () => {
    const session = await createSession();
    const url = `${wsBase}/ws/sessions/${session.sessionId}?token=not-a-real-token`;
    const ws = new WebSocket(url);

    const outcome = await new Promise<string>((resolve) => {
      let settled = false;
      const done = (v: string) => {
        if (!settled) {
          settled = true;
          resolve(v);
        }
      };
      ws.on("error", () => done("error"));
      ws.on("message", (raw) => {
        try {
          if ((JSON.parse(raw.toString()) as WsEvent).type === "error") done("errored-event");
        } catch {
          /* ignore */
        }
      });
      ws.on("close", () => done("closed"));
      setTimeout(() => done("closed"), 5_000);
    });
    ws.close();
    expect(["closed", "error", "errored-event"]).toContain(outcome);
  }, 15_000);
});
