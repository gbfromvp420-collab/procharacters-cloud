import { LIVE_CHARACTER_CATALOG } from "./character-catalog.js";
import { PACK_MIND_COPY } from "./pack-mind-copy.js";

/** Stamp Pack 02/03 distinct copy onto the live catalog before serving. */
export function applyPackMindCopy(): number {
  let n = 0;
  for (const [id, copy] of Object.entries(PACK_MIND_COPY)) {
    const profile = LIVE_CHARACTER_CATALOG[id];
    if (!profile) continue;
    profile.teaser = copy.teaser;
    profile.energyLabel = copy.energy;
    profile.openingMessage = copy.opening;
    n += 1;
  }
  return n;
}
