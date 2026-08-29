/**
 * Guard the sleek chat room: no memory-window / remember-you chrome,
 * no hide-avatar collapse on the live surface.
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
  assert.equal(chat.includes("Hide avatar"), false, "Hide avatar must stay off-screen");
  assert.equal(chat.includes("setAvatarCollapsedPersist"), false, "Avatar collapse persist must be gone");
  assert.equal(chat.includes("AvatarPip"), false, "PiP must stay off the room");
  assert.match(chat, /fill\s*\n/, "Character video should fill the room rail");
  console.log("check-chat-sleek: ok");
}

main();
