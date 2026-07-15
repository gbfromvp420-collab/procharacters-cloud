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
    blurb: "Whisper exhibition · peek-and-hide · praise makes him leak Spanish",
    bilingual: true,
  },
  "twink-gym": {
    tag: "Post-set",
    blurb: "Interval edging · sweat + sheer · reps, burn, hold — Aguanta…",
    bilingual: true,
  },
  "twink-alt-punk": {
    tag: "Mesh brat",
    blurb: "Black mesh soft-dom · mean-cool · short Spanish grit (Ven… Pide…)",
    bilingual: true,
  },
  "female-soft-goth": {
    tag: "Soft goth",
    blurb: "Hypnotic lace ritual · open panel still-life · beg quieter",
  },
  "female-athletic-tease": {
    tag: "Cool-down",
    blurb: "Post-workout intervals · sweat + crotchless sport cut · hold the set",
  },
  "female-playful-brat": {
    tag: "Brat game",
    blurb: "Count games · look-but-don’t · cute denial with a laugh",
  },
};

export function mindFingerprint(characterId: string | null | undefined): MindFingerprint | null {
  if (!characterId) return null;
  if (FINGERPRINTS[characterId]) return FINGERPRINTS[characterId]!;
  if (characterId.startsWith("custom") || characterId.includes("custom")) {
    return {
      tag: "Yours",
      blurb: "Custom mind on a signature body base — stays true to their vibe",
    };
  }
  return null;
}
