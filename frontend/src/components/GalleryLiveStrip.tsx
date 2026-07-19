"use client";

import type { CharacterCard } from "@/lib/character-card";
import { mindFingerprint } from "@/lib/mind-fingerprint";

/**
 * Compact “what’s live” pulse under the gallery header — product confidence at a glance.
 */
export function GalleryLiveStrip({
  characters,
  resumeCount,
}: {
  characters: CharacterCard[];
  resumeCount: number;
}) {
  const signature = characters.filter((c) => c.kind === "default").length;
  const packs = characters.filter((c) => c.dedicatedPack).length;
  const featured = characters.filter((c) => c.featured).length;
  const minds = characters.filter((c) => !!mindFingerprint(c.id)).length;

  const chips = [
    { label: `${signature} minds`, tone: "accent" as const },
    packs > 0 ? { label: `${packs}× 4K packs`, tone: "emerald" as const } : null,
    featured > 0 ? { label: `${featured} featured`, tone: "accent" as const } : null,
    resumeCount > 0
      ? { label: `${resumeCount} your chat${resumeCount === 1 ? "" : "s"}`, tone: "amber" as const }
      : null,
    minds > 0 ? { label: "fingerprints on", tone: "muted" as const } : null,
  ].filter(Boolean) as Array<{ label: string; tone: "accent" | "emerald" | "amber" | "muted" }>;

  if (chips.length === 0) return null;

  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-2 animate-fade-in"
      aria-label="Live catalog pulse"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
        Live
      </span>
      {chips.map((c) => (
        <span
          key={c.label}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${
            c.tone === "emerald"
              ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100/90"
              : c.tone === "amber"
                ? "border-amber-400/40 bg-amber-500/10 text-amber-100/90"
                : c.tone === "accent"
                  ? "border-brand-accent/35 bg-brand-accent/10 text-brand-accent"
                  : "border-brand-border bg-brand-panel text-brand-muted"
          }`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}
