const STORAGE_KEY = "procharacters.lastSession.v1";

export interface StoredSession {
  sessionId: string;
  wsToken: string;
  characterId: string;
  characterName?: string;
  /** Short resume code when available (for share links). */
  resumeCode?: string;
  /** ISO when the resume code expires (optional; for Continue urgency). */
  resumeExpiresAt?: string;
  savedAt: string;
}

export function loadStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.sessionId || !parsed.wsToken || !parsed.characterId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* private mode / quota */
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

const DRAFT_KEY = "procharacters.composerDraft.v1";

/** Per-character unsent composer text — survives reloads / character hops. */
export function loadComposerDraft(characterId: string): string {
  if (typeof window === "undefined" || !characterId) return "";
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return "";
    const map = JSON.parse(raw) as Record<string, string>;
    const text = map[characterId];
    return typeof text === "string" ? text : "";
  } catch {
    return "";
  }
}

export function saveComposerDraft(characterId: string, text: string): void {
  if (typeof window === "undefined" || !characterId) return;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const trimmed = text.slice(0, 4000);
    if (!trimmed.trim()) {
      delete map[characterId];
    } else {
      map[characterId] = trimmed;
    }
    // Cap map size — keep last ~24 characters' drafts
    const keys = Object.keys(map);
    if (keys.length > 24) {
      for (const k of keys.slice(0, keys.length - 24)) delete map[k];
    }
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function clearComposerDraft(characterId: string): void {
  saveComposerDraft(characterId, "");
}
