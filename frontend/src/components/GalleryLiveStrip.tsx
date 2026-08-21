"use client";

import type { CharacterCard } from "@/lib/character-card";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import { packLaneFor, type PackLane } from "@/lib/pack-lanes";

/**
 * Compact “what’s live” pulse under the gallery header — product confidence at a glance.
 * Chips are tappable filters when handlers are provided.
 */
export function GalleryLiveStrip({
  characters,
  resumeCount,
  onPacks,
  onPackLane,
  onMine,
  onOwned,
  onFeatured,
}: {
  characters: CharacterCard[];
  resumeCount: number;
  onPacks?: () => void;
  onPackLane?: (lane: PackLane) => void;
  onMine?: () => void;
  /** Filter to private My Characters */
  onOwned?: () => void;
  onFeatured?: () => void;
}) {
  const signature = characters.filter((c) => c.kind === "default").length;
  const packs = characters.filter((c) => c.dedicatedPack).length;
  const featured = characters.filter((c) => c.featured).length;
  const owned = characters.filter((c) => c.mine === true).length;
  const minds = characters.filter((c) => !!mindFingerprint(c.id)).length;
  const pack01 = characters.filter((c) => (c.packLane ?? packLaneFor(c.id)) === "01").length;
  const pack02 = characters.filter((c) => (c.packLane ?? packLaneFor(c.id)) === "02").length;
  const pack03 = characters.filter((c) => (c.packLane ?? packLaneFor(c.id)) === "03").length;

  type Chip = {
    label: string;
    tone: "accent" | "emerald" | "amber" | "muted" | "violet";
    onClick?: () => void;
  };

  const chips: Chip[] = [
    { label: `${signature} minds`, tone: "accent" },
    pack01 > 0
      ? {
          label: `Pack 01 · ${pack01}`,
          tone: "emerald",
          onClick: onPackLane ? () => onPackLane("01") : onPacks,
        }
      : null,
    pack02 > 0
      ? {
          label: `Pack 02 · ${pack02}`,
          tone: "emerald",
          onClick: onPackLane ? () => onPackLane("02") : onPacks,
        }
      : null,
    pack03 > 0
      ? {
          label: `Pack 03 · ${pack03}`,
          tone: "emerald",
          onClick: onPackLane ? () => onPackLane("03") : onPacks,
        }
      : null,
    packs > 0 ? { label: `${packs}× 4K`, tone: "emerald", onClick: onPacks } : null,
    featured > 0 ? { label: `${featured} featured`, tone: "accent", onClick: onFeatured } : null,
    owned > 0
      ? {
          label: `${owned} my model${owned === 1 ? "" : "s"}`,
          tone: "violet",
          onClick: onOwned,
        }
      : null,
    resumeCount > 0
      ? {
          label: `${resumeCount} your chat${resumeCount === 1 ? "" : "s"}`,
          tone: "amber",
          onClick: onMine,
        }
      : null,
    minds > 0 ? { label: "fingerprints on", tone: "muted" } : null,
  ].filter(Boolean) as Chip[];

  if (chips.length === 0) return null;

  const toneClass = (tone: Chip["tone"]) =>
    tone === "emerald"
      ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100/90"
      : tone === "amber"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-100/90"
        : tone === "violet"
          ? "border-violet-400/45 bg-violet-500/10 text-violet-100/90"
          : tone === "accent"
            ? "border-brand-accent/35 bg-brand-accent/10 text-brand-accent"
            : "border-brand-border bg-brand-panel text-brand-muted";

  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-2 animate-fade-in"
      aria-label="Live catalog pulse"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
        Live
      </span>
      {chips.map((c) =>
        c.onClick ? (
          <button
            key={c.label}
            type="button"
            onClick={c.onClick}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition hover:brightness-110 active:scale-[0.98] ${toneClass(c.tone)}`}
          >
            {c.label}
          </button>
        ) : (
          <span
            key={c.label}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${toneClass(c.tone)}`}
          >
            {c.label}
          </span>
        ),
      )}
    </div>
  );
}
