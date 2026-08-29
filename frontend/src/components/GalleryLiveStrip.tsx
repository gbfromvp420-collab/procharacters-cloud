"use client";

import type { CharacterCard } from "@/lib/character-card";

/**
 * Quiet live pulse — one line of catalog confidence, not a second filter row.
 */
export function GalleryLiveStrip({
  characters,
  resumeCount,
}: {
  characters: CharacterCard[];
  resumeCount: number;
  onPacks?: () => void;
  onPackLane?: (lane: "01" | "02" | "03") => void;
  onMine?: () => void;
  onOwned?: () => void;
  onFeatured?: () => void;
}) {
  const minds = characters.length;
  if (minds === 0) return null;

  const parts = [
    `${minds} mind${minds === 1 ? "" : "s"}`,
    resumeCount > 0 ? `${resumeCount} saved` : null,
  ].filter(Boolean);

  return (
    <p
      className="mb-6 flex items-center gap-2 text-[11px] text-brand-muted animate-fade-in"
      aria-label="Live catalog pulse"
    >
      <span className="inline-flex items-center gap-1.5 text-emerald-200/90">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
        Live
      </span>
      <span className="text-brand-border">·</span>
      <span>{parts.join(" · ")}</span>
    </p>
  );
}
