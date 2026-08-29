"use client";

import type { CharacterCard } from "@/lib/character-card";

/**
 * Quiet live pulse — not a second filter row.
 */
export function GalleryLiveStrip({
  characters,
  resumeCount,
}: {
  characters: CharacterCard[];
  resumeCount: number;
}) {
  const total = characters.length;
  if (total === 0) return null;
  const packs = characters.filter((c) => c.dedicatedPack).length;

  return (
    <p
      className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-brand-muted"
      aria-label="Live catalog pulse"
    >
      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-100/90">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
        Live
      </span>
      <span>{total} minds</span>
      {packs > 0 ? <span>· {packs} in 4K</span> : null}
      {resumeCount > 0 ? <span>· {resumeCount} yours</span> : null}
    </p>
  );
}
