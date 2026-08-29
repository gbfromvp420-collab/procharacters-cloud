"use client";

import type { CharacterCard } from "@/lib/character-card";

/**
 * One-line live pulse — not a second filter row.
 */
export function GalleryLiveStrip({
  characters,
  resumeCount,
}: {
  characters: CharacterCard[];
  resumeCount: number;
}) {
  const packs = characters.filter((c) => c.dedicatedPack).length;
  const owned = characters.filter((c) => c.mine === true).length;

  const bits = [
    `${characters.length} mind${characters.length === 1 ? "" : "s"}`,
    packs > 0 ? `${packs} in 4K` : null,
    owned > 0 ? `${owned} yours` : null,
    resumeCount > 0 ? `${resumeCount} chat${resumeCount === 1 ? "" : "s"} saved` : null,
  ].filter(Boolean);

  if (characters.length === 0) return null;

  return (
    <p
      className="mb-4 flex items-center gap-2 text-[11px] text-brand-muted animate-fade-in"
      aria-label="Live catalog pulse"
    >
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
        Live
      </span>
      <span className="text-brand-border">·</span>
      <span>{bits.join(" · ")}</span>
    </p>
  );
}
