"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type { MediaClipKey } from "@/lib/types";

export function posterUrl(card: CharacterCard): string {
  const poster = card.posterClip;
  if (poster.startsWith("http") || poster.startsWith("/")) return poster;
  return `/${poster}`;
}

function clipUrl(path: string | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  return `/${path}`;
}

/** Cycle idle → teasing → playful for “live now” feel when multiple clips exist. */
function useClipRotation(
  card: CharacterCard,
  enabled: boolean,
): { src: string; bandLabel: string | null } {
  const sequence = useMemo(() => {
    const keys: MediaClipKey[] = ["idle", "teasing", "playful", "aroused"];
    const out: Array<{ key: MediaClipKey; url: string }> = [];
    for (const k of keys) {
      const url = clipUrl(card.clips?.[k]);
      if (url) out.push({ key: k, url });
    }
    // Dedupe identical URLs (interim packs often share one file)
    const seen = new Set<string>();
    const unique = out.filter((c) => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });
    if (unique.length === 0) {
      const p = posterUrl(card);
      return p ? [{ key: "teasing" as MediaClipKey, url: p }] : [];
    }
    return unique;
  }, [card]);

  // Stagger start so featured strip doesn’t sync-march
  const [index, setIndex] = useState(() => {
    if (typeof window === "undefined" || sequence.length < 2) return 0;
    let h = 0;
    for (const ch of card.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % sequence.length;
  });

  useEffect(() => {
    if (!enabled || sequence.length < 2) return;
    // Featured / dedicated: rotate a bit faster for “alive” gallery energy
    const ms = card.featured || card.dedicatedPack ? 7800 : 11000;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % sequence.length);
    }, ms);
    return () => window.clearInterval(t);
  }, [enabled, sequence.length, card.featured, card.dedicatedPack]);

  const current = sequence[Math.min(index, sequence.length - 1)];
  const bandLabel =
    sequence.length > 1 && current
      ? current.key === "idle"
        ? "idle"
        : current.key === "teasing"
          ? "tease"
          : current.key === "playful"
            ? "play"
            : current.key === "aroused"
              ? "edge"
              : null
      : null;

  return {
    src: current?.url || posterUrl(card),
    bandLabel,
  };
}

/** Play video only while mostly on-screen — saves battery when scrolling a full roster. */
function useVisibleVideo(enabled = true) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const root = containerRef.current;
    const video = videoRef.current;
    if (!root || !video) return;

    let isVisible = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = !!entry?.isIntersecting && (entry.intersectionRatio ?? 0) > 0.12;
        setVisible(isVisible);
        if (isVisible) {
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

    const onVis = () => {
      if (document.hidden) video.pause();
      else if (isVisible) void video.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled]);

  return { containerRef, videoRef, visible };
}

export function CharacterTile({
  card,
  onShareCard,
  onShareResume,
  resume,
  compact = false,
  searchHighlight = false,
}: {
  card: CharacterCard;
  onShareCard: (card: CharacterCard) => void;
  onShareResume: (card: CharacterCard, resume: ResumeCacheEntry) => void;
  resume: ResumeCacheEntry | null;
  compact?: boolean;
  /** Soft pulse when this tile matched a mind search */
  searchHighlight?: boolean;
}) {
  const skin = resolvePresenceSkin(undefined, card.id);
  const visual = presenceVisual(skin);
  const expiryLabel = formatResumeExpiryShort(resume?.resumeExpiresAt);
  const urgent = isResumeExpiryUrgent(resume?.resumeExpiresAt);
  const { containerRef, videoRef, visible } = useVisibleVideo(true);
  const { src, bandLabel } = useClipRotation(card, visible);
  const first = card.displayName.trim().split(/\s+/)[0] || card.displayName;
  const mind = mindFingerprint(card.id, {
    displayName: card.displayName,
    energyLabel: card.energyLabel || card.vibeTag,
  });

  // Smooth src swap without blank frame
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    if (video.getAttribute("src") === src) return;
    const wasPlaying = !video.paused;
    video.src = src;
    video.load();
    if (wasPlaying || visible) {
      void video.play().catch(() => {});
    }
  }, [src, videoRef, visible]);

  return (
    <article
      className={`group overflow-hidden rounded-2xl border border-brand-border bg-brand-panel shadow-card transition hover:border-brand-accent/60 hover:shadow-glow-sm active:scale-[0.99] ${
        compact ? "w-[min(72vw,16.5rem)] shrink-0 snap-start sm:w-[15rem]" : "animate-rise-in"
      } ${card.dedicatedPack ? "ring-1 ring-emerald-500/15" : ""} ${
        card.mine ? "ring-1 ring-violet-400/25" : ""
      } ${searchHighlight ? "ring-2 ring-brand-accent/50 shadow-glow-sm" : ""}`}
    >
      <div
        ref={containerRef}
        className={`relative aspect-[3/4] overflow-hidden bg-black ${visual.glow}`}
      >
        {/* Poster is the primary path: continue when resume exists, else chat */}
        <Link
          href={
            resume?.resumeCode
              ? buildResumeChatPath(resume)
              : card.ctaPath
          }
          className="absolute inset-0 z-[2] block"
          aria-label={
            resume?.resumeCode
              ? `Continue chat with ${card.displayName}`
              : `Chat with ${card.displayName}`
          }
        >
          <span className="sr-only">
            {resume?.resumeCode ? "Continue" : "Chat"} {card.displayName}
          </span>
        </Link>
        <video
          ref={videoRef}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          style={{ filter: visual.filter }}
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
        {card.mine && (
          <span
            className="pointer-events-none absolute right-2 top-2 z-10 rounded-full border border-violet-300/50 bg-violet-600/85 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur"
            title="Private My Character — only you"
          >
            Mine
          </span>
        )}
        {bandLabel && (
          <span className="pointer-events-none absolute left-2 bottom-[4.5rem] z-10 rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur sm:bottom-20">
            Live · {bandLabel}
          </span>
        )}
        {resume?.resumeCode && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-14 sm:p-4 sm:pt-16">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent">
              {card.mine
                ? "My model"
                : card.kind === "custom"
                  ? "Custom"
                  : "Signature"}
            </p>
            {card.mine && (
              <span className="rounded-full border border-violet-300/50 bg-violet-500/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                Private
              </span>
            )}
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
          {resume?.resumeCode && (resume.heatDepth || resume.heatChips?.length) ? (
            <div className="mt-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {resume.heatDepth && (
                  <span className="rounded-full border border-rose-400/40 bg-rose-500/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-50">
                    {resume.heatDepth}
                  </span>
                )}
                {resume.mindTag && (
                  <span className="rounded-full border border-white/20 bg-black/45 px-1.5 py-0.5 text-[9px] text-white/85">
                    {resume.mindTag}
                  </span>
                )}
                {typeof resume.messageCount === "number" && resume.messageCount > 0 && (
                  <span className="font-mono text-[9px] text-white/70">
                    {resume.messageCount}m
                  </span>
                )}
              </div>
              {resume.heatChips && resume.heatChips.length > 0 && (
                <p className="line-clamp-1 text-[10px] text-amber-100/85">
                  {resume.heatChips.slice(0, 3).join(" · ")}
                </p>
              )}
              {resume.recapLine && (
                <p className="line-clamp-1 text-[10px] italic text-white/75">
                  “{resume.recapLine}”
                </p>
              )}
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-100/90">
                {urgent ? "Tap to reclaim →" : "Heat trail · continue →"}
              </p>
            </div>
          ) : resume?.resumeCode ? (
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-100/90">
              {urgent ? "Tap to reclaim →" : "Tap to continue →"}
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/0 transition group-hover:text-white/80">
              Tap to heat →
            </p>
          )}
        </div>
        {/* Sexy hover veil */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-brand-accent/25 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <div className={`space-y-2.5 ${compact ? "p-3" : "space-y-3 p-3 sm:p-4"}`}>
        {mind && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
            Mind · {mind.tag}
            {mind.bilingual ? " · ES" : ""}
          </p>
        )}
        <p className={`text-xs text-brand-muted sm:text-sm ${compact ? "line-clamp-1" : "line-clamp-2"}`}>
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
          {card.edgePacePath && !resume?.resumeCode && (
            <Link
              href={card.edgePacePath}
              className="btn-ghost min-h-0 border-rose-400/40 px-3 py-2 text-xs text-rose-100"
              title="Start Edge Pace with this model"
            >
              Edge
            </Link>
          )}
          {card.mine && (
            <Link
              href={`/models/studio/edit/${encodeURIComponent(card.id)}`}
              className="btn-ghost min-h-0 border-violet-400/40 px-3 py-2 text-xs text-violet-100"
              title="Edit My Character identity, vibe, clips"
            >
              Edit
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
