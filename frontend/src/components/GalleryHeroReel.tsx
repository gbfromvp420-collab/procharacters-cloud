"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CharacterCard } from "@/lib/character-card";
import { posterUrl } from "./GalleryTiles";

const ROTATE_MS = 6500;

/** Prefer featured dedicated packs, then any featured, then rest with posters. */
export function pickHeroCast(characters: CharacterCard[]): CharacterCard[] {
  const withPoster = characters.filter((c) => !!c.posterClip);
  if (withPoster.length === 0) return [];

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

  // Stable order: featured first, then name
  return [...pool].sort((a, b) => {
    if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
    if (!!a.dedicatedPack !== !!b.dedicatedPack) return a.dedicatedPack ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function GalleryHeroReel({ characters }: { characters: CharacterCard[] }) {
  const cast = useMemo(() => pickHeroCast(characters), [characters]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

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

  const go = useCallback(
    (dir: 1 | -1) => {
      if (cast.length === 0) return;
      setIndex((i) => (i + dir + cast.length) % cast.length);
    },
    [cast.length],
  );

  useEffect(() => {
    if (paused || reducedMotion || cast.length < 2) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % cast.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [paused, reducedMotion, cast.length]);

  if (cast.length === 0) return null;

  const card = cast[Math.min(index, cast.length - 1)]!;
  const poster = posterUrl(card);
  const vibe = (card.vibeTag || card.energyLabel || "").split(",")[0]?.trim();

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
    >
      <div className="relative aspect-[4/5] w-full sm:aspect-[16/9] lg:aspect-[21/9]">
        {/* Crossfade layers — only active + previous would be ideal; keep simple with key swap */}
        <video
          key={card.id}
          className="absolute inset-0 h-full w-full object-cover animate-fade-in"
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
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(225,29,143,0.12),transparent_55%)]"
          aria-hidden
        />

        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:justify-center sm:p-8 lg:p-10">
          <div className="max-w-xl">
            <p className="text-[10px] uppercase tracking-[0.35em] text-brand-accent">
              Naughty Syntax · Live reel
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
              {vibe && (
                <span className="rounded-full border border-white/20 bg-black/40 px-2.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
                  {vibe}
                </span>
              )}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {card.displayName}
            </h2>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/80 sm:mt-3 sm:line-clamp-3 sm:text-base">
              {card.teaser}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 sm:mt-5 sm:gap-3">
              <Link href={card.ctaPath} className="btn-primary min-h-0 px-5 py-2.5 text-sm">
                Chat with {card.displayName.split(" ")[0]}
              </Link>
              <Link href={card.cardPath} className="btn-ghost min-h-0 border-white/20 bg-black/30 px-5 py-2.5 text-sm text-white hover:bg-black/50">
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
            </div>
          </div>
        </div>

        {/* Controls */}
        {cast.length > 1 && (
          <>
            <div className="absolute right-3 top-3 flex items-center gap-1.5 sm:right-5 sm:top-5">
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
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-5"
              role="tablist"
              aria-label="Reel slides"
            >
              {cast.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Show ${c.displayName}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index
                      ? "w-6 bg-brand-accent"
                      : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
            <p className="pointer-events-none absolute bottom-3 right-4 hidden text-[10px] uppercase tracking-[0.2em] text-white/50 sm:block">
              {index + 1} / {cast.length}
              {paused || reducedMotion ? " · paused" : ""}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
