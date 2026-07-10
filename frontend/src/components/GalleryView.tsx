"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CharacterCard } from "@/lib/character-card";
import { copyText } from "@/lib/share-links";

interface GalleryViewProps {
  characters: CharacterCard[];
  siteOrigin: string;
}

export function GalleryView({ characters, siteOrigin }: GalleryViewProps) {
  const [filter, setFilter] = useState<"all" | "default" | "custom">("all");
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (filter === "all") return characters;
    return characters.filter((c) => c.kind === filter);
  }, [characters, filter]);

  const copyCard = async (card: CharacterCard) => {
    const url = `${siteOrigin}${card.cardPath}`;
    const ok = await copyText(url);
    setNotice(ok ? `Copied ${card.displayName}` : "Copy failed");
    window.setTimeout(() => setNotice(null), 2000);
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(225,29,143,0.16),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(80,20,120,0.2),_transparent_45%)]" />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-brand-accent">Naughty Syntax</p>
            <h1 className="mt-2 bg-gradient-to-r from-brand-text to-brand-accent bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
              Live character gallery
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-muted">
              Browse signature models and custom characters. Open a card to share, or jump
              straight into uncensored live chat.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/chat"
              className="rounded-xl bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-accent/25 transition hover:bg-brand-accentDim"
            >
              Open live chat
            </Link>
            {notice && <span className="text-xs text-brand-accent">{notice}</span>}
          </div>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["default", "Signature"],
              ["custom", "Custom"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-4 py-1.5 text-xs transition ${
                filter === key
                  ? "border-brand-accent bg-brand-accent/15 text-brand-text"
                  : "border-brand-border bg-brand-panel text-brand-muted hover:border-brand-accent"
              }`}
            >
              {label}
              <span className="ml-1 opacity-70">
                (
                {key === "all"
                  ? characters.length
                  : characters.filter((c) => c.kind === key).length}
                )
              </span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-panel p-10 text-center">
            <p className="text-brand-text">No characters in this filter yet.</p>
            <p className="mt-2 text-sm text-brand-muted">
              Create a custom model in live chat, then it will appear here.
            </p>
            <Link href="/chat" className="mt-4 inline-block text-sm text-brand-accent hover:underline">
              Go to chat →
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((card) => {
              const poster = card.posterClip.startsWith("http")
                ? card.posterClip
                : card.posterClip.startsWith("/")
                  ? card.posterClip
                  : `/${card.posterClip}`;
              return (
                <article
                  key={card.id}
                  className="group overflow-hidden rounded-2xl border border-brand-border bg-brand-panel shadow-xl shadow-black/20 transition hover:border-brand-accent/60 hover:shadow-brand-accent/10"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-black">
                    <video
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      src={poster}
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4 pt-16">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent">
                        {card.kind === "custom" ? "Custom" : "Signature"}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-white">{card.displayName}</h2>
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    <p className="line-clamp-2 text-sm text-brand-muted">{card.teaser}</p>
                    {card.tags?.length > 0 && (
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
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={card.ctaPath}
                        className="rounded-lg bg-brand-accent px-3 py-2 text-xs font-semibold text-white hover:bg-brand-accentDim"
                      >
                        Chat
                      </Link>
                      <Link
                        href={card.cardPath}
                        className="rounded-lg border border-brand-border px-3 py-2 text-xs text-brand-text hover:border-brand-accent"
                      >
                        Card
                      </Link>
                      <button
                        type="button"
                        onClick={() => void copyCard(card)}
                        className="rounded-lg border border-brand-border px-3 py-2 text-xs text-brand-muted hover:border-brand-accent hover:text-brand-text"
                      >
                        Copy link
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <footer className="mt-12 text-center text-xs text-brand-muted">
          Uncensored 18+ · Procharacters.cloud / KGC Ventures
        </footer>
      </div>
    </main>
  );
}
