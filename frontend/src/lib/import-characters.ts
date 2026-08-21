/** Analyze export JSON for character ids that need remapping on import. */

export type ExportCharacterRef = {
  id: string;
  name: string;
  sessionCount: number;
};

export type RemapTarget = {
  id: string;
  displayName: string;
};

function pushChar(map: Map<string, ExportCharacterRef>, id: string, name?: string) {
  const key = id.trim();
  if (!key) return;
  const existing = map.get(key);
  if (existing) {
    existing.sessionCount += 1;
    if (name && name.trim() && existing.name === existing.id) {
      existing.name = name.trim();
    }
    return;
  }
  map.set(key, {
    id: key,
    name: (name && name.trim()) || key,
    sessionCount: 1,
  });
}

/** Collect unique character refs from single/bulk export documents. */
export function collectExportCharacters(document: unknown): ExportCharacterRef[] {
  let doc = document;
  if (doc && typeof doc === "object" && "document" in doc) {
    doc = (doc as { document: unknown }).document;
  }
  if (!doc || typeof doc !== "object") return [];

  const root = doc as Record<string, unknown>;
  const map = new Map<string, ExportCharacterRef>();

  if (root.session && typeof root.session === "object") {
    const s = root.session as Record<string, unknown>;
    if (typeof s.characterId === "string") {
      pushChar(
        map,
        s.characterId,
        typeof s.characterName === "string" ? s.characterName : undefined,
      );
    }
  }

  if (Array.isArray(root.sessions)) {
    for (const item of root.sessions) {
      if (!item || typeof item !== "object") continue;
      const s = item as Record<string, unknown>;
      if (typeof s.characterId === "string") {
        pushChar(
          map,
          s.characterId,
          typeof s.characterName === "string" ? s.characterName : undefined,
        );
      }
    }
  }

  if (typeof root.characterId === "string" && Array.isArray(root.messages)) {
    pushChar(
      map,
      root.characterId,
      typeof root.characterName === "string" ? root.characterName : undefined,
    );
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function partitionCharacters(
  refs: ExportCharacterRef[],
  liveIds: Set<string>,
): { available: ExportCharacterRef[]; missing: ExportCharacterRef[] } {
  const available: ExportCharacterRef[] = [];
  const missing: ExportCharacterRef[] = [];
  for (const ref of refs) {
    if (liveIds.has(ref.id)) available.push(ref);
    else missing.push(ref);
  }
  return { available, missing };
}

/** Guess a default remap target from character name (female → female-default). */
export function suggestFallbackId(name: string, liveIds: Set<string>): string {
  const n = name.toLowerCase();
  if (
    liveIds.has("female-default") &&
    (/\bfemale\b|\bwoman\b|\bgirl\b|\bshe\b|\bher\b/.test(n) || n.includes("female"))
  ) {
    return "female-default";
  }
  if (liveIds.has("twink-default")) return "twink-default";
  return [...liveIds][0] ?? "twink-default";
}
