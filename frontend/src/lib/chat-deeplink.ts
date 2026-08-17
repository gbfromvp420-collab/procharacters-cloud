/**
 * Chat deep-link decisions for ?character=&autostart=1 (and resume/magic).
 *
 * ChatApp also syncs the address bar from picker state via replaceCharacterInUrl,
 * which strips autostart/resume. That sync must wait until this query is consumed,
 * otherwise a cold /chat?character=liam&autostart=1 is rewritten to twink-default.
 */

import { parseShareQuery, type ShareQuery } from "./share-links";

export function snapshotShareQuery(search?: string): ShareQuery {
  if (search != null) return parseShareQuery(search);
  if (typeof window === "undefined") return parseShareQuery("");
  return parseShareQuery(window.location.search);
}

/** Incoming share query that ChatApp must apply before rewriting the address bar. */
export function hasPendingShareDeepLink(
  query: ShareQuery | null | undefined,
): boolean {
  if (!query) return false;
  return !!(
    query.characterId ||
    query.resumeCode ||
    query.magicToken ||
    (query.sessionId && query.token) ||
    query.create ||
    query.edit
  );
}

export type CharacterDeepLinkDecision =
  | { action: "none" }
  | { action: "wait" }
  | { action: "unknown"; characterId: string }
  | {
      action: "select";
      characterId: string;
      autostart: boolean;
      sessionMode?: ShareQuery["sessionMode"];
    };

/**
 * Apply ?character= after the live catalog is available.
 * Pack first-name ids (liam, emma, …) are not in the static fallback list.
 */
export function resolveCharacterDeepLink(options: {
  query: ShareQuery;
  catalogIds: readonly string[];
  catalogReady: boolean;
}): CharacterDeepLinkDecision {
  const characterId = options.query.characterId;
  if (!characterId) return { action: "none" };

  const exists = options.catalogIds.includes(characterId);
  if (!exists) {
    return options.catalogReady
      ? { action: "unknown", characterId }
      : { action: "wait" };
  }

  return {
    action: "select",
    characterId,
    autostart: !!options.query.autostart,
    sessionMode: options.query.sessionMode,
  };
}
