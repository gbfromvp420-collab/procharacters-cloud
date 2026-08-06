import type { AvatarState } from "@/lib/types";

export type EnergyBand = "idle" | "tease" | "play" | "edge";

/** Client-side band from avatar intent (mirrors server clip mapping). */
export function energyBandFromAvatar(avatar: AvatarState | null | undefined): EnergyBand {
  if (!avatar) return "idle";
  if (avatar.energyBand === "idle" || avatar.energyBand === "tease" || avatar.energyBand === "play" || avatar.energyBand === "edge") {
    return avatar.energyBand;
  }

  const e = (avatar.emotion || "").toLowerCase();
  const a = avatar.arousalLevel ?? 0;

  if (
    /arous|intense|breath|edg|domin|desper|puls|denial|close/.test(e) ||
    a >= 0.72
  ) {
    return "edge";
  }
  if (/play|brat|cocky|smirk|game|show|gym/.test(e)) return "play";
  if (/teas|seduc|flirt|shy|blush|whisper|submiss|soft_dom|invit/.test(e) || a >= 0.35) {
    return "tease";
  }
  return "idle";
}

export function energyBandLabel(band: EnergyBand): string {
  switch (band) {
    case "edge":
      return "Edge";
    case "play":
      return "Play";
    case "tease":
      return "Tease";
    default:
      return "Idle";
  }
}

export function energyBandRingClass(band: EnergyBand): string {
  switch (band) {
    case "edge":
      return "ring-rose-400/80 shadow-[0_0_20px_rgba(251,113,133,0.35)]";
    case "play":
      return "ring-amber-300/70 shadow-[0_0_16px_rgba(252,211,77,0.25)]";
    case "tease":
      return "ring-brand-accent/70 shadow-glow-sm";
    default:
      return "ring-brand-border/60";
  }
}

export function energyBandBadgeClass(band: EnergyBand): string {
  switch (band) {
    case "edge":
      return "border-rose-400/50 bg-rose-500/20 text-rose-100";
    case "play":
      return "border-amber-400/40 bg-amber-500/15 text-amber-100";
    case "tease":
      return "border-brand-accent/50 bg-brand-accent/15 text-brand-accent";
    default:
      return "border-brand-border bg-brand-bg/80 text-brand-muted";
  }
}

/** Full-room ambient wash for live chat shell by energy band. */
export function energyBandRoomClass(band: EnergyBand): string {
  switch (band) {
    case "edge":
      return "bg-[radial-gradient(ellipse_at_70%_10%,rgba(244,63,94,0.18),transparent_50%)]";
    case "play":
      return "bg-[radial-gradient(ellipse_at_70%_10%,rgba(251,191,36,0.14),transparent_50%)]";
    case "tease":
      return "bg-[radial-gradient(ellipse_at_70%_10%,rgba(225,29,143,0.14),transparent_50%)]";
    default:
      return "bg-[radial-gradient(ellipse_at_70%_10%,rgba(225,29,143,0.06),transparent_45%)]";
  }
}

/** DNA tree depth 0=spark … 5=gate — for sexy atmosphere. */
export function dnaTreeHeatLevel(
  nodeId?: string | null,
  label?: string | null,
): number {
  const key = `${nodeId ?? ""} ${label ?? ""}`.toLowerCase();
  if (!key.trim()) return -1;
  if (/release|gate/.test(key)) return 5;
  if (/deny/.test(key)) return 4;
  if (/edge/.test(key)) return 3;
  if (/tease/.test(key)) return 2;
  if (/soft/.test(key)) return 1;
  if (/spark/.test(key)) return 0;
  // Unknown DNA node — treat as soft heat
  return 1;
}

/**
 * Sexy DNA room wash layered on energy band — violet→rose as the tree climbs.
 * Returns extra class(es); empty when no DNA.
 */
export function dnaHeatRoomClass(
  nodeId?: string | null,
  label?: string | null,
): string {
  const level = dnaTreeHeatLevel(nodeId, label);
  if (level < 0) return "";
  switch (level) {
    case 5:
      return "dna-room-gate bg-[radial-gradient(ellipse_at_50%_0%,rgba(244,63,94,0.28),transparent_55%),radial-gradient(ellipse_at_80%_40%,rgba(167,139,250,0.16),transparent_50%)]";
    case 4:
      return "dna-room-deny bg-[radial-gradient(ellipse_at_60%_5%,rgba(139,92,246,0.26),transparent_52%),radial-gradient(ellipse_at_30%_80%,rgba(244,63,94,0.12),transparent_45%)]";
    case 3:
      return "dna-room-edge bg-[radial-gradient(ellipse_at_70%_8%,rgba(244,63,94,0.22),transparent_50%),radial-gradient(ellipse_at_20%_60%,rgba(167,139,250,0.14),transparent_48%)]";
    case 2:
      return "dna-room-tease bg-[radial-gradient(ellipse_at_65%_10%,rgba(192,132,252,0.2),transparent_52%),radial-gradient(ellipse_at_40%_90%,rgba(244,114,182,0.1),transparent_45%)]";
    case 1:
      return "bg-[radial-gradient(ellipse_at_60%_12%,rgba(167,139,250,0.14),transparent_50%)]";
    default:
      return "bg-[radial-gradient(ellipse_at_60%_12%,rgba(167,139,250,0.1),transparent_48%)]";
  }
}

/** Blend avatar energy wash with DNA climb atmosphere. */
export function liveRoomWashClass(
  band: EnergyBand,
  dnaNodeId?: string | null,
  dnaLabel?: string | null,
): string {
  const dna = dnaHeatRoomClass(dnaNodeId, dnaLabel);
  if (dna) return dna;
  return energyBandRoomClass(band);
}

/** SiteChrome / shell border heat when DNA is live. */
export function dnaChromeClass(
  nodeId?: string | null,
  label?: string | null,
): string {
  const level = dnaTreeHeatLevel(nodeId, label);
  if (level >= 4) {
    return "border-b-violet-400/50 shadow-[0_8px_32px_-10px_rgba(167,139,250,0.45)]";
  }
  if (level >= 3) {
    return "border-b-rose-400/45 shadow-[0_8px_28px_-12px_rgba(244,63,94,0.4)]";
  }
  if (level >= 2) {
    return "border-b-violet-400/40 shadow-[0_6px_24px_-12px_rgba(192,132,252,0.35)]";
  }
  if (level >= 0) {
    return "border-b-violet-400/30";
  }
  return "";
}

/** Composer field ring when DNA climb is hot. */
export function dnaComposerClass(
  nodeId?: string | null,
  label?: string | null,
): string {
  const level = dnaTreeHeatLevel(nodeId, label);
  if (level >= 4) {
    return "border-violet-400/55 focus:ring-violet-400/35 shadow-[0_0_24px_-8px_rgba(167,139,250,0.45)]";
  }
  if (level >= 3) {
    return "border-rose-400/50 focus:ring-rose-400/30 shadow-[0_0_20px_-8px_rgba(244,63,94,0.4)]";
  }
  if (level >= 2) {
    return "border-violet-400/45 focus:ring-violet-400/25";
  }
  if (level >= 0) {
    return "border-violet-400/30 focus:ring-violet-400/20";
  }
  return "";
}

/** Avatar video ring when DNA tree is live — overrides generic energy ring when hot. */
export function dnaAvatarRingClass(
  nodeId?: string | null,
  label?: string | null,
): string {
  const level = dnaTreeHeatLevel(nodeId, label);
  if (level >= 4) {
    return "ring-violet-400/85 shadow-[0_0_32px_rgba(167,139,250,0.5)]";
  }
  if (level >= 3) {
    return "ring-rose-400/80 shadow-[0_0_28px_rgba(244,63,94,0.45)]";
  }
  if (level >= 2) {
    return "ring-violet-400/70 shadow-[0_0_22px_rgba(192,132,252,0.4)]";
  }
  if (level >= 0) {
    return "ring-violet-400/55 shadow-[0_0_16px_rgba(167,139,250,0.28)]";
  }
  return "";
}

/** Short display label for DNA node chips. */
export function dnaNodeShortLabel(
  nodeId?: string | null,
  label?: string | null,
): string | null {
  const raw = (label?.trim() || nodeId?.trim() || "").trim();
  if (!raw) return null;
  return raw.split(/\s+/)[0] || raw.slice(0, 16);
}

/** Assistant bubble chrome when DNA tree is live. */
export function dnaAssistantBubbleClass(
  nodeId?: string | null,
  label?: string | null,
): string {
  const level = dnaTreeHeatLevel(nodeId, label);
  if (level >= 4) {
    return "border-violet-400/45 bg-gradient-to-br from-violet-500/20 via-brand-panel to-rose-500/10 shadow-[0_0_24px_-10px_rgba(167,139,250,0.45)]";
  }
  if (level >= 3) {
    return "border-rose-400/40 bg-gradient-to-br from-rose-500/15 via-brand-panel to-violet-500/10 shadow-[0_0_20px_-10px_rgba(244,63,94,0.4)]";
  }
  if (level >= 2) {
    return "border-violet-400/35 bg-gradient-to-br from-violet-500/12 via-brand-panel to-brand-panel";
  }
  if (level >= 0) {
    return "border-violet-400/25 bg-brand-panel/95";
  }
  return "";
}

/** User bubble ring when DNA is mid-climb+ (your heat is in the tree). */
export function dnaUserBubbleClass(
  nodeId?: string | null,
  label?: string | null,
): string {
  const level = dnaTreeHeatLevel(nodeId, label);
  if (level >= 3) {
    return "ring-1 ring-violet-300/40 shadow-[0_0_18px_-6px_rgba(167,139,250,0.5)]";
  }
  if (level >= 1) {
    return "ring-1 ring-violet-400/25";
  }
  return "";
}
