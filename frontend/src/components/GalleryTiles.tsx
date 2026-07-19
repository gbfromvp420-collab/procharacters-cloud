"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CharacterCard } from "@/lib/character-card";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import { presenceVisual, resolvePresenceSkin } from "@/lib/presence";
import {
  buildResumeChatPath,
  formatResumeExpiryShort,
  isResumeExpiryUrgent,
  type ResumeCacheEntry,
} from "@/lib/resume-cache";
import { canNativeShare } from "@/lib/share-links";

export function posterUrl(card: CharacterCard): string {
  const poster = card.posterClip;
  if (poster.startsWith("http") || poster.startsWith("/")) return poster;
  return `/${poster}`;
}

/** Play video only while mostly on-screen — saves battery when scrolling a full roster. */
function useVisibleVideo(enabled = true) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = containerRef.current;
    const video = videoRef.current;
    if (!root || !video) return;

    let visible = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry?.isIntersecting && (entry.intersectionRatio ?? 0) > 0.12;
        if (visible) {
          void video.play().catch(() => {
            /* autoplay policy — ignore */
          });
        } else {
          video.pause();
        }
      },
      { root: null, rootMargin: "80px 0px", threshold: [0, 0.12, 0.35] },
    );
    io.observe(root);

    // Pause when tab is hidden
    const onVis = () => {
      if (document.hidden) video.pause();
      else if (visible) void video.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled]);

  return { containerRef, videoRef };
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
  const skin = resolvePresenceSkin(undefined, card.id);
  const visual = presenceVisual(skin);
  const expiryLabel = formatResumeExpiryShort(resume?.resumeExpiresAt);
  const urgent = isResumeExpiryUrgent(resume?.resumeExpiresAt);
  const { containerRef, videoRef } = useVisibleVideo(true);
  const first = card.displayName.trim().split(/\s+/)[0] || card.displayName;
  const mind = mindFingerprint(card.id);

  return (
    <article
      className={`group overflow-hidden rounded-2xl border border-brand-border bg-brand-panel shadow-card transition hover:border-brand-accent/60 hover:shadow-glow-sm active:scale-[0.99] ${
        compact ? "w-[min(72vw,16.5rem)] shrink-0 snap-start sm:w-[15rem]" : "animate-rise-in"
      } ${card.dedicatedPack ? "ring-1 ring-emerald-500/15" : ""}`}
    >
      <div
        ref={containerRef}
        className={`relative aspect-[3/4] overflow-hidden bg-black ${visual.glow}`}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          style={{ filter: visual.filter }}
          src={poster}
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${visual.wash}`}
          aria-hidden
        />
        {card.dedicatedPack && (
          <span
            className="pointer-events-none absolute left-2 top-2 z-10 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse"
            title="Dedicated 4K pack live"
            aria-hidden
          />
        )}
        {resume?.resumeCode && (
          <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
            <span
              className={`rounded-full border bg-black/70 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide backdrop-blur ${
                urgent
                  ? "border-rose-400/60 text-rose-100"
                  : "border-amber-400/50 text-amber-200"
              }`}
              title={
                resume.source === "account"
                  ? "Saved chat (account)"
                  : "Saved chat on this device"
              }
            >
              {resume.resumeCode}
            </span>
            {expiryLabel && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide backdrop-blur ${
                  urgent
                    ? "border-rose-400/50 bg-rose-950/80 text-rose-100"
                    : "border-amber-400/35 bg-black/70 text-amber-100/90"
                }`}
              >
                {expiryLabel}
              </span>
            )}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-14 sm:p-4 sm:pt-16">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent">
              {card.kind === "custom" ? "Custom" : "Signature"}
            </p>
            {card.featured && (
              <span className="rounded-full bg-brand-accent/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                Featured
              </span>
            )}
            {card.kind === "default" && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide backdrop-blur ${
                  card.dedicatedPack
                    ? "border-emerald-400/45 bg-emerald-500/25 text-emerald-50"
                    : "border-white/20 bg-black/45 text-white/70"
                }`}
                title={
                  card.dedicatedPack
                    ? "Dedicated 4-clip pack active"
                    : `Interim footage via ${card.avatarBase}`
                }
              >
                {card.dedicatedPack ? "4K pack" : "Interim"}
              </span>
            )}
            <span className="rounded-full border border-white/20 bg-black/45 px-2 py-0.5 text-[9px] font-medium text-white/85 backdrop-blur">
              {visual.label}
            </span>
            {(card.vibeTag || card.energyLabel) && (
              <span className="rounded-full border border-white/25 bg-black/50 px-2 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur">
                {(card.vibeTag || card.energyLabel).split(",")[0]?.trim()}
              </span>
            )}
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-tight text-white sm:text-xl">
            {card.displayName}
          </h2>
        </div>
      </div>
      <div className={`space-y-2.5 ${compact ? "p-3" : "space-y-3 p-3 sm:p-4"}`}>
        {mind && !compact && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
            Mind · {mind.tag}
            {mind.bilingual ? " · ES" : ""}
          </p>
        )}
        <p className="line-clamp-2 text-xs text-brand-muted sm:text-sm">
          {mind?.blurb || card.teaser}
        </p>
        {!compact && card.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-brand-border px-2 py-0.5 text-[10px] text-brand-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className={`flex flex-wrap gap-2 ${compact ? "gap-1.5" : ""}`}>
          {resume?.resumeCode ? (
            <>
              <Link
                href={buildResumeChatPath(resume)}
                className={`btn-primary min-h-0 px-3 py-2 text-xs ${urgent ? "ring-1 ring-rose-400/70" : ""}`}
                title={
                  expiryLabel
                    ? `Continue saved chat · ${expiryLabel}`
                    : "Continue saved chat"
                }
              >
                Continue
              </Link>
              <Link
                href={card.ctaPath}
                className="btn-ghost min-h-0 px-3 py-2 text-xs"
                title="Start a new session"
              >
                New chat
              </Link>
            </>
          ) : (
            <Link href={card.ctaPath} className="btn-primary min-h-0 px-3 py-2 text-xs">
              Chat{!compact ? ` · ${first}` : ""}
            </Link>
          )}
          <Link href={card.cardPath} className="btn-ghost min-h-0 px-3 py-2 text-xs">
            Card
          </Link>
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
          {resume?.resumeCode && !compact && (
            <button
              type="button"
              onClick={() => onShareResume(card, resume)}
              className="btn-ghost min-h-0 border-amber-500/30 px-3 py-2 text-xs text-amber-200/90"
            >
              {canNativeShare() ? "Share resume" : "Copy resume"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
