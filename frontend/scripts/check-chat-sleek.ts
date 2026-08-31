/**
 * Guard the sleek chat room: no memory-window / remember-you chrome,
 * no hide-avatar collapse, character + transcript stay one screen.
 * Run: npx --yes tsx scripts/check-chat-sleek.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chat = readFileSync(join(root, "src/components/ChatApp.tsx"), "utf8");

function main() {
  assert.equal(chat.includes("Memory window"), false, "Memory window select must stay off-screen");
  assert.equal(chat.includes("Remember me"), false, "Remember me toggle must stay off-screen");
  assert.equal(chat.includes("What we remember"), false, "What we remember strip must stay off-screen");
  assert.equal(chat.includes("They remember you"), false, "They remember you card must stay off-screen");
  assert.equal(chat.includes("they still remember you"), false, "Remember-you empty copy must stay off-screen");
  assert.equal(chat.includes("They kept a little of you"), false, "Kept-a-little copy must stay off-screen");
  assert.equal(chat.includes("Memory saves as you go"), false, "Memory-saves copy must stay off-screen");
  assert.equal(chat.includes("Hide avatar"), false, "Hide avatar must stay off-screen");
  assert.equal(chat.includes("setAvatarCollapsedPersist"), false, "Avatar collapse persist must be gone");
  assert.equal(chat.includes("AvatarPip"), false, "PiP must stay off the room");
  assert.equal(chat.includes("OpeningLinePreview"), false, "How they open card must stay off-screen");
  assert.equal(chat.includes("ChatResumeHero"), false, "Resume hero card must stay off-screen");
  assert.equal(chat.includes("EdgePaceStartHint"), false, "Edge Pace start card must stay off-screen");
  assert.equal(chat.includes("My Character (v2)"), false, "Inline create form must stay off chat");
  assert.equal(chat.includes("Batch upload clips"), false, "Clip editor must stay off chat");
  assert.match(chat, /fill\s*\n/, "Character video should fill the room rail");
  assert.equal(chat.includes("HeatWhisperStrip"), false, "Heat whisper card must stay off live composer");
  assert.equal(chat.includes("LastBeatEcho"), false, "Last beat card must stay off live composer");
  assert.equal(chat.includes("tap to copy"), false, "Resume-code sticky bar must stay off-screen");
  assert.match(chat, /hideContinue/, "Continue CTA should hide on live chat");
  console.log("check-chat-sleek: ok");
}

main();
