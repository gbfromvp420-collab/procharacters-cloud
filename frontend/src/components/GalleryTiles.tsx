"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterCard } from "@/lib/character-card";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import { presenceVisual, resolvePresenceSkin } from "@/lib/presence";
import {
  buildForgeFromHeatPath,
  shouldOfferForgeFromHeat,
  stashForgeHeatSeed,
} from "@/lib/forge-from-heat";
import {
  buildResumeChatPath,
  formatResumeExpiryShort,
  isResumeExpiryUrgent,
  type ResumeCacheEntry,
} from "@/lib/resume-cache";
import { pickPosterMark } from "@/lib/tile-chrome";
import { canNativeShare } from "@/lib/share-links";
import type { MediaClipKey } from "@/lib/types";
import { MoreMenu } from "./MoreMenu";

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

  // Forge this heat — DNA-hot / deep trail → Studio seed (mirrors SessionWinToast)
  const dnaLabel =
    resume?.dnaTreeLabel?.trim() || resume?.dnaTreeNodeId?.trim() || null;
  const offerForge =
    !!resume &&
    shouldOfferForgeFromHeat({
      messageCount: resume.messageCount,
      dnaTreeLabel: resume.dnaTreeLabel,
      dnaTreeNodeId: resume.dnaTreeNodeId,
      heatDepth: resume.heatDepth,
    });
  const forgeHeatCtx = offerForge && resume
    ? {
        characterId: card.id,
        characterName: card.displayName,
        baseModelId:
          card.avatarBase ||
          (card.id.startsWith("custom-") ? undefined : card.id),
        dnaTreeLabel: resume.dnaTreeLabel,
        dnaTreeNodeId: resume.dnaTreeNodeId,
        heatDepth: resume.heatDepth,
        heatChips: resume.heatChips,
        recapLine: resume.recapLine,
        messageCount: resume.messageCount,
        isMine: card.mine === true,
      }
    : null;
  const forgeHref =
    forgeHeatCtx != null ? buildForgeFromHeatPath(forgeHeatCtx) : null;

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
        {(() => {
          const mark = pickPosterMark({
            mine: card.mine,
            dedicatedPack: card.dedicatedPack,
            featured: card.featured,
          });
          if (!mark) return null;
          const markClass =
            mark.kind === "mine"
              ? "border-violet-300/50 bg-violet-600/85 text-white"
              : mark.kind === "pack"
                ? "border-emerald-400/40 bg-emerald-500/25 text-emerald-50"
                : "border-brand-accent/40 bg-brand-accent/90 text-white";
          return (
            <span
              className={`pointer-events-none absolute left-2.5 top-2.5 z-10 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur ${markClass}`}
            >
              {mark.label}
            </span>
          );
        })()}
        {resume?.resumeCode && (
          <span
            className={`pointer-events-none absolute right-2.5 top-2.5 z-10 rounded-full border bg-black/70 px-2 py-0.5 font-mono text-[10px] font-semibold backdrop-blur ${
              urgent ? "border-rose-400/60 text-rose-100" : "border-amber-400/50 text-amber-200"
            }`}
            title={expiryLabel ? `Saved chat · ${expiryLabel}` : "Saved chat"}
          >
            {urgent ? "Reclaim" : resume.resumeCode}
          </span>
        )}
        {bandLabel && (
          <span className="pointer-events-none absolute left-2.5 top-10 z-10 text-[9px] font-medium uppercase tracking-[0.16em] text-white/55">
            Live · {bandLabel}
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/85 via-black/25 to-transparent px-3 pb-3 pt-16">
          <h2 className="text-lg font-semibold leading-tight text-white sm:text-xl">
            {card.displayName}
          </h2>
          {(mind?.tag || resume?.heatDepth) && (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-white/70">
              {resume?.heatDepth ? resume.heatDepth : mind?.tag}
              {resume?.recapLine ? ` · ${resume.recapLine}` : ""}
            </p>
          )}
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-brand-accent/20 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <div className={`space-y-2.5 ${compact ? "p-2.5" : "p-3"}`}>
        <p className={`text-xs leading-relaxed text-brand-muted ${compact ? "line-clamp-1" : "line-clamp-2"}`}>
          {mind?.blurb || card.teaser}
        </p>
        <div className="flex items-center gap-2">
          {resume?.resumeCode ? (
            <Link
              href={buildResumeChatPath(resume)}
              className={`btn-primary min-h-0 px-3 py-2 text-xs ${urgent ? "ring-1 ring-rose-400/70" : ""}`}
              title={expiryLabel ? `Continue · ${expiryLabel}` : "Continue saved chat"}
            >
              {urgent ? "Reclaim" : "Continue"}
            </Link>
          ) : (
            <Link href={card.ctaPath} className="btn-primary min-h-0 px-3 py-2 text-xs">
              Chat{!compact ? ` · ${first}` : ""}
            </Link>
          )}
          <MoreMenu>
            {resume?.resumeCode ? (
              <Link href={card.ctaPath} role="menuitem">
                New chat
              </Link>
            ) : null}
            <Link href={card.cardPath} role="menuitem">
              Full card
            </Link>
            {card.mine ? (
              <Link href={`/models/studio/edit/${encodeURIComponent(card.id)}`} role="menuitem">
                Edit model
              </Link>
            ) : null}
            {forgeHref && forgeHeatCtx ? (
              <Link
                href={forgeHref}
                role="menuitem"
                onClick={() => stashForgeHeatSeed(forgeHeatCtx)}
              >
                {dnaLabel ? `Forge · ${dnaLabel}` : "Forge this heat"}
              </Link>
            ) : null}
            {card.edgePacePath && !resume?.resumeCode ? (
              <Link href={card.edgePacePath} role="menuitem">
                Edge Pace
              </Link>
            ) : null}
            <button type="button" role="menuitem" onClick={() => onShareCard(card)}>
              {canNativeShare() ? "Share card" : "Copy card link"}
            </button>
            {resume?.resumeCode ? (
              <button type="button" role="menuitem" onClick={() => onShareResume(card, resume)}>
                {canNativeShare() ? "Share resume" : "Copy resume"}
              </button>
            ) : null}
          </MoreMenu>
        </div>
      </div>
    </article>
  );
}
