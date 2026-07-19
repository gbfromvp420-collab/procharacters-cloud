"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterCard } from "@/lib/character-card";
import {
  DEFAULT_REAUTH_NOTICE,
  invalidateStoredAccount,
  loadStoredAccount,
} from "@/lib/account-storage";
import { isAccountAuthError, listAccountSessions, listLiveCharacters } from "@/lib/api";
import {
  buildResumeChatPath,
  getMostRecentResume,
  getResumeForCharacter,
  isResumeExpiryUrgent,
  type ResumeCacheEntry,
} from "@/lib/resume-cache";
import {
  buildResumeCodeShareUrl,
  canNativeShare,
  shareOrCopyUrl,
  shareUrlResultLabel,
} from "@/lib/share-links";
import type { LiveCharacterOption, MediaClipKey } from "@/lib/types";
import { CharacterTile } from "./GalleryTiles";
import { GalleryHeroReel } from "./GalleryHeroReel";
import { ContinueBanner } from "./ContinueBanner";
import { SessionAuthBanner } from "./SessionAuthBanner";
import { InstallAppHint } from "./InstallAppHint";
import { PushEnableHint } from "./PushEnableHint";
import { SoftSupportHint } from "./SoftSupportHint";
import { GalleryLiveStrip } from "./GalleryLiveStrip";
import { NetworkOfflineBanner } from "./NetworkOfflineBanner";
import { mindFingerprint } from "@/lib/mind-fingerprint";

interface GalleryViewProps {
  characters: CharacterCard[];
  siteOrigin: string;
}

type SortMode = "name" | "kind" | "energy" | "featured" | "recent" | "packs";
type GalleryFilter =
  | "all"
  | "default"
  | "custom"
  | "featured"
  | "mine"
  | "owned"
  | "packs";

const EMPTY_CLIPS: Record<MediaClipKey, string> = {
  idle: "",
  teasing: "",
  playful: "",
  aroused: "",
};

/** Map authenticated live custom → gallery card (private My Characters). */
function liveCustomToCard(c: LiveCharacterOption): CharacterCard {
  const clips = { ...EMPTY_CLIPS, ...(c.clips ?? {}) };
  const poster =
    clips.teasing || clips.idle || clips.playful || clips.aroused || "";
  return {
    id: c.id,
    displayName: c.displayName,
    kind: "custom",
    brand: "Naughty Syntax",
    energyLabel: c.energyLabel ?? "My Character",
    teaser: c.teaser ?? c.energyLabel ?? "Private My Character",
    tags: c.mine ? ["mine", "private"] : ["custom"],
    avatarBase: c.avatarBase ?? c.id,
    posterClip: poster,
    clips,
    ctaPath: `/chat?character=${encodeURIComponent(c.id)}&autostart=1`,
    cardPath: `/character/${encodeURIComponent(c.id)}`,
    featured: c.featured === true,
    dedicatedPack: false,
    mediaLabel: "custom",
    vibeTag: "My Character",
    openingMessage: c.openingMessage,
    mine: c.mine === true,
    visibility: c.visibility,
  };
}

export function GalleryView({ characters, siteOrigin }: GalleryViewProps) {
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("featured");
  const [notice, setNotice] = useState<string | null>(null);
  const [resumes, setResumes] = useState<Record<string, ResumeCacheEntry>>({});
  const [signedInHandle, setSignedInHandle] = useState<string | null>(null);
  const [ownedCards, setOwnedCards] = useState<CharacterCard[]>([]);
  const appliedSignedInDefaults = useRef(false);

  useEffect(() => {
    if (loadStoredAccount()) setSort("recent");
  }, []);

  // Deep-link ?filter=owned | mine | packs | …
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("filter")?.trim().toLowerCase();
    if (!raw) return;
    const allowed: GalleryFilter[] = [
      "all",
      "default",
      "custom",
      "featured",
      "mine",
      "owned",
      "packs",
    ];
    if (allowed.includes(raw as GalleryFilter)) {
      setFilter(raw as GalleryFilter);
      appliedSignedInDefaults.current = true;
    }
  }, []);

  // Packs filter pairs with packs-first sort for a cleaner feast
  useEffect(() => {
    if (filter === "packs") setSort("packs");
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    const seed: Record<string, ResumeCacheEntry> = {};
    for (const c of characters) {
      const r = getResumeForCharacter(c.id);
      if (r) seed[c.id] = r;
    }
    if (!cancelled) setResumes(seed);
    const account = loadStoredAccount();
    if (!account) {
      setSignedInHandle(null);
      setOwnedCards([]);
      return;
    }
    setSignedInHandle(account.handle);
    if (!appliedSignedInDefaults.current && Object.keys(seed).length > 0) {
      setFilter("mine");
      appliedSignedInDefaults.current = true;
    }
    void listAccountSessions(account.token)
      .then((sessions) => {
        if (cancelled) return;
        const next: Record<string, ResumeCacheEntry> = { ...seed };
        for (const s of sessions) {
          if (!s.resumeCode) continue;
          if (next[s.characterId]?.source === "account") continue;
          next[s.characterId] = {
            characterId: s.characterId,
            characterName: s.characterName,
            sessionId: s.sessionId,
            resumeCode: s.resumeCode,
            updatedAt: s.updatedAt || s.createdAt,
            source: "account",
            resumeExpiresAt: s.resumeExpiresAt,
          };
        }
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
      .catch((err) => {
        if (cancelled) return;
        if (isAccountAuthError(err)) {
          invalidateStoredAccount(DEFAULT_REAUTH_NOTICE);
          setSignedInHandle(null);
          setOwnedCards([]);
        }
      });
    // Private My Characters never hit public /gallery — merge from auth list
    void listLiveCharacters(account.token)
      .then((live) => {
        if (cancelled) return;
        const owned = live
          .filter((c) => c.kind === "custom" && c.mine === true)
          .map(liveCustomToCard);
        setOwnedCards(owned);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAccountAuthError(err)) {
          invalidateStoredAccount(DEFAULT_REAUTH_NOTICE);
          setSignedInHandle(null);
          setOwnedCards([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [characters]);

  /** Public gallery + private owned customs (deduped). */
  const catalog = useMemo(() => {
    const map = new Map<string, CharacterCard>();
    for (const c of characters) map.set(c.id, c);
    for (const o of ownedCards) {
      const prev = map.get(o.id);
      map.set(o.id, prev ? { ...prev, mine: true, visibility: o.visibility ?? prev.visibility } : o);
    }
    return [...map.values()];
  }, [characters, ownedCards]);

  const resumeCount = useMemo(() => Object.keys(resumes).length, [resumes]);
  const continueTarget = useMemo(() => {
    const entries = Object.values(resumes).filter((r) => !!r.resumeCode);
    if (entries.length === 0) return getMostRecentResume();
    return [...entries].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0] ?? null;
  }, [resumes]);
  const continueCard = useMemo(() => {
    if (!continueTarget) return null;
    return catalog.find((c) => c.id === continueTarget.characterId) ?? null;
  }, [catalog, continueTarget]);
  const continueHref = useMemo(() => {
    if (!continueTarget?.resumeCode) return null;
    return buildResumeChatPath(continueTarget);
  }, [continueTarget]);
  const continueUrgent = useMemo(
    () => isResumeExpiryUrgent(continueTarget?.resumeExpiresAt),
    [continueTarget?.resumeExpiresAt],
  );

  const counts = useMemo(
    () => ({
      all: catalog.length,
      featured: catalog.filter((c) => c.featured).length,
      default: catalog.filter((c) => c.kind === "default").length,
      custom: catalog.filter((c) => c.kind === "custom").length,
      mine: catalog.filter((c) => !!resumes[c.id]).length,
      owned: catalog.filter((c) => c.mine === true).length,
      packs: catalog.filter((c) => c.dedicatedPack).length,
    }),
    [catalog, resumes],
  );
  const urgentMineCount = useMemo(
    () =>
      Object.values(resumes).filter((r) =>
        isResumeExpiryUrgent(r.resumeExpiresAt),
      ).length,
    [resumes],
  );

  const matchesQuery = (c: (typeof characters)[0], q: string) => {
    if (!q) return true;
    const mind = mindFingerprint(c.id);
    const hay = [
      c.displayName,
      c.teaser,
      c.energyLabel,
      c.kind,
      c.vibeTag,
      mind?.tag,
      mind?.blurb,
      ...(c.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  };

  const featuredRow = useMemo(() => {
    if (filter === "mine" || filter === "owned") return [];
    const q = query.trim().toLowerCase();
    return catalog.filter((c) => {
      if (!c.featured) return false;
      return matchesQuery(c, q);
    });
  }, [catalog, query, filter]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = catalog.filter((c) => {
      if (filter === "mine" && !resumes[c.id]) return false;
      if (filter === "owned" && c.mine !== true) return false;
      if (filter === "featured" && !c.featured) return false;
      if (filter === "packs" && !c.dedicatedPack) return false;
      if (filter === "default" && c.kind !== "default") return false;
      if (filter === "custom" && c.kind !== "custom") return false;
      return matchesQuery(c, q);
    });
    const byRecent = (a: CharacterCard, b: CharacterCard) => {
      const ra = resumes[a.id];
      const rb = resumes[b.id];
      // Urgent expiring codes float first — reclaim heat before it dies
      const ua = isResumeExpiryUrgent(ra?.resumeExpiresAt);
      const ub = isResumeExpiryUrgent(rb?.resumeExpiresAt);
      if (ua !== ub) return ua ? -1 : 1;
      const ta = ra?.updatedAt ?? "";
      const tb = rb?.updatedAt ?? "";
      if (!!ta !== !!tb) return ta ? -1 : 1;
      if (ta !== tb) return tb.localeCompare(ta);
      return a.displayName.localeCompare(b.displayName);
    };
    list = [...list].sort((a, b) => {
      if (sort === "recent" || filter === "mine" || filter === "owned") return byRecent(a, b);
      if (sort === "featured") {
        if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
        if (resumes[a.id] || resumes[b.id]) {
          if (!!resumes[a.id] !== !!resumes[b.id]) return resumes[a.id] ? -1 : 1;
          const ua = isResumeExpiryUrgent(resumes[a.id]?.resumeExpiresAt);
          const ub = isResumeExpiryUrgent(resumes[b.id]?.resumeExpiresAt);
          if (ua !== ub) return ua ? -1 : 1;
        }
        if (a.kind !== b.kind) return a.kind === "default" ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      }
      if (sort === "name") return a.displayName.localeCompare(b.displayName);
      if (sort === "energy") return a.energyLabel.localeCompare(b.energyLabel) || a.displayName.localeCompare(b.displayName);
      if (sort === "packs") {
        if (!!a.dedicatedPack !== !!b.dedicatedPack) return a.dedicatedPack ? -1 : 1;
        if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      }
      if (a.kind !== b.kind) return a.kind === "default" ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
    return list;
  }, [catalog, filter, query, sort, resumes]);

  const flash = (label: string | null) => {
    if (!label) return;
    setNotice(label);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const shareCard = async (card: CharacterCard) => {
    const opening = card.openingMessage?.trim();
    const quote =
      opening && opening.length > 140 ? `${opening.slice(0, 137).trim()}…` : opening;
    const result = await shareOrCopyUrl({
      url: `${siteOrigin}${card.cardPath}`,
      title: `${card.displayName} · Naughty Syntax`,
      text: quote
        ? `${card.displayName}: “${quote}” — live on Procharacters.cloud`
        : card.teaser
          ? `Meet ${card.displayName} — ${card.teaser}`
          : `Meet ${card.displayName} on Procharacters.cloud`,
    });
    flash(shareUrlResultLabel(result, card.displayName));
  };

  const shareResume = async (card: CharacterCard, resume: ResumeCacheEntry) => {
    const url = buildResumeCodeShareUrl(resume.resumeCode, { origin: siteOrigin, characterId: card.id });
    const result = await shareOrCopyUrl({
      url,
      title: `Resume chat with ${card.displayName}`,
      text: `Continue your chat with ${card.displayName} (code ${resume.resumeCode})`,
    });
    flash(shareUrlResultLabel(result, `Resume ${resume.resumeCode}`));
  };

  const showFeaturedStrip = filter === "all" && !query.trim() && featuredRow.length > 0 && sort !== "recent";

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
                  · @{signedInHandle}{resumeCount > 0 ? ` · ${resumeCount} resume` : ""}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/account" className="btn-ghost min-h-0 px-3 py-2 text-xs sm:text-sm">Account</Link>
            {continueHref ? (
              <Link
                href={continueHref}
                className={`btn-primary min-h-0 px-3 py-2 text-xs sm:px-4 sm:text-sm ${
                  continueUrgent ? "ring-2 ring-rose-400/55 animate-pulse" : ""
                }`}
                title={
                  continueUrgent
                    ? "Resume expiring soon — reclaim chat"
                    : "Continue your last chat"
                }
              >
                {continueUrgent ? "Reclaim" : "Continue"}
                {continueCard?.displayName
                  ? ` · ${continueCard.displayName.split(" ")[0]}`
                  : ""}
              </Link>
            ) : (
              <Link href="/chat" className="btn-primary min-h-0 px-3 py-2 text-xs sm:px-4 sm:text-sm">Live chat</Link>
            )}
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <SessionAuthBanner
          className="mb-4"
          onInvalidated={() => setSignedInHandle(null)}
        />
        <InstallAppHint className="mb-4" />
        <NetworkOfflineBanner className="mb-4" />
        <PushEnableHint className="mb-4" />
        <SoftSupportHint className="mb-4" hasEngagement={resumeCount > 0} />
        <header className="mb-5 animate-fade-in sm:mb-6">
          <h1 className="bg-gradient-to-r from-brand-text via-white to-brand-accent bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-5xl">Live character gallery</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-muted">
            {sort === "recent" || signedInHandle
              ? "Your last chats first — then the rest of the catalog."
              : "Tonight’s cast up top — mind fingerprints on every tile, then the full roster."}
            {resumeCount > 0 ? " Amber codes are saved chats." : signedInHandle ? " Chat while signed in for multi-device codes." : " Sign in to sync resumes."}
            {" Search minds too (e.g. post-set, shy heat, brat)."}
          </p>
          {notice && <p className="mt-2 text-xs font-medium text-brand-accent" role="status">{notice}</p>}
        </header>

        <GalleryLiveStrip
          characters={catalog}
          resumeCount={resumeCount}
          onPacks={() => {
            setFilter("packs");
            setSort("featured");
            setQuery("");
          }}
          onMine={() => {
            setFilter("mine");
            setSort("recent");
            setQuery("");
          }}
          onOwned={() => {
            setFilter("owned");
            setSort("recent");
            setQuery("");
          }}
          onFeatured={() => {
            setFilter("featured");
            setSort("featured");
            setQuery("");
          }}
        />

        {/* Hero reel only on main browse (not “my chats” / search clutter) */}
        {filter === "all" && !query.trim() && (
          <GalleryHeroReel characters={catalog} resumes={resumes} />
        )}

        {continueTarget && continueHref && (
          <ContinueBanner
            continueTarget={continueTarget}
            continueCard={continueCard}
            resumeCount={resumeCount}
            onShowAllMyChats={() => { setFilter("mine"); setSort("recent"); }}
          />
        )}

        {showFeaturedStrip && (
          <section className="mb-8 sm:mb-10">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-brand-accent">Spotlight</p>
                <h2 className="text-base font-semibold text-brand-text sm:text-lg">
                  Featured
                  <span className="ml-2 text-xs font-normal text-brand-muted">
                    · swipe · live packs
                  </span>
                </h2>
              </div>
              <button type="button" onClick={() => setFilter("featured")} className="min-h-touch text-xs text-brand-muted hover:text-brand-accent">View all →</button>
            </div>
            <div className="relative -mx-4 sm:mx-0">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-6 bg-gradient-to-r from-brand-bg to-transparent sm:w-8"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-brand-bg to-transparent sm:w-10"
                aria-hidden
              />
              <button
                type="button"
                className="absolute left-1 top-1/2 z-[2] hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-brand-border/80 bg-brand-bg/90 text-brand-text shadow-card backdrop-blur sm:flex"
                aria-label="Scroll featured left"
                onClick={() => {
                  const el = document.getElementById("gallery-featured-strip");
                  el?.scrollBy({ left: -280, behavior: "smooth" });
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="absolute right-1 top-1/2 z-[2] hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-brand-border/80 bg-brand-bg/90 text-brand-text shadow-card backdrop-blur sm:flex"
                aria-label="Scroll featured right"
                onClick={() => {
                  const el = document.getElementById("gallery-featured-strip");
                  el?.scrollBy({ left: 280, behavior: "smooth" });
                }}
              >
                ›
              </button>
              <div
                id="gallery-featured-strip"
                className="scroll-strip flex gap-3 overflow-x-auto px-4 pb-1 sm:gap-4 sm:px-0"
              >
                {featuredRow.map((card) => (
                  <CharacterTile key={`feat-${card.id}`} card={card} onShareCard={shareCard} onShareResume={shareResume} resume={resumes[card.id] ?? null} compact />
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="sticky top-[calc(env(safe-area-inset-top,0px)+3.25rem)] z-20 -mx-4 mb-5 space-y-3 border-b border-brand-border/50 bg-brand-bg/90 px-4 py-3 backdrop-blur-lg sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, mind, energy, tags…" enterKeyHint="search" autoComplete="off" className="field min-h-touch flex-1" />
            <label className="flex min-h-touch items-center gap-2 text-xs text-brand-muted">
              <span className="shrink-0">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="field min-h-touch w-full sm:w-auto">
                <option value="featured">Featured first</option>
                <option value="recent">Last chat</option>
                <option value="packs">4K packs first</option>
                <option value="kind">Signature first</option>
                <option value="name">Name A–Z</option>
                <option value="energy">Energy</option>
              </select>
            </label>
          </div>
          <div className="scroll-strip flex gap-2 overflow-x-auto pb-0.5">
            {(
              [
                ["all", "All"],
                ["mine", "My chats"],
                ["owned", "My models"],
                ["featured", "Featured"],
                ["packs", "4K packs"],
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
                    ? urgentMineCount > 0
                      ? "border-rose-400/50 text-rose-100"
                      : "border-amber-500/40 text-amber-100/90"
                    : key === "owned" && counts.owned > 0
                      ? "border-violet-400/45 text-violet-100/90"
                    : key === "packs"
                      ? "border-emerald-400/35 text-emerald-100/90"
                      : ""
                }`}
              >
                {label}
                <span className="ml-1 opacity-70">({counts[key]})</span>
                {key === "mine" && urgentMineCount > 0 && (
                  <span className="ml-1 rounded-full bg-rose-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-rose-50">
                    {urgentMineCount} urgent
                  </span>
                )}
              </button>
            ))}
          </div>
          {(query.trim() || filter !== "all") && (
            <p className="text-[10px] text-brand-muted">
              Showing{" "}
              <span className="font-semibold text-brand-text">{visible.length}</span>{" "}
              mind{visible.length === 1 ? "" : "s"}
              {query.trim() ? ` for “${query.trim()}”` : ""}
              {filter !== "all" ? ` · ${filter}` : ""}
              {filter === "mine" && urgentMineCount > 0 ? (
                <span className="text-rose-200/90">
                  {" "}
                  · {urgentMineCount} need reclaim
                </span>
              ) : null}
            </p>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-gradient-to-b from-brand-panel to-brand-bg p-8 text-center sm:p-10">
            {filter === "packs" ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                  4K packs
                </p>
                <p className="mt-2 text-lg font-semibold text-brand-text">No dedicated packs here</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-brand-muted">
                  Dedicated 4-clip loops show a green 4K badge when live. Browse signature minds
                  meanwhile — interim footage still heats.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setFilter("featured");
                    }}
                    className="btn-primary min-h-0 px-5 py-2.5 text-sm"
                  >
                    Featured
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="btn-ghost min-h-0 px-5 py-2.5 text-sm"
                  >
                    All minds
                  </button>
                </div>
              </>
            ) : filter === "mine" ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
                  My chats
                </p>
                <p className="mt-2 text-lg font-semibold text-brand-text">No saved heat yet</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-brand-muted">
                  Start a live chat while signed in — resume codes land here so you can continue
                  from any device.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setFilter("featured");
                      setSort("featured");
                    }}
                    className="btn-primary min-h-0 px-5 py-2.5 text-sm"
                  >
                    Meet tonight&apos;s cast
                  </button>
                  <Link href="/chat" className="btn-ghost min-h-0 px-5 py-2.5 text-sm">
                    Open live chat
                  </Link>
                </div>
              </>
            ) : filter === "owned" ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-200/85">
                  My models
                </p>
                <p className="mt-2 text-lg font-semibold text-brand-text">No private My Characters yet</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-brand-muted">
                  {signedInHandle
                    ? "Craft a private mind from a signature base — only you see them here."
                    : "Sign in to save private My Characters. Free path holds 10; Day Pass / Supporter unlocks more."}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Link
                    href={signedInHandle ? "/chat?create=1" : "/account"}
                    className="btn-primary min-h-0 px-5 py-2.5 text-sm"
                  >
                    {signedInHandle ? "Create My Character" : "Sign in · Account"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setFilter("featured");
                    }}
                    className="btn-ghost min-h-0 px-5 py-2.5 text-sm"
                  >
                    Browse featured
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-brand-text">
                  {query.trim()
                    ? `No minds match “${query.trim()}”.`
                    : "No characters match this filter."}
                </p>
                {query.trim() && (
                  <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-2">
                    {(
                      [
                        "post-set",
                        "shy heat",
                        "mesh brat",
                        "soft goth",
                        "brat game",
                        "cool-down",
                      ] as const
                    ).map((hint) => (
                      <button
                        key={hint}
                        type="button"
                        onClick={() => {
                          setQuery(hint);
                          setFilter("all");
                        }}
                        className="rounded-full border border-brand-accent/35 bg-brand-accent/10 px-3 py-1 text-[11px] text-brand-accent hover:border-brand-accent/60"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                    className="text-sm text-brand-accent hover:underline"
                  >
                    Browse all
                  </button>
                  <Link href="/chat" className="text-sm text-brand-accent hover:underline">
                    Go to chat →
                  </Link>
                </div>
              </>
            )}
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
                searchHighlight={!!query.trim() && matchesQuery(card, query.trim().toLowerCase())}
              />
            ))}
          </div>
        )}
        <footer className="mt-12 pb-4 text-center text-xs text-brand-muted">Uncensored 18+ · Procharacters.cloud / KGC Ventures</footer>
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t bg-brand-bg/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:hidden ${
          continueUrgent
            ? "border-rose-400/50 shadow-[0_-8px_28px_-12px_rgba(244,63,94,0.45)]"
            : "border-brand-border/70"
        }`}
      >
        <div className="mx-auto flex max-w-lg gap-2">
          {continueHref ? (
            <Link
              href={continueHref}
              className={`btn-primary flex-1 ${
                continueUrgent ? "ring-2 ring-rose-400/55 animate-pulse" : ""
              }`}
            >
              {continueUrgent ? "Reclaim" : "Continue"}
              {continueCard?.displayName
                ? ` · ${continueCard.displayName.split(" ")[0]}`
                : ""}
            </Link>
          ) : (
            <Link href="/chat" className="btn-primary flex-1">Open live chat</Link>
          )}
          <Link href="/account" className="btn-ghost flex-1">Account</Link>
        </div>
      </div>
    </main>
  );
}
