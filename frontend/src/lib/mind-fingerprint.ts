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
    tag: "Gooner guide",
    blurb:
      "Cruz · sheer-pouch cam boy · slow fabric handjob denial · soft Spanish when it hits",
    bilingual: true,
  },
  "female-default": {
    tag: "Gooner guide",
    blurb: "Vesper · crotchless soft-dom · hover then deny · intimate, not giggly",
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
  "jenny": {
    tag: "Slow hover",
    blurb: "Jenny · hover first · open-panel still-life · don’t rush her",
  },
  "sarah": {
    tag: "Soft wait",
    blurb: "Sarah · soft-dom wait · she decides the next inch",
  },
  "jessica": {
    tag: "Smirk deny",
    blurb: "Jessica · playful smirk · almost, then no",
  },
  "rachel": {
    tag: "Quiet heat",
    blurb: "Rachel · quiet intensity · fewer words, more shine",
  },
  "samantha": {
    tag: "Warm drip",
    blurb: "Samantha · warm slow drip · praise her and she leaks more",
  },
  "becca": {
    tag: "Giggle deny",
    blurb: "Becca · bratty giggle · she laughs when you beg",
  },
  "peter": {
    tag: "Slow pouch",
    blurb: "Peter · slow fabric edge · one finger on the sheer, then stop",
  },
  "gary": {
    tag: "Smirk edge",
    blurb: "Gary · confident smirk · he knows you’re watching the bulge",
  },
  "justin": {
    tag: "Clean deny",
    blurb: "Justin · clean-cut denial · polite voice, filthy hold",
  },
  "mark": {
    tag: "Low voice",
    blurb: "Mark · low-voice edge · almost a whisper when it gets wet",
  },
  "blake": {
    tag: "Interval",
    blurb: "Blake · cocky interval · ten seconds on, freeze",
  },
  "tommy": {
    tag: "Eager heat",
    blurb: "Tommy · eager puppy · too ready, you make him wait",
  },
  "kenny": {
    tag: "Mean-soft",
    blurb: "Kenny · mean-soft tease · he’ll be nice after you beg",
  },
  "liam": {
    tag: "Spotlight",
    blurb: "Liam · spotlight slow edge · he performs the hold",
  },
  "noah": {
    tag: "Soft talk",
    blurb: "Noah · soft-talk denial · sweet voice, filthy stop",
  },
  "ethan": {
    tag: "Steady cam",
    blurb: "Ethan · steady cam edge · same pace, no mercy",
  },
  "mason": {
    tag: "Heavy breath",
    blurb: "Mason · heavy-breath edge · you hear it before he talks",
  },
  "lucas": {
    tag: "Shy show",
    blurb: "Lucas · shy show-off · peeks, then holds it out",
  },
  "logan": {
    tag: "Grit hold",
    blurb: "Logan · grit-and-hold · jaw tight, won’t finish",
  },
  "aiden": {
    tag: "Stop-start",
    blurb: "Aiden · stop-start tease · two strokes, freeze, grin",
  },
  "jackson": {
    tag: "Cocky hold",
    blurb: "Jackson · cocky hold · he dares you to look away",
  },
  "jacob": {
    tag: "Quiet leak",
    blurb: "Jacob · quiet leak · almost no talk, just shine",
  },
  "jayden": {
    tag: "Play dare",
    blurb: "Jayden · playful dare · he bets you blink first",
  },
  "elijah": {
    tag: "Slow ritual",
    blurb: "Elijah · slow ritual · same motion, deeper each pass",
  },
  "carter": {
    tag: "Rep hold",
    blurb: "Carter · interval hold · one more rep, then freeze",
  },
  "wyatt": {
    tag: "Rough-soft",
    blurb: "Wyatt · rough-soft edge · grit first, then gentle",
  },
  "hunter": {
    tag: "Chase deny",
    blurb: "Hunter · chase-and-deny · he lets you almost catch it",
  },
  "alex": {
    tag: "Easy smirk",
    blurb: "Alex · easy smirk cam · casual, filthy, unbothered",
  },
  "emma": {
    tag: "Honey deny",
    blurb: "Emma · honey-slow denial · sweet voice, locked hips",
  },
  "olivia": {
    tag: "Still-life",
    blurb: "Olivia · still-life tease · she barely moves and it still wrecks you",
  },
  "ava": {
    tag: "Sharp wait",
    blurb: "Ava · sharp wait · one look and you freeze",
  },
  "sophia": {
    tag: "Velvet",
    blurb: "Sophia · velvet hover · expensive patience",
  },
  "isabella": {
    tag: "Ritual",
    blurb: "Isabella · ritual tease · same slow pass, then hold",
  },
  "mia": {
    tag: "Brat spark",
    blurb: "Mia · brat spark · she steals the pace and laughs",
  },
  "charlotte": {
    tag: "Cool hold",
    blurb: "Charlotte · cool hold · composed, soaked, in charge",
  },
  "amelia": {
    tag: "Soft ask",
    blurb: "Amelia · soft-ask denial · she’ll give more if you ask right",
  },
  "harper": {
    tag: "Fresh heat",
    blurb: "Harper · fresh heat · just-on-cam, already shiny",
  },
  "evelyn": {
    tag: "Quiet shine",
    blurb: "Evelyn · quiet shine · almost still, almost dripping",
  },
  "avery": {
    tag: "Play dare",
    blurb: "Avery · play dare · she bets you won’t last the hover",
  },
  "scarlett": {
    tag: "Mean-sweet",
    blurb: "Scarlett · mean-sweet edge · honey, then no",
  },
  "zoey": {
    tag: "Bounce deny",
    blurb: "Zoey · bounce-and-deny · energy up, then she steals it",
  },
  "aria": {
    tag: "Hypnotic",
    blurb: "Aria · hypnotic hover · same slow sway, beg quieter",
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
