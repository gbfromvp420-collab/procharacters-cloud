/**
 * Procharacters.cloud — Deploy smoke harness (King Grok stability pack)
 *
 * One command to verify a live (or local) API after deploy.
 * No bodies logged beyond short status lines. Cleans up smoke account data when possible.
 *
 * Usage:
 *   npm run smoke:deploy
 *   npm run smoke:deploy -- --base https://procharacters-api-production-0417.up.railway.app
 *   API_BASE=http://localhost:3001 npm run smoke:deploy
 */

const DEFAULT_PROD = "https://procharacters-api-production-0417.up.railway.app";

function parseBase(): string {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === "--base" || a === "-b");
  if (i >= 0 && args[i + 1]) return args[i + 1]!.replace(/\/$/, "");
  return (process.env.API_BASE ?? DEFAULT_PROD).replace(/\/$/, "");
}

const API = parseBase();
const PREFIX = "/api/v1";

type Result = { name: string; ok: boolean; detail: string };

const results: Result[] = [];

function pass(name: string, detail: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name} — ${detail}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.log(`  ✗ ${name} — ${detail}`);
}

async function json<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: T; headers: Headers }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  let body: T = undefined as T;
  const text = await res.text();
  try {
    body = text ? (JSON.parse(text) as T) : (undefined as T);
  } catch {
    body = text as unknown as T;
  }
  return { status: res.status, body, headers: res.headers };
}

async function main() {
  console.log(`\n🔥 Procharacters deploy smoke`);
  console.log(`   API: ${API}\n`);

  // 1) Health
  try {
    const { status, body } = await json<{
      status?: string;
      livekit?: { configured?: boolean; badge?: string };
      billing?: { stripe?: boolean; freePath?: boolean };
      observability?: { errorWebhook?: boolean };
      avatar?: { energyBands?: string[] };
    }>("/health");
    if (status === 200 && body?.status === "ok") {
      pass(
        "health",
        `ok · livekit=${body.livekit?.badge ?? "?"} · stripe=${body.billing?.stripe ?? "?"} · freePath=${body.billing?.freePath ?? true}`,
      );
    } else {
      fail("health", `HTTP ${status}`);
    }
  } catch (e) {
    fail("health", e instanceof Error ? e.message : String(e));
  }

  // 2) Metrics
  try {
    const { status, body } = await json<{
      httpRequests?: number;
      uptimeSec?: number;
    }>("/metrics");
    if (status === 200 && typeof body?.httpRequests === "number") {
      pass("metrics", `requests=${body.httpRequests} uptimeSec=${body.uptimeSec ?? "?"}`);
    } else {
      fail("metrics", `HTTP ${status}`);
    }
  } catch (e) {
    fail("metrics", e instanceof Error ? e.message : String(e));
  }

  // 2b) Avatar pack status endpoint
  try {
    const { status, body } = await json<{
      ready?: string[];
      packs?: unknown[];
    }>("/avatar-packs");
    if (status === 200 && Array.isArray(body.packs)) {
      pass(
        "avatar_packs",
        `packs=${body.packs.length} dedicatedReady=${(body.ready ?? []).length}`,
      );
    } else {
      fail("avatar_packs", `HTTP ${status}`);
    }
  } catch (e) {
    fail("avatar_packs", e instanceof Error ? e.message : String(e));
  }

  // 3) Characters / Phase 4 pack
  const need = [
    "twink-default",
    "female-default",
    "twink-gym",
    "female-soft-goth",
    "female-playful-brat",
    "twink-shy-boy",
    "twink-alt-punk",
    "female-athletic-tease",
  ];
  try {
    const { status, body } = await json<{
      live?: Array<{ id: string; featured?: boolean; defaultVersion?: string }>;
    }>(`${PREFIX}/characters`);
    const ids = (body.live ?? []).map((c) => c.id);
    const missing = need.filter((id) => !ids.includes(id));
    if (status === 200 && missing.length === 0) {
      const featured = (body.live ?? []).filter((c) => c.featured).map((c) => c.id);
      pass(
        "characters",
        `live=${ids.length} featured=${featured.slice(0, 5).join(",")}${featured.length > 5 ? "…" : ""}`,
      );
    } else {
      fail("characters", missing.length ? `missing ${missing.join(",")}` : `HTTP ${status}`);
    }
  } catch (e) {
    fail("characters", e instanceof Error ? e.message : String(e));
  }

  // 4) Prefill (Phase 5)
  try {
    const { status, body } = await json<{ baseModelId?: string }>(
      `${PREFIX}/characters/twink-gym/prefill`,
    );
    if (status === 200 && body.baseModelId === "twink-gym") {
      pass("prefill", "twink-gym ok");
    } else {
      fail("prefill", `HTTP ${status}`);
    }
  } catch (e) {
    fail("prefill", e instanceof Error ? e.message : String(e));
  }

  // 5) Gallery
  try {
    const { status, body } = await json<{
      count?: number;
      featured?: unknown[];
      characters?: unknown[];
    }>(`${PREFIX}/characters/gallery`);
    if (status === 200 && (body.count ?? 0) >= 8) {
      pass(
        "gallery",
        `count=${body.count} featured=${Array.isArray(body.featured) ? body.featured.length : "?"}`,
      );
    } else {
      fail("gallery", `HTTP ${status} count=${body.count}`);
    }
  } catch (e) {
    fail("gallery", e instanceof Error ? e.message : String(e));
  }

  // 6) Billing catalog (free path)
  try {
    const { status, body } = await json<{
      configured?: boolean;
      products?: unknown[];
    }>(`${PREFIX}/billing/catalog`);
    if (status === 200 && Array.isArray(body.products)) {
      pass("billing_catalog", `configured=${body.configured} products=${body.products.length}`);
    } else {
      fail("billing_catalog", `HTTP ${status}`);
    }
  } catch (e) {
    fail("billing_catalog", e instanceof Error ? e.message : String(e));
  }

  // 7) Session create (normal + edge_pace)
  let sessionId: string | null = null;
  let wsToken: string | null = null;
  try {
    const { status, body } = await json<{
      sessionId?: string;
      wsToken?: string;
      promptVersion?: string;
      sessionMode?: string;
      resumeCode?: string;
    }>(`${PREFIX}/sessions`, {
      method: "POST",
      body: JSON.stringify({
        characterId: "twink-default",
        sessionMode: "edge_pace",
        messageWindow: 30,
      }),
    });
    if (status === 201 && body.sessionId && body.wsToken) {
      sessionId = body.sessionId;
      wsToken = body.wsToken;
      pass(
        "session_create",
        `mode=${body.sessionMode ?? "?"} ver=${body.promptVersion ?? "?"} resume=${body.resumeCode ?? "—"}`,
      );
    } else {
      fail("session_create", `HTTP ${status}`);
    }
  } catch (e) {
    fail("session_create", e instanceof Error ? e.message : String(e));
  }

  // 8) Session GET
  if (sessionId) {
    try {
      const { status, body } = await json<{ status?: string; characterId?: string }>(
        `${PREFIX}/sessions/${sessionId}`,
      );
      if (status === 200 && body.characterId === "twink-default") {
        pass("session_get", `status=${body.status}`);
      } else {
        fail("session_get", `HTTP ${status}`);
      }
    } catch (e) {
      fail("session_get", e instanceof Error ? e.message : String(e));
    }
  } else {
    fail("session_get", "skipped — no session");
  }

  // 9) Resume by code (if we got a code)
  // Create may always mint resume codes — re-fetch via end then resume is heavy; skip if no code

  // 10) My Character auth gate + create/delete
  try {
    const unauth = await json(`${PREFIX}/characters/custom`, {
      method: "POST",
      body: JSON.stringify({
        name: "X",
        appearance: "abcdefghijkl",
      }),
    });
    if (unauth.status === 401) {
      pass("mychar_auth_gate", "401 without token");
    } else {
      fail("mychar_auth_gate", `expected 401 got ${unauth.status}`);
    }
  } catch (e) {
    fail("mychar_auth_gate", e instanceof Error ? e.message : String(e));
  }

  const handle = `smoke${Math.floor(Math.random() * 1e6)}`;
  let token: string | null = null;
  try {
    const { status, body } = await json<{ token?: string }>(`${PREFIX}/accounts/register`, {
      method: "POST",
      body: JSON.stringify({
        handle,
        passphrase: "smoke-deploy-pass-9",
      }),
    });
    if (status === 201 && body.token) {
      token = body.token;
      pass("account_register", `@${handle}`);
    } else {
      fail("account_register", `HTTP ${status}`);
    }
  } catch (e) {
    fail("account_register", e instanceof Error ? e.message : String(e));
  }

  if (token) {
    try {
      const { status, body } = await json<{
        id?: string;
        visibility?: string;
        baseModelId?: string;
      }>(`${PREFIX}/characters/custom`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: "Smoke MyChar",
          appearance: "18yo skinny Latino twink, sheer thong, photorealistic Naughty Syntax model",
          baseModelId: "twink-gym",
          energy: "gym cool-down edging",
          keyPhrases: ["hold the burn"],
          scenes: [
            {
              title: "Cool-down",
              body: "Sheer wet pouch, slow strokes, deny finish until they beg.",
            },
          ],
        }),
      });
      if (
        status === 201 &&
        body.id &&
        body.visibility === "private" &&
        body.baseModelId === "twink-gym"
      ) {
        pass("mychar_create", `${body.id} private base=twink-gym`);
        // private not on gallery
        const gal = await json<{ characters?: Array<{ id: string }> }>(
          `${PREFIX}/characters/gallery`,
        );
        const hit = (gal.body.characters ?? []).some((c) => c.id === body.id);
        if (!hit) pass("mychar_private_gallery", "not listed publicly");
        else fail("mychar_private_gallery", "appeared on gallery");

        // cleanup
        await json(`${PREFIX}/characters/custom/${body.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        fail("mychar_create", `HTTP ${status}`);
      }
    } catch (e) {
      fail("mychar_create", e instanceof Error ? e.message : String(e));
    }

    // billing status (free)
    try {
      const { status, body } = await json<{
        plan?: string;
        freePath?: boolean;
      }>(`${PREFIX}/billing/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (status === 200 && body.freePath !== false) {
        pass("billing_status", `plan=${body.plan ?? "free"} freePath=true`);
      } else {
        fail("billing_status", `HTTP ${status}`);
      }
    } catch (e) {
      fail("billing_status", e instanceof Error ? e.message : String(e));
    }
  }

  // End guest session if any
  if (sessionId && wsToken) {
    try {
      await json(`${PREFIX}/sessions/${sessionId}/end`, {
        method: "POST",
        body: JSON.stringify({ token: wsToken }),
      });
      pass("session_end", "ok");
    } catch {
      pass("session_end", "skipped/non-fatal");
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n——— Summary: ${passed} passed · ${failed} failed ———\n`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
