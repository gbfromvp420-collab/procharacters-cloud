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
export function hasPendingShareDeepLink(query: ShareQuery | null | undefined): boolean {
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
    return options.catalogReady ? { action: "unknown", characterId } : { action: "wait" };
  }

  return {
    action: "select",
    characterId,
    autostart: !!options.query.autostart,
    sessionMode: options.query.sessionMode,
  };
}

/** Picker id for first ChatApp paint — honor ?character= instead of twink-default. */
export function initialPickerCharacterId(search?: string, fallback = "twink-default"): string {
  return snapshotShareQuery(search).characterId || fallback;
}

export type ChatBootIdentity = {
  /** URL / live / picker mind — never a leftover last-session id. */
  intendedCharacterId: string | null;
  /** Safe chrome name. Null = stay blank / “Opening live session…”. */
  displayName: string | null;
  /** Mind tag + opening belong to intendedCharacterId (not Flagship edge leftover). */
  showMind: boolean;
  /** ?character= is set but picker/session has not caught up yet. */
  pendingRequested: boolean;
};

/**
 * First-paint / connecting labels must not leak the last mind or the static
 * twink-default fallback while ?character=liam (or emma, …) is still booting.
 */
export function resolveChatBootIdentity(options: {
  queryCharacterId?: string | null;
  /** True after ChatApp consumed the snapshotted share query. */
  queryConsumed?: boolean;
  selectedCharacterId?: string | null;
  activeCharacterId?: string | null;
  liveCharacterName?: string | null;
  selectedDisplayName?: string | null;
  savedSession?: {
    characterId?: string | null;
    characterName?: string | null;
  } | null;
}): ChatBootIdentity {
  const rawQuery = options.queryCharacterId?.trim() || null;
  const selectedId = options.selectedCharacterId?.trim() || null;
  const activeId = options.activeCharacterId?.trim() || null;
  // Stale snapshot must not override a later picker hop once the link is applied.
  const queryId = rawQuery && !options.queryConsumed ? rawQuery : null;
  const intendedCharacterId = queryId || activeId || selectedId || null;
  const pendingRequested = !!(queryId && queryId !== selectedId && queryId !== activeId);

  if (pendingRequested || !intendedCharacterId) {
    return {
      intendedCharacterId,
      displayName: null,
      showMind: false,
      pendingRequested,
    };
  }

  const liveName = options.liveCharacterName?.trim() || null;
  const selectedName = options.selectedDisplayName?.trim() || null;
  const savedId = options.savedSession?.characterId?.trim() || null;
  const savedName = options.savedSession?.characterName?.trim() || null;
  const savedNameIfMatch = savedId && savedId === intendedCharacterId ? savedName : null;

  return {
    intendedCharacterId,
    displayName: liveName || selectedName || savedNameIfMatch || null,
    showMind: true,
    pendingRequested: false,
  };
}
