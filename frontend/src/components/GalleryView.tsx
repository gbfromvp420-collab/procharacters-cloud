"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterCard } from "@/lib/character-card";
import { loadStoredAccount } from "@/lib/account-storage";
import { listAccountSessions } from "@/lib/api";
import { getResumeForCharacter, type ResumeCacheEntry } from "@/lib/resume-cache";
import {
  buildResumeCodeShareUrl,
  canNativeShare,
  shareOrCopyUrl,
  shareUrlResultLabel,
} from "@/lib/share-links";

interface GalleryViewProps {
  characters: CharacterCard[];
  siteOrigin: string;
}

type SortMode = "name" | "kind" | "energy" | "featured" | "recent";

function posterUrl(card: CharacterCard): string {
  const poster = card.posterClip;
  if (poster.startsWith("http") || poster.startsWith("/")) return poster;
  return `/${poster}`;
}

function CharacterTile({
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
        compact
          ? "w-[min(72vw,16.5rem)] shrink-0 snap-start sm:w-[15rem]"
          : "animate-rise-in"
      }`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black">
        <video
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          src={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        {resume?.resumeCode && (
          <div className="absolute right-2 top-2 z-10">
            <span
              className="rounded-full border border-amber-400/50 bg-black/70 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-200 backdrop-blur"
              title={
                resume.source === "account"
                  ? "You have a saved chat (account)"
                  : "You have a saved chat on this device"
              }
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
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-tight text-white sm:text-xl">
            {card.displayName}
          </h2>
        </div>
      </div>
      <div className={`space-y-2.5 ${compact ? "p-3" : "space-y-3 p-3 sm:p-4"}`}>
        <p className="line-clamp-2 text-xs text-brand-muted sm:text-sm">{card.teaser}</p>
        {card.tags?.length > 0 && !compact && (
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
          <Link href={card.ctaPath} className="btn-primary min-h-0 px-3 py-2 text-xs">
            Chat
          </Link>
          <Link href={card.cardPath} className="btn-ghost min-h-0 px-3 py-2 text-xs">
            Card
          </Link>
          {!compact && (
            <button
              type="button"
              onClick={() => onShareCard(card)}
              className="btn-ghost min-h-0 px-3 py-2 text-xs text-brand-muted hover:text-brand-text"
              title={
                canNativeShare()
                  ? "Share card via system share sheet"
                  : "Copy card link to clipboard"
              }
            >
              {canNativeShare() ? "Share" : "Copy link"}
            </button>
          )}
          {resume?.resumeCode && (
            <>
              <Link
                href={`/chat?resume=${encodeURIComponent(resume.resumeCode)}&character=${encodeURIComponent(card.id)}`}
                className="btn-ghost min-h-0 border-amber-500/40 px-3 py-2 text-xs text-amber-200"
                title="Resume your saved chat"
              >
                Resume
              </Link>
              {!compact && (
                <button
                  type="button"
                  onClick={() => onShareResume(card, resume)}
                  className="btn-ghost min-h-0 border-amber-500/30 px-3 py-2 text-xs text-amber-200/90"
                  title={
                    canNativeShare()
                      ? "Share resume link"
                      : "Copy resume link"
                  }
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

type GalleryFilter = "all" | "default" | "custom" | "featured" | "mine";

export function GalleryView({ characters, siteOrigin }: GalleryViewProps) {
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("featured");
  const [notice, setNotice] = useState<string | null>(null);
  /** characterId → resume entry (account + local) */
  const [resumes, setResumes] = useState<Record<string, ResumeCacheEntry>>({});
  const [signedInHandle, setSignedInHandle] = useState<string | null>(null);

  const appliedSignedInDefaults = useRef(false);

  // Signed-in: Last chat sort once; My chats filter once when any resumes exist
  useEffect(() => {
    if (loadStoredAccount()) {
      setSort("recent");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Seed from local cache immediately
    const seed: Record<string, ResumeCacheEntry> = {};
    for (const c of characters) {
      const r = getResumeForCharacter(c.id);
      if (r) seed[c.id] = r;
    }
    if (!cancelled) setResumes(seed);

    const account = loadStoredAccount();
    if (!account) {
      setSignedInHandle(null);
      return;
    }
    setSignedInHandle(account.handle);

    // Local resumes already? Jump to My chats immediately
    if (!appliedSignedInDefaults.current && Object.keys(seed).length > 0) {
      setFilter("mine");
      appliedSignedInDefaults.current = true;
    }

    void listAccountSessions(account.token)
      .then((sessions) => {
        if (cancelled) return;
        // listAccountSessions already syncs resume-cache
        const next: Record<string, ResumeCacheEntry> = { ...seed };
        for (const s of sessions) {
          if (!s.resumeCode) continue;
          // newest-first list — keep first per character
          if (next[s.characterId]?.source === "account") continue;
          next[s.characterId] = {
            characterId: s.characterId,
            characterName: s.characterName,
            sessionId: s.sessionId,
            resumeCode: s.resumeCode,
            updatedAt: s.updatedAt || s.createdAt,
            source: "account",
          };
        }
        // Re-read cache for any local-only extras
        for (const c of characters) {
          if (next[c.id]) continue;
          const r = getResumeForCharacter(c.id);
          if (r) next[c.id] = r;
        }
        setResumes(next);
        if (!appliedSignedInDefaults.current && Object.keys(next).length > 0) {
          setFilter("mine");
          appliedSignedInDefaults.current = true;
        }
      })
      .catch(() => {
        /* keep local seeds */
      });

    return () => {
      cancelled = true;
    };
  }, [characters]);

  const resumeCount = useMemo(() => Object.keys(resumes).length, [resumes]);

  const counts = useMemo(() => {
    return {
      all: characters.length,
      featured: characters.filter((c) => c.featured).length,
      default: characters.filter((c) => c.kind === "default").length,
      custom: characters.filter((c) => c.kind === "custom").length,
      mine: characters.filter((c) => !!resumes[c.id]).length,
    };
  }, [characters, resumes]);

  const featuredRow = useMemo(() => {
    if (filter === "mine") return [];
    const q = query.trim().toLowerCase();
    return characters.filter((c) => {
      if (!c.featured) return false;
      if (!q) return true;
      const hay = [c.displayName, c.teaser, c.energyLabel, ...(c.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [characters, query, filter]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = characters.filter((c) => {
      if (filter === "mine" && !resumes[c.id]) return false;
      if (filter === "featured" && !c.featured) return false;
      if (filter === "default" && c.kind !== "default") return false;
      if (filter === "custom" && c.kind !== "custom") return false;
      if (!q) return true;
      const hay = [c.displayName, c.teaser, c.energyLabel, c.kind, ...(c.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    const byRecent = (a: CharacterCard, b: CharacterCard) => {
      const ra = resumes[a.id]?.updatedAt ?? "";
      const rb = resumes[b.id]?.updatedAt ?? "";
      // Chats with resumes first, then by recency, then name
      if (!!ra !== !!rb) return ra ? -1 : 1;
      if (ra !== rb) return rb.localeCompare(ra);
      return a.displayName.localeCompare(b.displayName);
    };

    list = [...list].sort((a, b) => {
      if (sort === "recent" || filter === "mine") return byRecent(a, b);
      if (sort === "featured") {
        if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
        // Among same featured flag, prefer recent chats lightly
        const recent = byRecent(a, b);
        if (resumes[a.id] || resumes[b.id]) {
          if (!!resumes[a.id] !== !!resumes[b.id]) return resumes[a.id] ? -1 : 1;
        }
        if (a.kind !== b.kind) return a.kind === "default" ? -1 : 1;
        return recent !== 0 && (resumes[a.id] || resumes[b.id])
          ? recent
          : a.displayName.localeCompare(b.displayName);
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
  }, [characters, filter, query, sort, resumes]);

  const flash = (label: string | null) => {
    if (!label) return;
    setNotice(label);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const shareCard = async (card: CharacterCard) => {
    const url = `${siteOrigin}${card.cardPath}`;
    const result = await shareOrCopyUrl({
      url,
      title: `${card.displayName} · Procharacters`,
      text: card.teaser
        ? `Meet ${card.displayName} — ${card.teaser}`
        : `Meet ${card.displayName} on Procharacters.cloud`,
    });
    flash(shareUrlResultLabel(result, card.displayName));
  };

  const shareResume = async (card: CharacterCard, resume: ResumeCacheEntry) => {
    const url = buildResumeCodeShareUrl(resume.resumeCode, {
      origin: siteOrigin,
      characterId: card.id,
    });
    const result = await shareOrCopyUrl({
      url,
      title: `Resume chat with ${card.displayName}`,
      text: `Continue your chat with ${card.displayName} (code ${resume.resumeCode})`,
    });
    flash(shareUrlResultLabel(result, `Resume ${resume.resumeCode}`));
  };

  const showFeaturedStrip =
    filter === "all" &&
    !query.trim() &&
    featuredRow.length > 0 &&
    sort !== "recent";

  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-none absolute inset-0 bg-brand-mesh" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(225,29,143,0.06),transparent_40%)]" />

      <div className="glass-bar sticky top-0 z-30 pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-brand-accent">Naughty Syntax</p>
            <p className="truncate text-sm font-semibold text-brand-text sm:text-base">
              Live gallery
              {signedInHandle ? (
                <span className="ml-2 text-xs font-normal text-brand-muted">
                  · @{signedInHandle}
                  {resumeCount > 0 ? ` · ${resumeCount} resume` : ""}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/account" className="btn-ghost min-h-0 px-3 py-2 text-xs sm:text-sm">
              Account
            </Link>
            <Link href="/chat" className="btn-primary min-h-0 px-3 py-2 text-xs sm:px-4 sm:text-sm">
              Live chat
            </Link>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <header className="mb-6 animate-fade-in sm:mb-10">
          <h1 className="bg-gradient-to-r from-brand-text via-white to-brand-accent bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-5xl">
            Live character gallery
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-muted">
            {sort === "recent" || signedInHandle
              ? "Your last chats first — then the rest of the catalog. Search, sort, share a card, or jump back in."
              : "Featured models up top — then the full catalog. Search, sort, share a card, or jump into uncensored live chat."}
            {resumeCount > 0
              ? " Amber codes on tiles are your saved chats — Resume or share them."
              : signedInHandle
                ? " Start a chat while signed in to get multi-device resume codes on tiles."
                : " Sign in to sync resume codes across devices."}
          </p>
          {notice && (
            <p className="mt-2 text-xs font-medium text-brand-accent" role="status">
              {notice}
            </p>
          )}
        </header>

        {showFeaturedStrip && (
          <section className="mb-8 sm:mb-10">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-brand-accent">Spotlight</p>
                <h2 className="text-base font-semibold text-brand-text sm:text-lg">Featured</h2>
              </div>
              <button
                type="button"
                onClick={() => setFilter("featured")}
                className="min-h-touch text-xs text-brand-muted hover:text-brand-accent"
              >
                View all →
              </button>
            </div>
            <div className="scroll-strip -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:gap-4 sm:px-0">
              {featuredRow.map((card) => (
                <CharacterTile
                  key={`feat-${card.id}`}
                  card={card}
                  onShareCard={shareCard}
                  onShareResume={shareResume}
                  resume={resumes[card.id] ?? null}
                  compact
                />
              ))}
            </div>
          </section>
        )}

        <div className="sticky top-[calc(env(safe-area-inset-top,0px)+3.25rem)] z-20 -mx-4 mb-5 space-y-3 border-b border-brand-border/50 bg-brand-bg/90 px-4 py-3 backdrop-blur-lg sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, energy, tags…"
              enterKeyHint="search"
              autoComplete="off"
              className="field min-h-touch flex-1"
            />
            <label className="flex min-h-touch items-center gap-2 text-xs text-brand-muted">
              <span className="shrink-0">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="field min-h-touch w-full sm:w-auto"
              >
                <option value="featured">Featured first</option>
                <option value="recent">Last chat</option>
                <option value="kind">Signature first</option>
                <option value="name">Name A–Z</option>
                <option value="energy">Energy</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <div className="scroll-strip flex flex-1 gap-2 overflow-x-auto pb-0.5">
              {(
                [
                  ["all", "All"],
                  ["mine", "My chats"],
                  ["featured", "Featured"],
                  ["default", "Signature"],
                  ["custom", "Custom"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`chip ${filter === key ? "chip-active" : "chip-idle"} ${
                    key === "mine" && counts.mine > 0
                      ? "border-amber-500/40 text-amber-100/90"
                      : ""
                  }`}
                  title={
                    key === "mine"
                      ? counts.mine > 0
                        ? "Characters you have a saved resume for"
                        : signedInHandle
                          ? "No saved chats yet — start one while signed in"
                          : "Sign in and chat to see your saved characters here"
                      : undefined
                  }
                >
                  {label}
                  <span className="ml-1 opacity-70">({counts[key]})</span>
                </button>
              ))}
            </div>
            <span className="hidden shrink-0 text-xs text-brand-muted sm:inline">
              {visible.length}/{characters.length}
            </span>
          </div>
          <p className="text-[11px] text-brand-soft sm:hidden">
            Showing {visible.length} of {characters.length}
          </p>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-panel p-8 text-center sm:p-10">
            <p className="text-brand-text">
              {filter === "mine"
                ? "No saved chats yet"
                : "No characters match this search."}
            </p>
            <p className="mt-2 text-sm text-brand-muted">
              {filter === "mine"
                ? signedInHandle
                  ? "Start a live chat while signed in — those characters show up here with resume codes."
                  : "Sign in on Account, then chat — your resumes will appear under My chats."
                : "Try another filter, clear search, or create a custom model in chat."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="text-sm text-brand-accent hover:underline"
              >
                {filter === "mine" ? "Browse all" : "Clear filters"}
              </button>
              <Link href="/chat" className="text-sm text-brand-accent hover:underline">
                Go to chat →
              </Link>
              {filter === "mine" && !signedInHandle && (
                <Link href="/account" className="text-sm text-brand-accent hover:underline">
                  Sign in →
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {visible.map((card) => (
              <CharacterTile
                key={card.id}
                card={card}
                onShareCard={shareCard}
                onShareResume={shareResume}
                resume={resumes[card.id] ?? null}
              />
            ))}
          </div>
        )}

        <footer className="mt-12 pb-4 text-center text-xs text-brand-muted">
          Uncensored 18+ · Procharacters.cloud / KGC Ventures
        </footer>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-border/70 bg-brand-bg/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Link href="/chat" className="btn-primary flex-1">
            Open live chat
          </Link>
          <Link href="/account" className="btn-ghost flex-1">
            Account
          </Link>
        </div>
      </div>
    </main>
  );
}
