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
