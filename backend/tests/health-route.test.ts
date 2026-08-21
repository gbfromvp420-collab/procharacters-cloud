import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

// In-process contract test for the ops/observability endpoints — no network,
// no external services (JSON accounts, no DATABASE_URL).
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("reports ok with the expected observability contract", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("procharacters-backend");
    expect(body.accounts.provider).toBe("json");
    expect(body.billing).toMatchObject({ freePath: true });
    expect(body.generativeVideo).toMatchObject({ default: "loops", optIn: true });
    expect(body.observability).toHaveProperty("alertChannel");
    expect(Array.isArray(body.avatar.clipSlots)).toBe(true);
  });
});

describe("GET /metrics", () => {
  it("exposes in-process counters and uptime", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.service).toBe("procharacters-backend");
    expect(body).toHaveProperty("uptimeSec");
    expect(body).toHaveProperty("sessionsCreated");
    expect(body).toHaveProperty("deploy");
  });
});

describe("GET /", () => {
  it("returns the service banner", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ service: "procharacters-backend", status: "ok" });
  });
});
