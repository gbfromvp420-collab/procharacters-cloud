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
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(225,29,143,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(99,20,140,0.2),_transparent_50%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:py-12">
        <header className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" className="text-sm text-brand-muted transition hover:text-brand-text">
            ← Gallery
          </Link>
          <span className="rounded-full border border-brand-border bg-brand-panel/80 px-3 py-1 text-xs uppercase tracking-[0.2em] text-brand-muted">
            {card.brand}
          </span>
        </header>

        <section className="grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="relative mx-auto w-full max-w-md">
            <div className="avatar-ring relative overflow-hidden rounded-[1.75rem] border border-brand-border bg-brand-panel shadow-2xl shadow-brand-accent/10">
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
                className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-xs text-white backdrop-blur"
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm text-brand-accent">
                {card.kind === "custom" ? "Custom character" : "Signature model"} ·{" "}
                {card.energyLabel}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-text sm:text-4xl">
                Meet {card.displayName}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-brand-muted">
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

            <div className="flex flex-wrap gap-3">
              <Link
                href={card.ctaPath}
                className="rounded-xl bg-brand-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-accent/30 transition hover:bg-brand-accentDim"
              >
                Start live chat
              </Link>
              <button
                type="button"
                onClick={onCopy}
                className="rounded-xl border border-brand-border bg-brand-panel px-6 py-3 text-sm text-brand-text transition hover:border-brand-accent"
              >
                Copy card link
              </button>
              <Link
                href="/chat"
                className="rounded-xl border border-brand-border px-6 py-3 text-sm text-brand-muted transition hover:border-brand-accent hover:text-brand-text"
              >
                Open chat
              </Link>
            </div>

            {notice && <p className="text-sm text-brand-accent">{notice}</p>}

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
    </main>
  );
}
