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
