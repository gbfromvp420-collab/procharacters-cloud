/**
 * Client presence grades — atmosphere when models share interim base footage.
 * Keys must match backend presenceSkin values.
 */

export type PresenceSkin =
  | "twink_default"
  | "twink_shy"
  | "twink_gym"
  | "twink_punk"
  | "female_default"
  | "female_goth"
  | "female_athletic"
  | "female_brat"
  | "custom"
  | string;

export interface PresenceVisual {
  /** CSS filter on the video layer */
  filter: string;
  /** Soft color wash over the frame */
  wash: string;
  /** Corner vignette / glow */
  glow: string;
  /** Short label chip (optional UI) */
  label: string;
}

const SKINS: Record<string, PresenceVisual> = {
  twink_default: {
    label: "Slow edge",
    filter: "saturate(1.05) contrast(1.04)",
    wash: "from-rose-500/10 via-transparent to-transparent",
    glow: "shadow-[inset_0_0_40px_rgba(244,63,94,0.12)]",
  },
  twink_shy: {
    label: "Shy heat",
    filter: "saturate(0.92) brightness(1.04) contrast(0.98)",
    wash: "from-pink-300/20 via-transparent to-violet-400/10",
    glow: "shadow-[inset_0_0_48px_rgba(244,114,182,0.18)]",
  },
  twink_gym: {
    label: "Post-set",
    filter: "saturate(1.12) contrast(1.08) brightness(1.02)",
    wash: "from-amber-400/15 via-transparent to-orange-600/10",
    glow: "shadow-[inset_0_0_40px_rgba(251,191,36,0.14)]",
  },
  twink_punk: {
    label: "Mesh brat",
    filter: "saturate(1.15) contrast(1.1) hue-rotate(-8deg)",
    wash: "from-fuchsia-500/15 via-transparent to-cyan-400/10",
    glow: "shadow-[inset_0_0_44px_rgba(217,70,239,0.16)]",
  },
  female_default: {
    label: "Tease",
    filter: "saturate(1.06) contrast(1.03)",
    wash: "from-rose-400/12 via-transparent to-transparent",
    glow: "shadow-[inset_0_0_40px_rgba(251,113,133,0.12)]",
  },
  female_goth: {
    label: "Soft goth",
    filter: "saturate(0.88) contrast(1.06) brightness(0.96)",
    wash: "from-violet-700/25 via-transparent to-fuchsia-900/15",
    glow: "shadow-[inset_0_0_52px_rgba(109,40,217,0.22)]",
  },
  female_athletic: {
    label: "Cool-down",
    filter: "saturate(1.1) contrast(1.07) brightness(1.03)",
    wash: "from-sky-400/12 via-transparent to-emerald-500/10",
    glow: "shadow-[inset_0_0_40px_rgba(56,189,248,0.12)]",
  },
  female_brat: {
    label: "Brat game",
    filter: "saturate(1.14) contrast(1.05) brightness(1.04)",
    wash: "from-pink-400/18 via-transparent to-amber-300/10",
    glow: "shadow-[inset_0_0_44px_rgba(244,114,182,0.16)]",
  },
  custom: {
    label: "Yours",
    filter: "saturate(1.04) contrast(1.02)",
    wash: "from-brand-accent/12 via-transparent to-transparent",
    glow: "shadow-[inset_0_0_36px_rgba(168,85,247,0.12)]",
  },
};

const FALLBACK: PresenceVisual = SKINS.twink_default!;

/** Resolve skin from server avatar or character id fallback. */
export function resolvePresenceSkin(
  presenceSkin?: string | null,
  characterId?: string | null,
): PresenceSkin {
  if (presenceSkin && SKINS[presenceSkin]) return presenceSkin;
  if (!characterId) return "twink_default";
  const map: Record<string, PresenceSkin> = {
    "twink-default": "twink_default",
    "twink-shy-boy": "twink_shy",
    "twink-gym": "twink_gym",
    "twink-alt-punk": "twink_punk",
    "female-default": "female_default",
    "female-soft-goth": "female_goth",
    "female-athletic-tease": "female_athletic",
    "female-playful-brat": "female_brat",
  };
  if (map[characterId]) return map[characterId]!;
  if (characterId.startsWith("custom-") || characterId.includes("custom")) return "custom";
  if (characterId.includes("female")) return "female_default";
  return "twink_default";
}

export function presenceVisual(skin: PresenceSkin): PresenceVisual {
  return SKINS[skin] ?? FALLBACK;
}

/** Subtle scale pulse by energy band — feels more “alive” without new MP4s. */
export function presenceMotionClass(band: "idle" | "tease" | "play" | "edge"): string {
  switch (band) {
    case "edge":
      return "scale-[1.03] duration-700";
    case "play":
      return "scale-[1.02] duration-700";
    case "tease":
      return "scale-[1.01] duration-700";
    default:
      return "scale-100 duration-1000";
  }
}
