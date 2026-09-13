/**
 * Guard chat-outage honesty: banner, notice bubbles, System pulse brain chip.
 * Run: npx --yes tsx scripts/check-outage-ux.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  brainChipLabel,
  chatOutageCopy,
  isChatBrainUp,
} from "../src/lib/llm-status";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chat = readFileSync(join(root, "src/components/ChatApp.tsx"), "utf8");
const pulse = readFileSync(join(root, "src/components/SystemPulse.tsx"), "utf8");
const banner = readFileSync(join(root, "src/components/ChatOutageBanner.tsx"), "utf8");

function main() {
  assert.equal(isChatBrainUp({ product: "ok", llm: { ok: true, configured: true } }), true);
  assert.equal(isChatBrainUp({ product: "degraded", llm: { ok: false, configured: true } }), false);
  assert.equal(isChatBrainUp({ llm: { ok: true, configured: false } }), false);

  const down = chatOutageCopy({ llm: { ok: false, configured: true } });
  assert.ok(down);
  assert.equal(/console\.x\.ai|credit|xai_api_key|\.env/i.test(`${down.title} ${down.body}`), false);

  const off = chatOutageCopy({ llm: { configured: false, ok: true } });
  assert.ok(off);

  const brainDown = brainChipLabel({ llm: { ok: false, configured: true, lastFailureReason: "credits_or_spending_limit" } });
  assert.equal(brainDown.label, "Chat brain down");
  assert.equal(brainDown.ok, "warn");

  const brainUp = brainChipLabel({ llm: { ok: true, configured: true } });
  assert.equal(brainUp.label, "Chat brain up");

  const gallery = readFileSync(join(root, "src/components/GalleryView.tsx"), "utf8");
  assert.match(chat, /ChatOutageBanner/);
  assert.match(gallery, /ChatOutageBanner/);
  assert.match(chat, /kind === "notice"/);
  assert.match(chat, /data-msg-kind/);
  assert.match(chat, /Chat notice/);
  assert.match(banner, /data-testid="chat-outage-banner"/);
  assert.match(banner, /\/health/);
  assert.equal(banner.toLowerCase().includes("console.x.ai"), false);
  assert.match(pulse, /brainChipLabel/);
  assert.match(pulse, /Chat brain down/);
  assert.match(pulse, /key: "brain"/);

  console.log("check-outage-ux: ok");
}

main();
