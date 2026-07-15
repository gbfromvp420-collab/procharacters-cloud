"use client";

import Link from "next/link";
import type { CharacterCard } from "@/lib/character-card";
import type { ResumeCacheEntry } from "@/lib/resume-cache";
import { canNativeShare } from "@/lib/share-links";

export function posterUrl(card: CharacterCard): string {
  const poster = card.posterClip;
  if (poster.startsWith("http") || poster.startsWith("/")) return poster;
  return `/${poster}`;
}

export function CharacterTile({
  card,
  onShareCard,
  onShareResume,
  resume,
  compact = false,
}: {
  card: CharacterCard;
  onShareCard: (card: CharacterCard) => void;
  onShareResume: (card: CharacterCard, resume: ResumeCacheEntry) => void;
  resume: ResumeCacheEntry | null;
  compact?: boolean;
}) {
  const poster = posterUrl(card);
  return (
    <article
      className={`group overflow-hidden rounded-2xl border border-brand-border bg-brand-panel shadow-card transition hover:border-brand-accent/60 hover:shadow-glow-sm active:scale-[0.99] ${
        compact ? "w-[min(72vw,16.5rem)] shrink-0 snap-start sm:w-[15rem]" : "animate-rise-in"
      }`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black">
        <video className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" src={poster} autoPlay muted loop playsInline preload="metadata" />
        {resume?.resumeCode && (
          <div className="absolute right-2 top-2 z-10">
            <span
              className="rounded-full border border-amber-400/50 bg-black/70 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-200 backdrop-blur"
              title={resume.source === "account" ? "Saved chat (account)" : "Saved chat on this device"}
            >
              {resume.resumeCode}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-14 sm:p-4 sm:pt-16">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent">
              {card.kind === "custom" ? "Custom" : "Signature"}
            </p>
            {card.featured && (
              <span className="rounded-full bg-brand-accent/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                Featured
              </span>
            )}
            {(card.vibeTag || card.energyLabel) && (
              <span className="rounded-full border border-white/25 bg-black/50 px-2 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur">
                {(card.vibeTag || card.energyLabel).split(",")[0]?.trim()}
              </span>
            )}
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-tight text-white sm:text-xl">{card.displayName}</h2>
        </div>
      </div>
      <div className={`space-y-2.5 ${compact ? "p-3" : "space-y-3 p-3 sm:p-4"}`}>
        <p className="line-clamp-2 text-xs text-brand-muted sm:text-sm">{card.teaser}</p>
        {!compact && card.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full border border-brand-border px-2 py-0.5 text-[10px] text-brand-muted">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className={`flex flex-wrap gap-2 ${compact ? "gap-1.5" : ""}`}>
          <Link href={card.ctaPath} className="btn-primary min-h-0 px-3 py-2 text-xs">Chat</Link>
          <Link href={card.cardPath} className="btn-ghost min-h-0 px-3 py-2 text-xs">Card</Link>
          {!compact && (
            <button
              type="button"
              onClick={() => onShareCard(card)}
              className="btn-ghost min-h-0 px-3 py-2 text-xs text-brand-muted hover:text-brand-text"
              title={canNativeShare() ? "Share card" : "Copy card link"}
            >
              {canNativeShare() ? "Share" : "Copy link"}
            </button>
          )}
          {resume?.resumeCode && (
            <>
              <Link
                href={`/chat?resume=${encodeURIComponent(resume.resumeCode)}&character=${encodeURIComponent(card.id)}`}
                className="btn-ghost min-h-0 border-amber-500/40 px-3 py-2 text-xs text-amber-200"
                title="Resume saved chat"
              >
                Resume
              </Link>
              {!compact && (
                <button
                  type="button"
                  onClick={() => onShareResume(card, resume)}
                  className="btn-ghost min-h-0 border-amber-500/30 px-3 py-2 text-xs text-amber-200/90"
                >
                  {canNativeShare() ? "Share resume" : "Copy resume"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
