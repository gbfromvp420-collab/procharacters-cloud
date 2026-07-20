"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterCard } from "@/lib/character-card";
import { calendarDaySeed, mindFingerprint, seededShuffle } from "@/lib/mind-fingerprint";
import {
  buildForgeFromHeatPath,
  shouldOfferForgeFromHeat,
  stashForgeHeatSeed,
} from "@/lib/forge-from-heat";
import {
  buildResumeChatPath,
  type ResumeCacheEntry,
} from "@/lib/resume-cache";
import { posterUrl } from "./GalleryTiles";

const ROTATE_MS = 7000;
const CROSSFADE_MS = 700;
const SWIPE_PX = 48;

/**
 * Prefer featured dedicated packs, then any featured, then rest with posters.
 * Order is seeded by UTC calendar day so “tonight’s cast” rotates without jitter mid-day.
 * When the user has resumes, those minds lead the reel (return loop first).
 */
export function pickHeroCast(
  characters: CharacterCard[],
  daySeed = calendarDaySeed(),
  resumeIds?: Set<string> | string[],
): CharacterCard[] {
  const withPoster = characters.filter((c) => !!c.posterClip);
  if (withPoster.length === 0) return [];

  const resumeSet =
    resumeIds instanceof Set
      ? resumeIds
      : new Set((resumeIds ?? []).filter(Boolean));

  const featuredDedicated = withPoster.filter((c) => c.featured && c.dedicatedPack);
  const featured = withPoster.filter((c) => c.featured);
  const dedicated = withPoster.filter((c) => c.dedicatedPack);
  const pool =
    featuredDedicated.length >= 2
      ? featuredDedicated
      : featured.length >= 2
        ? featured
        : dedicated.length >= 2
          ? dedicated
          : withPoster;

  // Featured stay in the front half; each tier shuffles with the day seed.
  const featuredPool = pool.filter((c) => c.featured);
  const restPool = pool.filter((c) => !c.featured);
  let ordered = [
    ...seededShuffle(featuredPool, daySeed),
    ...seededShuffle(restPool, daySeed + 17),
  ];

  // Personalize: your chats first, then the nightly cast order
  if (resumeSet.size > 0) {
    const yours = ordered.filter((c) => resumeSet.has(c.id));
    const rest = ordered.filter((c) => !resumeSet.has(c.id));
    ordered = [...yours, ...rest];
  }
  return ordered;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function GalleryHeroReel({
  characters,
  resumes = {},
}: {
  characters: CharacterCard[];
  /** When set for the active hero, primary CTA becomes Continue. */
  resumes?: Record<string, ResumeCacheEntry>;
}) {
  const cast = useMemo(() => {
    const resumeIds = Object.keys(resumes).filter((id) => !!resumes[id]?.resumeCode);
    return pickHeroCast(characters, calendarDaySeed(), resumeIds);
  }, [characters, resumes]);
  const [index, setIndex] = useState(0);
  const [outgoing, setOutgoing] = useState<CharacterCard | null>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const goLock = useRef(false);
  const fadeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    if (index >= cast.length) setIndex(0);
  }, [cast.length, index]);

  useEffect(() => {
    return () => {
      if (fadeTimer.current != null) window.clearTimeout(fadeTimer.current);
    };
  }, []);

  const goTo = useCallback(
    (nextRaw: number) => {
      if (cast.length === 0 || goLock.current) return;
      const next = ((nextRaw % cast.length) + cast.length) % cast.length;
      if (next === index) return;

      const leaving = cast[index] ?? null;

      if (reducedMotion || !leaving) {
        setIndex(next);
        setOutgoing(null);
        setProgressKey((k) => k + 1);
        return;
      }

      goLock.current = true;
      setOutgoing(leaving);
      setIndex(next);
      setProgressKey((k) => k + 1);
      if (fadeTimer.current != null) window.clearTimeout(fadeTimer.current);
      fadeTimer.current = window.setTimeout(() => {
        setOutgoing(null);
        goLock.current = false;
        fadeTimer.current = null;
      }, CROSSFADE_MS);
    },
    [cast, index, reducedMotion],
  );

  const go = useCallback(
    (dir: 1 | -1) => {
      if (cast.length === 0) return;
      goTo(index + dir);
    },
    [cast.length, goTo, index],
  );

  useEffect(() => {
    if (paused || reducedMotion || cast.length < 2) return;
    const t = window.setInterval(() => {
      goTo(index + 1);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [paused, reducedMotion, cast.length, goTo, index]);

  // Preload next poster so rotation feels instant
  useEffect(() => {
    if (cast.length < 2 || typeof document === "undefined") return;
    const next = cast[(index + 1) % cast.length];
    if (!next) return;
    const url = posterUrl(next);
    if (!url || !/\.mp4(\?|$)/i.test(url)) return;
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.load();
    return () => {
      v.removeAttribute("src");
      try {
        v.load();
      } catch {
        /* ignore */
      }
    };
  }, [cast, index]);

  // Desktop: arrow keys when reel is hovered/focused (paused)
  useEffect(() => {
    if (!paused || cast.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, cast.length, go]);

  if (cast.length === 0) return null;

  const safeIndex = Math.min(index, cast.length - 1);
  const card = cast[safeIndex]!;
  const poster = posterUrl(card);
  const vibe = (card.vibeTag || card.energyLabel || "").split(",")[0]?.trim();
  const mind = mindFingerprint(card.id);
  const resume = resumes[card.id];
  const continueHref = resume?.resumeCode ? buildResumeChatPath(resume) : null;
  const nick = firstName(card.displayName);
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

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = touchStartX.current;
    const sy = touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (sx == null || sy == null || cast.length < 2) return;
    const x = e.changedTouches[0]?.clientX ?? sx;
    const y = e.changedTouches[0]?.clientY ?? sy;
    const dx = x - sx;
    const dy = y - sy;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    go(dx < 0 ? 1 : -1);
  };

  return (
    <section
      className="relative mb-8 overflow-hidden rounded-2xl border border-brand-border bg-black shadow-card sm:mb-10 sm:rounded-3xl"
      aria-roledescription="carousel"
      aria-label="Featured character reel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative aspect-[4/5] w-full sm:aspect-[16/9] lg:aspect-[21/9]">
        {/* Outgoing layer fades under the new hero */}
        {outgoing && outgoing.id !== card.id && (
          <video
            key={`out-${outgoing.id}`}
            className="absolute inset-0 h-full w-full object-cover animate-hero-fadeout"
            src={posterUrl(outgoing)}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
          />
        )}
        <video
          key={`cur-${card.id}-${safeIndex}`}
          className={`absolute inset-0 h-full w-full object-cover ${
            outgoing && !reducedMotion ? "animate-hero-crossfade" : ""
          }`}
          src={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20 sm:bg-gradient-to-r sm:from-black sm:via-black/70 sm:to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(225,29,143,0.14),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-accent/15 to-transparent"
          aria-hidden
        />

        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:justify-center sm:p-8 lg:p-10">
          <div className="max-w-xl">
            <p className="text-[10px] uppercase tracking-[0.35em] text-brand-accent">
              Naughty Syntax · Tonight&apos;s cast
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {card.featured && (
                <span className="rounded-full bg-brand-accent/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Featured
                </span>
              )}
              {card.dedicatedPack && (
                <span className="rounded-full border border-emerald-400/45 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-50">
                  4K pack
                </span>
              )}
              {resume?.resumeCode && (
                <span className="rounded-full border border-amber-400/50 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-50">
                  {resume.heatDepth ? `Heat trail · ${resume.heatDepth}` : "Your chat"}
                </span>
              )}
              {(resume?.dnaTreeLabel || resume?.dnaTreeNodeId) && (
                <span className="rounded-full border border-violet-300/55 bg-violet-500/35 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-50 shadow-[0_0_14px_-2px_rgba(167,139,250,0.65)]">
                  DNA · {resume.dnaTreeLabel || resume.dnaTreeNodeId}
                </span>
              )}
              {mind && (
                <span className="rounded-full border border-white/25 bg-brand-accent/25 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                  {resume?.mindTag || mind.tag}
                </span>
              )}
              {vibe && (
                <span className="rounded-full border border-white/20 bg-black/40 px-2.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
                  {vibe}
                </span>
              )}
            </div>
            {resume?.heatChips && resume.heatChips.length > 0 && (
              <p className="mt-2 line-clamp-1 text-[11px] text-amber-100/85">
                Left at · {resume.heatChips.slice(0, 3).join(" · ")}
              </p>
            )}
            {resume?.recapLine && (
              <p className="mt-1 line-clamp-2 text-[12px] italic leading-snug text-white/75">
                “{resume.recapLine}”
              </p>
            )}
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {card.displayName}
            </h2>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/80 sm:mt-3 sm:line-clamp-3 sm:text-base">
              {mind?.blurb || card.teaser}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 sm:mt-5 sm:gap-3">
              {continueHref ? (
                <Link
                  href={continueHref}
                  className={`btn-primary min-h-0 px-5 py-2.5 text-sm ring-1 ${
                    resume?.dnaTreeLabel || resume?.dnaTreeNodeId
                      ? "ring-violet-400/55"
                      : "ring-amber-400/50"
                  }`}
                >
                  {resume?.dnaTreeLabel || resume?.dnaTreeNodeId
                    ? `DNA power · ${nick}`
                    : `Continue with ${nick}`}
                </Link>
              ) : (
                <Link href={card.ctaPath} className="btn-primary min-h-0 px-5 py-2.5 text-sm">
                  Chat with {nick}
                </Link>
              )}
              {forgeHref && forgeHeatCtx && (
                <Link
                  href={forgeHref}
                  className="btn-ghost min-h-0 border-violet-400/55 bg-violet-500/20 px-4 py-2.5 text-sm font-semibold text-violet-50 ring-1 ring-violet-300/35"
                  title="Mint private DNA from this climb"
                  onClick={() => stashForgeHeatSeed(forgeHeatCtx)}
                >
                  {dnaLabel
                    ? `Forge this DNA · ${dnaLabel}`
                    : "Forge this heat"}
                </Link>
              )}
              <Link
                href={card.cardPath}
                className="btn-ghost min-h-0 border-white/20 bg-black/30 px-5 py-2.5 text-sm text-white hover:bg-black/50"
              >
                Full card
              </Link>
              {card.edgePacePath && (
                <Link
                  href={card.edgePacePath}
                  className="btn-ghost min-h-0 border-rose-400/35 bg-black/30 px-5 py-2.5 text-sm text-rose-100 hover:bg-black/50"
                >
                  Edge Pace
                </Link>
              )}
              {continueHref && (
                <Link
                  href={card.ctaPath}
                  className="btn-ghost min-h-0 border-white/15 bg-black/25 px-4 py-2.5 text-xs text-white/80 hover:bg-black/45"
                >
                  New chat
                </Link>
              )}
            </div>
          </div>
        </div>

        {cast.length > 1 && !reducedMotion && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px] bg-white/10"
            aria-hidden
          >
            <div
              key={progressKey}
              className={`h-full origin-left bg-gradient-to-r from-brand-accent to-rose-300 animate-hero-progress ${
                paused ? "hero-progress-paused" : ""
              }`}
              style={{ animationDuration: `${ROTATE_MS}ms` }}
            />
          </div>
        )}

        {cast.length > 1 && (
          <>
            <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 sm:right-5 sm:top-5">
              <button
                type="button"
                onClick={() => go(-1)}
                className="min-h-touch min-w-touch rounded-full border border-white/25 bg-black/50 px-3 text-sm text-white backdrop-blur hover:bg-black/70"
                aria-label="Previous character"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="min-h-touch min-w-touch rounded-full border border-white/25 bg-black/50 px-3 text-sm text-white backdrop-blur hover:bg-black/70"
                aria-label="Next character"
              >
                ›
              </button>
            </div>
            <div
              className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 sm:bottom-5"
              role="tablist"
              aria-label="Reel slides"
            >
              {cast.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={i === safeIndex}
                  aria-label={`Show ${c.displayName}`}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === safeIndex
                      ? "w-6 bg-brand-accent shadow-[0_0_12px_rgba(225,29,143,0.7)]"
                      : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
            <p className="pointer-events-none absolute bottom-3 right-4 z-10 hidden text-[10px] uppercase tracking-[0.2em] text-white/50 sm:block">
              {safeIndex + 1} / {cast.length}
              {paused || reducedMotion ? " · paused" : " · swipe"}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
