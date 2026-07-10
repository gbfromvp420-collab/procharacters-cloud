"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CharacterCard } from "@/lib/character-card";
import { copyText } from "@/lib/share-links";

interface GalleryViewProps {
  characters: CharacterCard[];
  siteOrigin: string;
}

type SortMode = "name" | "kind" | "energy" | "featured";

function posterUrl(card: CharacterCard): string {
  const poster = card.posterClip;
  if (poster.startsWith("http") || poster.startsWith("/")) return poster;
  return `/${poster}`;
}

function CharacterTile({
  card,
  onCopy,
  compact = false,
}: {
  card: CharacterCard;
  onCopy: (card: CharacterCard) => void;
  compact?: boolean;
}) {
  const poster = posterUrl(card);
  return (
    <article
      className={`group overflow-hidden rounded-2xl border border-brand-border bg-brand-panel shadow-xl shadow-black/20 transition hover:border-brand-accent/60 hover:shadow-brand-accent/10 ${
        compact ? "min-w-[240px] max-w-[280px] shrink-0" : ""
      }`}
    >
      <div className={`relative overflow-hidden bg-black ${compact ? "aspect-[3/4]" : "aspect-[3/4]"}`}>
        <video
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          src={poster}
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4 pt-16">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent">
              {card.kind === "custom" ? "Custom" : "Signature"}
            </p>
            {card.featured && (
              <span className="rounded-full bg-brand-accent/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                Featured
              </span>
            )}
          </div>
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
            onClick={() => onCopy(card)}
            className="rounded-lg border border-brand-border px-3 py-2 text-xs text-brand-muted hover:border-brand-accent hover:text-brand-text"
          >
            Copy link
          </button>
        </div>
      </div>
    </article>
  );
}

export function GalleryView({ characters, siteOrigin }: GalleryViewProps) {
  const [filter, setFilter] = useState<"all" | "default" | "custom" | "featured">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("featured");
  const [notice, setNotice] = useState<string | null>(null);

  const featuredRow = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters.filter((c) => {
      if (!c.featured) return false;
      if (!q) return true;
      const hay = [c.displayName, c.teaser, c.energyLabel, ...(c.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [characters, query]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = characters.filter((c) => {
      if (filter === "featured" && !c.featured) return false;
      if (filter === "default" && c.kind !== "default") return false;
      if (filter === "custom" && c.kind !== "custom") return false;
      if (!q) return true;
      const hay = [c.displayName, c.teaser, c.energyLabel, c.kind, ...(c.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
      if (sort === "featured") {
        if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
        if (a.kind !== b.kind) return a.kind === "default" ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      }
      if (sort === "name") return a.displayName.localeCompare(b.displayName);
      if (sort === "energy") {
        return (
          a.energyLabel.localeCompare(b.energyLabel) || a.displayName.localeCompare(b.displayName)
        );
      }
      if (a.kind !== b.kind) return a.kind === "default" ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return list;
  }, [characters, filter, query, sort]);

  const copyCard = async (card: CharacterCard) => {
    const url = `${siteOrigin}${card.cardPath}`;
    const ok = await copyText(url);
    setNotice(ok ? `Copied ${card.displayName}` : "Copy failed");
    window.setTimeout(() => setNotice(null), 2000);
  };

  const showFeaturedStrip = filter === "all" && !query.trim() && featuredRow.length > 0;

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
              Featured models up top — then the full catalog. Search, sort, share a card, or jump
              into uncensored live chat.
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

        {showFeaturedStrip && (
          <section className="mb-10">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-brand-accent">Spotlight</p>
                <h2 className="text-lg font-semibold text-brand-text">Featured</h2>
              </div>
              <button
                type="button"
                onClick={() => setFilter("featured")}
                className="text-xs text-brand-muted hover:text-brand-accent"
              >
                View all featured →
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {featuredRow.map((card) => (
                <CharacterTile key={`feat-${card.id}`} card={card} onCopy={copyCard} compact />
              ))}
            </div>
          </section>
        )}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, energy, tags…"
            className="w-full flex-1 rounded-xl border border-brand-border bg-brand-panel px-4 py-2.5 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
          />
          <label className="flex items-center gap-2 text-xs text-brand-muted">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
            >
              <option value="featured">Featured first</option>
              <option value="kind">Signature first</option>
              <option value="name">Name A–Z</option>
              <option value="energy">Energy</option>
            </select>
          </label>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "All"],
              ["featured", "Featured"],
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
                  : key === "featured"
                    ? characters.filter((c) => c.featured).length
                    : characters.filter((c) => c.kind === key).length}
                )
              </span>
            </button>
          ))}
          <span className="ml-auto text-xs text-brand-muted">
            Showing {visible.length} of {characters.length}
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-panel p-10 text-center">
            <p className="text-brand-text">No characters match this search.</p>
            <p className="mt-2 text-sm text-brand-muted">
              Try another filter, clear search, or create a custom model in chat.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="text-sm text-brand-accent hover:underline"
              >
                Clear filters
              </button>
              <Link href="/chat" className="text-sm text-brand-accent hover:underline">
                Go to chat →
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((card) => (
              <CharacterTile key={card.id} card={card} onCopy={copyCard} />
            ))}
          </div>
        )}

        <footer className="mt-12 text-center text-xs text-brand-muted">
          Uncensored 18+ · Procharacters.cloud / KGC Ventures
        </footer>
      </div>
    </main>
  );
}
