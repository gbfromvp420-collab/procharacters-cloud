/**
 * Mind fingerprint — short human line for “which brain am I talking to?”
 * Brain-first UI: soul is the model, not the shared base video.
 */

export interface MindFingerprint {
  /** Chip label */
  tag: string;
  /** One-line fingerprint */
  blurb: string;
  /** Optional Spanish density note for Latino twinks */
  bilingual?: boolean;
}

const FINGERPRINTS: Record<string, MindFingerprint> = {
  "twink-default": {
    tag: "Flagship edge",
    blurb:
      "Sheer-pouch cam boy · slow fabric handjob denial · soft Spanish when it hits",
    bilingual: true,
  },
  "female-default": {
    tag: "Open panel",
    blurb: "Crotchless soft-dom · hover then deny · intimate, not giggly",
  },
  "twink-shy-boy": {
    tag: "Shy heat",
    blurb:
      "Diego · whisper exhibition · peek-and-hide · praise makes him leak Spanish",
    bilingual: true,
  },
  "twink-gym": {
    tag: "Post-set",
    blurb: "Mateo · interval edging · sweat + sheer · Aguanta… then one more rep",
    bilingual: true,
  },
  "twink-alt-punk": {
    tag: "Mesh brat",
    blurb: "Rio · black mesh soft-dom · mean-cool · Ven… Pide… short grit Spanish",
    bilingual: true,
  },
  "female-soft-goth": {
    tag: "Soft goth",
    blurb: "Luna · hypnotic lace ritual · open panel still-life · beg quieter",
  },
  "female-athletic-tease": {
    tag: "Cool-down",
    blurb: "Sienna · post-set intervals · sweat + sport cut · hold until she says go",
  },
  "female-playful-brat": {
    tag: "Brat game",
    blurb: "Mila · count games · look-but-don’t · cute denial with a laugh",
  },
};

export function mindFingerprint(
  characterId: string | null | undefined,
  hints?: { displayName?: string | null; energyLabel?: string | null },
): MindFingerprint | null {
  if (!characterId) return null;
  if (FINGERPRINTS[characterId]) return FINGERPRINTS[characterId]!;
  if (characterId.startsWith("custom") || characterId.includes("custom")) {
    const nick = hints?.displayName?.trim().split(/\s+/)[0];
    const vibe = hints?.energyLabel?.trim().split(",")[0]?.trim();
    return {
      tag: nick ? nick.slice(0, 18) : "Yours",
      blurb: vibe
        ? `${nick || "My model"} · ${vibe} · private to you`
        : "Custom mind on a signature body base — private to your account",
    };
  }
  return null;
}

/** UTC calendar day as YYYYMMDD int — stable “tonight’s cast” seed. */
export function calendarDaySeed(date = new Date()): number {
  return (
    date.getUTCFullYear() * 10000 +
    (date.getUTCMonth() + 1) * 100 +
    date.getUTCDate()
  );
}

/** Deterministic PRNG (Mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle with a stable seed (same day → same order). */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const rng = mulberry32(seed ^ 0x9e3779b9);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
