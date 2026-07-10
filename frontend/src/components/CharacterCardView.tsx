"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CharacterCard } from "@/lib/character-card";
import { copyText } from "@/lib/share-links";

interface CharacterCardViewProps {
  card: CharacterCard;
  siteOrigin: string;
}

export function CharacterCardView({ card, siteOrigin }: CharacterCardViewProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);

  const shareUrl = useMemo(() => `${siteOrigin}${card.cardPath}`, [siteOrigin, card.cardPath]);
  const poster = card.posterClip.startsWith("http")
    ? card.posterClip
    : card.posterClip.startsWith("/")
      ? card.posterClip
      : `/${card.posterClip}`;

  const onCopy = async () => {
    const ok = await copyText(shareUrl);
    setNotice(ok ? "Card link copied" : "Copy failed");
    window.setTimeout(() => setNotice(null), 2000);
  };

  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] sm:pb-8">
      <div className="pointer-events-none absolute inset-0 bg-brand-mesh" />

      <div className="glass-bar sticky top-0 z-30 pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/"
            className="min-h-touch inline-flex items-center text-sm text-brand-muted transition hover:text-brand-text"
          >
            ← Gallery
          </Link>
          <span className="rounded-full border border-brand-border bg-brand-panel/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-brand-muted sm:text-xs">
            {card.brand}
          </span>
        </div>
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col px-4 py-6 sm:py-12">
        <section className="grid flex-1 items-center gap-6 sm:gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="relative mx-auto w-full max-w-md">
            <div className="avatar-ring relative overflow-hidden rounded-[1.75rem] border border-brand-border bg-brand-panel shadow-card shadow-glow-sm">
              <div className="aspect-[3/4] w-full bg-black">
                <video
                  key={poster}
                  className="h-full w-full object-cover"
                  src={poster}
                  autoPlay
                  loop
                  muted={muted}
                  playsInline
                  poster={poster.endsWith(".svg") ? poster : undefined}
                />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-5 pt-16">
                <p className="text-xs uppercase tracking-[0.25em] text-brand-accent">Live model</p>
                <h1 className="mt-1 text-3xl font-semibold text-white sm:text-4xl">
                  {card.displayName}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="absolute right-3 top-3 min-h-touch rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur active:scale-95"
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-5 sm:gap-6">
            <div>
              <p className="text-sm text-brand-accent">
                {card.kind === "custom" ? "Custom character" : "Signature model"} ·{" "}
                {card.energyLabel}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-brand-text sm:text-4xl">
                Meet {card.displayName}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-muted sm:mt-4 sm:text-base">
                {card.teaser}
              </p>
            </div>

            {card.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-brand-border bg-brand-panel px-3 py-1 text-xs text-brand-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="hidden flex-wrap gap-3 sm:flex">
              <Link href={card.ctaPath} className="btn-primary px-6">
                Start live chat
              </Link>
              <button type="button" onClick={onCopy} className="btn-ghost px-6">
                Copy card link
              </button>
              <Link
                href="/chat"
                className="btn-ghost px-6 text-brand-muted hover:text-brand-text"
              >
                Open chat
              </Link>
            </div>

            {notice && (
              <p className="text-sm text-brand-accent" role="status">
                {notice}
              </p>
            )}

            <div className="rounded-xl border border-brand-border/70 bg-brand-panel/60 p-4 text-xs text-brand-muted">
              <p className="font-medium text-brand-text">Share this card</p>
              <p className="mt-1 break-all font-mono text-[11px] text-brand-muted">{shareUrl}</p>
            </div>
          </div>
        </section>

        <footer className="mt-10 text-center text-xs text-brand-muted">
          Uncensored 18+ · Naughty Syntax / KGC Ventures
        </footer>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-border/70 bg-brand-bg/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Link href={card.ctaPath} className="btn-primary flex-1">
            Start chat
          </Link>
          <button type="button" onClick={onCopy} className="btn-ghost flex-1">
            Copy link
          </button>
        </div>
      </div>
    </main>
  );
}
