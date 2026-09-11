/**
 * Voice-lock smoke — drives a real session against a live API and scores the
 * replies, not the status codes.
 *
 *   npm run smoke:voice -- --character sarah
 *   npm run smoke:voice -- --character sarah --base http://localhost:3001 --out /tmp/sarah.log
 *
 * Per character it checks: create returns the catalog defaultVersion; four
 * turns stay in the character's own lexicon and never leak another
 * character's tells; a name and a day detail planted on turn 1 come back
 * unprompted; end → resume keeps the version, rehydrates history, and the
 * next reply continues the state instead of replaying the opening seed.
 * Cruz and Vesper are created as controls so a version regression on the
 * flagships shows up in the same run.
 *
 * Costs real LLM calls (6 turns) — run it after a deploy, not in a loop.
 */
import WebSocket from "ws";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { LIVE_CHARACTER_CATALOG } from "../src/lib/live/character-catalog.js";

const DEFAULT_PROD = "https://procharacters-api-production-0417.up.railway.app";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const characterId = arg("character") ?? "jenny";
const API = (arg("base") ?? process.env.API_BASE ?? DEFAULT_PROD).replace(/\/$/, "");
const OUT = arg("out") ?? `/tmp/voice-lock-${characterId}.log`;
const P = `${API}/api/v1`;

const profile = LIVE_CHARACTER_CATALOG[characterId];
if (!profile) {
  console.error(`unknown character '${characterId}'`);
  process.exit(2);
}

/**
 * Own lexicon: words that should show up when the character holds voice.
 * Tells: phrases distinctive enough that hearing them from anyone else is a
 * blend. A character's own tells are never counted against them.
 */
const VOICE: Record<string, { own: string[]; tells: string[] }> = {
  jenny: {
    own: ["ivory", "hover", "float", "gap", "not yet", "sun", "warm", "not touching", "shaking", "ache", "panel"],
    tells: ["float there", "floating above", "hovering over the open panel", "hover above", "fingertip's floating"],
  },
  sarah: {
    own: ["silk", "inch", "nicely", "lamp", "ledger", "ask", "still", "shin"],
    tells: ["next inch", "ask nicely", "ledger", "one inch"],
  },
  emma: {
    own: ["cream", "hips", "honey", "love", "sorry", "rush", "slow", "still", "panel"],
    tells: ["hips stay", "cannot rush me", "hips locked", "hips don't move"],
  },
  olivia: {
    own: ["ivory", "silk", "gold", "still", "patch", "shin", "ache", "move", "knee", "chain"],
    tells: ["gold at my throat", "ask me to bounce", "expensive"],
  },
  peter: {
    own: ["white", "sheer", "pouch", "stroke", "stop", "please", "spot", "tent"],
    tells: ["one stroke", "say please", "stopped"],
  },
  justin: {
    own: ["navy", "edge", "smile", "finishing", "hold", "day", "hey"],
    tells: ["not finishing", "edge and smile", "you're not finishing"],
  },
  liam: {
    own: ["silver", "light", "spotlight", "twitch", "look away", "hold", "shine", "scene", "lit"],
    tells: ["don't look away", "spotlight", "every twitch", "places"],
  },
  noah: {
    own: ["blush", "pink", "sorry", "stop", "sweet", "hey, you", "gentl", "rose"],
    tells: ["watch me stop", "sorry in advance", "i'm sorry. i really am"],
  },
  "female-playful-brat": { own: [], tells: ["count", "start over", "make me", "cheater", "good girls get", "bad boys wait", "kidding. maybe"] },
  "female-soft-goth": { own: [], tells: ["lace", "spell", "ritual", "lights low", "choker", "smoky", "beg quieter"] },
  "female-default": { own: [], tells: ["i decide", "until i let you", "earn the next", "match my breathing", "i'm deciding"] },
  "twink-gym": { own: [], tells: ["hold that burn", "reps", "set's over", "cool-down", "locker"] },
  "twink-alt-punk": { own: [], tells: ["mesh", "in the net", "i'm not shy", "pick a view"] },
  "twink-shy-boy": { own: [], tells: ["so embarrassing", "don't look yet", "i can't say it"] },
  "twink-default": { own: [], tells: ["gooner", "papi", "glass-wet"] },
};

/** In-character copy the orchestrator returns when the brain call fails (chat-orchestrator.ts buildErrorReply). */
const FALLBACKS = ["i got distracted. say that again", "things got a little busy", "hold that thought for me"];

const me = VOICE[characterId] ?? { own: [], tells: [] };
const RIVAL_NAMES = Object.values(LIVE_CHARACTER_CATALOG)
  .filter((p) => p.id !== characterId)
  .map((p) => p.displayName.toLowerCase());
const RIVAL_TELLS = Object.entries(VOICE)
  .filter(([id]) => id !== characterId)
  .flatMap(([, v]) => v.tells)
  .filter((t) => !me.own.some((o) => t.includes(o) || o.includes(t)) && !me.tells.includes(t));

const log: string[] = [];
const say = (s = "") => { console.log(s); log.push(s); };
const results: { name: string; ok: boolean }[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  results.push({ name, ok });
  say(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  → ${detail}` : ""}`);
};
const lower = (s: string | null | undefined) => (s ?? "").toLowerCase();
const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word match so "lace" never fires on "Places." and "hover" never fires on "hovered". Stems in own lexicons (e.g. "shin", "gentl") are still prefix-matched via the trailing \w*. */
const hits = (s: string, words: string[]) =>
  words.filter((w) => new RegExp(`(^|[^a-z])${escapeRe(w)}\\w*(?![a-z])`, "i").test(lower(s)));

async function post(path: string, body?: unknown) {
  const r = await fetch(`${P}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}

interface Msg { role: string; content: string }
interface Turn { history: Msg[]; reply: string | null; intent?: Record<string, unknown> }

function turn(wsUrl: string, message: string | null): Promise<Turn> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let history: Msg[] = [];
    let streamed = "";
    const guard = setTimeout(() => { ws.close(); reject(new Error("ws timeout")); }, 90_000);
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === "session_ready") {
        history = msg.messages ?? [];
        if (!message) { clearTimeout(guard); ws.close(); return resolve({ history, reply: null }); }
        ws.send(JSON.stringify({ type: "user_message", content: message }));
      } else if (msg.type === "assistant_stream") {
        streamed += msg.chunk ?? "";
      } else if (msg.type === "assistant_complete") {
        clearTimeout(guard); ws.close();
        resolve({ history, reply: msg.content ?? streamed, intent: msg.avatarIntent });
      } else if (msg.type === "error") {
        clearTimeout(guard); ws.close(); reject(new Error(`ws error: ${JSON.stringify(msg)}`));
      }
    });
    ws.on("error", (e) => { clearTimeout(guard); reject(e); });
  });
}

async function main() {
  const name = profile.displayName.toLowerCase();
  say(`=== ${profile.displayName} ${profile.defaultVersion} voice-lock smoke ===`);
  say(`API: ${API}`);
  const health = await (await fetch(`${API}/health`)).json();
  say(`api sha: ${health.deploy?.gitShaShort}  llm.ok: ${health.llm?.ok}`);
  say("");

  const created = await post("/sessions", { characterId });
  check("create → 201", created.status === 201, `http ${created.status}`);
  check(`create → promptVersion ${profile.defaultVersion}`, created.body.promptVersion === profile.defaultVersion, created.body.promptVersion);
  const { sessionId, wsUrl, resumeCode } = created.body;
  say(`sessionId ${sessionId}  resumeCode ${resumeCode}`);
  say("");

  const open = await turn(wsUrl, null);
  const seed = open.history.find((m) => m.role === "assistant")?.content ?? "";
  say(`[opening seed] ${seed}`);
  say("");

  const USER = [
    `hey ${name}. it's marcus. just got back from leg day at the gym — thighs are wrecked and i'm still sweaty. i just want to sit here and watch you for a bit.`,
    "god. can i touch yet? i'm already hard just watching you.",
    "please. i'm begging. what do i have to do to get more?",
    "fuck… ok. i'll wait. talk to me while i wait, tell me what you're feeling.",
  ];
  const replies: string[] = [];
  for (let i = 0; i < USER.length; i++) {
    say(`[turn ${i + 1} user] ${USER[i]}`);
    const t = await turn(wsUrl, USER[i]);
    replies.push(t.reply ?? "");
    say(`[turn ${i + 1} ${name}] ${t.reply}`);
    if (t.intent) say(`  avatar_intent: ${JSON.stringify(t.intent)}`);
    say("");
  }

  const all = replies.join("\n");
  const fallbackTurns = replies.map((r, i) => (hits(r, FALLBACKS).length ? i + 1 : 0)).filter(Boolean);
  check("4 turns → no brain-failure fallback replies", fallbackTurns.length === 0, fallbackTurns.length ? `turn ${fallbackTurns.join(", ")} was an LLM error fallback — check /health llm` : "all real");
  check("4 turns → every reply non-empty", replies.every((r) => r.trim().length > 20), replies.map((r) => r.length).join("/") + " chars");
  const own = hits(all, me.own);
  check("4 turns → own lexicon present", me.own.length === 0 || own.length >= Math.min(4, me.own.length), `hits: ${own.join(", ") || "none"}`);
  const leaks = hits(all, RIVAL_TELLS);
  check("4 turns → no rival tells", leaks.length === 0, leaks.length ? `leak: ${leaks.join(", ")}` : "clean");
  const blended = RIVAL_NAMES.filter((n) => new RegExp(`\\b${n}\\b`).test(lower(all)));
  check("4 turns → never uses another character's name", blended.length === 0, blended.length ? `blend: ${blended.join(", ")}` : "clean");

  const later = replies.slice(1).join("\n");
  check("recall → planted name used by turn 2–4", lower(later).includes("marcus"), lower(later).includes("marcus") ? "marcus" : "not used");
  const detail = hits(later, ["leg day", "gym", "your thighs", "your legs", "sore", "sweaty", "workout", "wrecked"]);
  check("recall → planted gym/day detail used by turn 2–4", detail.length > 0, detail.join(", ") || "not used");

  check("anti-loop → 4 distinct replies", new Set(replies.map((r) => lower(r).trim())).size === replies.length, "");
  check("anti-loop → seed not replayed in turns 1–4", !replies.some((r) => lower(r).includes(lower(seed).slice(0, 40))), "");
  const openers = replies.map((r) => lower(r).trim().split(/\s+/).slice(0, 2).join(" "));
  const repeatedOpener = openers.find((o, i) => openers.indexOf(o) !== i);
  check("anti-loop → no two replies share an opener", !repeatedOpener, repeatedOpener ? `"${repeatedOpener}…" ×${openers.filter((o) => o === repeatedOpener).length}` : "varied");
  const nameFirst = replies.filter((r) => new RegExp(`^\\W*(hey[,… ]+)?marcus\\b`, "i").test(r.trim())).length;
  check("anti-loop → not every reply leads with his name", nameFirst < replies.length, `${nameFirst}/${replies.length} name-first`);
  // Sentence-level repeat: a whole sentence (6+ words) reused across replies is a loop even when the replies differ overall.
  const sentences = replies.map((r) => new Set(lower(r).split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 6)));
  const reused: string[] = [];
  sentences.forEach((set, i) => set.forEach((s) => { if (sentences.some((other, j) => j !== i && other.has(s)) && !reused.includes(s)) reused.push(s); }));
  check("anti-loop → no sentence reused across replies", reused.length === 0, reused.length ? `"${reused[0].slice(0, 60)}…" ×${reused.length}` : "none");

  const ended = await post(`/sessions/${sessionId}/end`);
  check("end → 200 resumable", ended.status === 200 && ended.body.resumable === true, `http ${ended.status} msgs=${ended.body.messageCount}`);
  const resumed = await post("/sessions/resume-code", { code: resumeCode });
  check("resume → 200", resumed.status === 200, `http ${resumed.status}`);
  check(`resume → still ${profile.defaultVersion}`, resumed.body.promptVersion === profile.defaultVersion, resumed.body.promptVersion);
  const r = await turn(resumed.body.wsUrl, null);
  check("resume → history rehydrated", r.history.filter((m) => m.role === "user").length >= 4, `${r.history.length} msgs`);
  say("");

  const USER5 = "i'm back. did you keep going while i was gone?";
  say(`[resume turn user] ${USER5}`);
  const t5 = await turn(resumed.body.wsUrl, USER5);
  say(`[resume turn ${name}] ${t5.reply}`);
  if (t5.intent) say(`  avatar_intent: ${JSON.stringify(t5.intent)}`);
  say("");
  const reply5 = t5.reply ?? "";
  check("resume → no cold-open seed replay", !lower(reply5).includes(lower(seed).slice(0, 40)) && !new RegExp(`^${name}[.,…]`).test(lower(reply5).trim()), "");
  const cont = hits(reply5, ["still", "kept", "while you were gone", "the whole time", "haven't", "hasn't", ...me.own]);
  check("resume → state continues", cont.length >= 1, `hits: ${cont.slice(0, 6).join(", ")}`);
  check("resume → remembers marcus", lower(reply5).includes("marcus"), "");
  const leak5 = hits(reply5, RIVAL_TELLS);
  check("resume → still no rival tells", leak5.length === 0, leak5.length ? `leak: ${leak5.join(", ")}` : "clean");

  for (const id of ["twink-default", "female-default"]) {
    if (id === characterId) continue;
    const want = LIVE_CHARACTER_CATALOG[id].defaultVersion;
    const c = await post("/sessions", { characterId: id });
    check(`control ${id} → ${want}`, c.status === 201 && c.body.promptVersion === want, `${c.body.promptVersion}`);
    if (c.body.sessionId) await post(`/sessions/${c.body.sessionId}/end`);
  }
  await post(`/sessions/${resumed.body.sessionId ?? sessionId}/end`);

  say("");
  const passed = results.filter((x) => x.ok).length;
  say(`=== ${passed}/${results.length} checks passed ===`);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, log.join("\n") + "\n");
  console.log(`\nlog: ${OUT}`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
