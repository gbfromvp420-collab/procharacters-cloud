/**
 * Guards the prompt library against the three ways a depth pass can silently
 * fail: the catalog and the manifest pointing at different versions, a bumped
 * pointer that still loads the old file, and an explicit version pin quietly
 * being served a different version's text.
 *
 * Run: npm run check:prompts
 */
import { readdirSync, existsSync } from "node:fs";
import { LIVE_CHARACTER_CATALOG } from "../src/lib/live/character-catalog.js";
import { createPromptSnapshot } from "../src/lib/live/prompt-snapshot.js";
import { loadPromptManifest } from "../src/lib/prompts/manifest.js";
import { repoPath } from "../src/lib/paths.js";

/** Shallowest of the hand-written Pack 01 prompts. Below this is template depth. */
const DEPTH_FLOOR = 300;

const manifest = await loadPromptManifest();
const problems: string[] = [];
const thin: string[] = [];

function versionsOnDisk(characterId: string): string[] {
  const dir = repoPath("prompts", "library", "naughty-syntax", characterId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^v\d+\.\d+\.\d+$/.test(e.name))
    .map((e) => e.name)
    .sort();
}

for (const [id, profile] of Object.entries(LIVE_CHARACTER_CATALOG)) {
  const expected = `prompts/library/naughty-syntax/${id}/${profile.defaultVersion}/prompt.md`;

  let snapshot;
  try {
    snapshot = await createPromptSnapshot(id);
  } catch (error) {
    problems.push(`${id}: failed to load — ${(error as Error).message}`);
    continue;
  }

  if (snapshot.promptVersion !== profile.defaultVersion || snapshot.promptPath !== expected) {
    problems.push(
      `${id}: default resolved to ${snapshot.promptVersion} @ ${snapshot.promptPath}, expected ${profile.defaultVersion} @ ${expected}`,
    );
  }

  const manifestEntry = manifest.characters[id];
  if (manifestEntry && manifestEntry.current_version !== profile.defaultVersion) {
    problems.push(
      `${id}: catalog says ${profile.defaultVersion} but manifest says ${manifestEntry.current_version}`,
    );
  }

  // Every version kept on disk must still be reachable by an explicit pin,
  // so resumed sessions keep the text they started on.
  for (const version of versionsOnDisk(id)) {
    const pinned = await createPromptSnapshot(id, version);
    const want = `prompts/library/naughty-syntax/${id}/${version}/prompt.md`;
    if (pinned.promptPath !== want) {
      problems.push(`${id}: pin ${version} served ${pinned.promptPath}, expected ${want}`);
    }
  }

  const words = snapshot.characterPrompt.split(/\s+/).filter(Boolean).length;
  if (words < DEPTH_FLOOR) thin.push(`${id}(${words})`);
}

const total = Object.keys(LIVE_CHARACTER_CATALOG).length;
console.log(`characters checked: ${total}`);
console.log(`deep (>= ${DEPTH_FLOOR} words): ${total - thin.length}/${total}`);
console.log(`still on the template (< ${DEPTH_FLOOR} words): ${thin.length}`);
if (thin.length) console.log(`  ${thin.join(" ")}`);

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  FAIL ${p}`);
  process.exit(1);
}
console.log("\nno version problems");
