/**
 * Same-night reclaim: gallery Chat / autostart links should resume heat
 * when this device (or the signed-in account) already has a code.
 */

import { parseShareQuery } from "./share-links";
import { buildResumeChatPath, getResumeForCharacter } from "./resume-cache";

/** Rewrite ?character=&autostart=1 to a resume deep-link when heat exists. */
export function rewriteAutostartToResume(search: string): string | null {
  const q = parseShareQuery(search);
  if (q.fresh || q.resumeCode || q.sessionId || !q.characterId || !q.autostart) {
    return null;
  }
  const cached = getResumeForCharacter(q.characterId);
  if (!cached?.resumeCode) return null;
  return buildResumeChatPath(cached, {
    edgePace: q.sessionMode === "edge_pace" ? true : undefined,
  });
}
