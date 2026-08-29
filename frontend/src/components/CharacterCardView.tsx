"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CharacterCard } from "@/lib/character-card";
import { packLaneFor, packLaneLabel } from "@/lib/pack-lanes";
import { loadStoredAccount } from "@/lib/account-storage";
import { fetchLatestAccountSessionForCharacter } from "@/lib/api";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import {
  buildResumeChatPath,
  getResumeForCharacter,
  type ResumeCacheEntry,
} from "@/lib/resume-cache";
import { presenceVisual, resolvePresenceSkin } from "@/lib/presence";
import {
  buildCharacterShareUrl,
  buildResumeCodeShareUrl,
  canNativeShare,
  shareOrCopyUrl,
  shareUrlResultLabel,
} from "@/lib/share-links";
import { SiteChrome } from "@/components/SiteChrome";

interface CharacterCardViewProps {
  card: CharacterCard;
  siteOrigin: string;
}

export function CharacterCardView({ card, siteOrigin }: CharacterCardViewProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [resumeCode, setResumeCode] = useState<string | null>(null);
  const [resumeSource, setResumeSource] = useState<"account" | "local" | null>(null);
  const [resumeEntry, setResumeEntry] = useState<ResumeCacheEntry | null>(null);

  const shareUrl = useMemo(() => `${siteOrigin}${card.cardPath}`, [siteOrigin, card.cardPath]);
  const presence = useMemo(() => {
    const skin = resolvePresenceSkin(undefined, card.id);
    return presenceVisual(skin);
  }, [card.id]);
  const autostartUrl = useMemo(
    () => buildCharacterShareUrl(card.id, { origin: siteOrigin, autostart: true, card: false }),
    [card.id, siteOrigin],
  );
  const edgePaceUrl = useMemo(
    () =>
      card.edgePacePath
        ? `${siteOrigin}${card.edgePacePath.startsWith("/") ? "" : "/"}${card.edgePacePath}`
        : buildCharacterShareUrl(card.id, {
            origin: siteOrigin,
            autostart: true,
            card: false,
            sessionMode: "edge_pace",
          }),
    [card.edgePacePath, card.id, siteOrigin],
  );
  const resumeUrl = useMemo(
    () =>
      resumeCode
        ? buildResumeCodeShareUrl(resumeCode, {
            origin: siteOrigin,
            characterId: card.id,
            rehydrate: true,
            sessionMode:
              resumeEntry?.dnaTreeLabel || resumeEntry?.dnaTreeNodeId
                ? "edge_pace"
                : undefined,
          })
        : null,
    [resumeCode, siteOrigin, card.id, resumeEntry?.dnaTreeLabel, resumeEntry?.dnaTreeNodeId],
  );

  const poster = card.posterClip.startsWith("http")
    ? card.posterClip
    : card.posterClip.startsWith("/")
      ? card.posterClip
      : `/${card.posterClip}`;

  useEffect(() => {
    let cancelled = false;

    // Instant local/cache hit
    const cached = getResumeForCharacter(card.id);
    if (cached?.resumeCode) {
      setResumeCode(cached.resumeCode);
      setResumeSource(cached.source);
      setResumeEntry(cached);
    } else {
      setResumeCode(null);
      setResumeSource(null);
      setResumeEntry(null);
    }

    // Prefer account-backed latest (works across devices when signed in)
    const account = loadStoredAccount();
    if (!account) return;

    void fetchLatestAccountSessionForCharacter(account.token, card.id)
      .then((latest) => {
        if (cancelled || !latest?.resumeCode) return;
        setResumeCode(latest.resumeCode);
        setResumeSource("account");
        setResumeEntry({
          characterId: card.id,
          characterName: card.displayName,
          sessionId: latest.sessionId,
          resumeCode: latest.resumeCode,
          updatedAt: latest.updatedAt || new Date().toISOString(),
          source: "account",
          resumeExpiresAt: latest.resumeExpiresAt,
        });
      })
      .catch(() => {
        /* keep cache/local */
      });

    return () => {
      cancelled = true;
    };
  }, [card.id, card.displayName]);

  const flash = (label: string | null) => {
    if (!label) return;
    setNotice(label);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const onShareCard = async () => {
    const opening = card.openingMessage?.trim();
    const quote =
      opening && opening.length > 140 ? `${opening.slice(0, 137).trim()}…` : opening;
    const result = await shareOrCopyUrl({
      url: shareUrl,
      title: `${card.displayName} · Naughty Syntax`,
      text: quote
        ? `${card.displayName}: “${quote}” — live on Procharacters.cloud`
        : card.teaser
          ? `Meet ${card.displayName} — ${card.teaser}`
          : `Meet ${card.displayName} on Procharacters.cloud`,
    });
    flash(shareUrlResultLabel(result, "Card link"));
  };

  const onShareAutostart = async () => {
    const opening = card.openingMessage?.trim();
    const quote =
      opening && opening.length > 120 ? `${opening.slice(0, 117).trim()}…` : opening;
    const result = await shareOrCopyUrl({
      url: autostartUrl,
      title: `Chat with ${card.displayName}`,
      text: quote
        ? `Chat with ${card.displayName}: “${quote}”`
        : `Start a live chat with ${card.displayName} on Procharacters.cloud`,
    });
    flash(shareUrlResultLabel(result, "Start-chat link"));
  };

  const onShareResume = async () => {
    if (!resumeUrl || !resumeCode) return;
    const result = await shareOrCopyUrl({
      url: resumeUrl,
      title: `Resume chat with ${card.displayName}`,
      text: `Continue your chat with ${card.displayName} (code ${resumeCode})`,
    });
    flash(shareUrlResultLabel(result, `Resume ${resumeCode}`));
  };

  const shareLabel = canNativeShare() ? "Share" : "Copy";
  const mind = mindFingerprint(card.id);
  const nick = card.displayName.trim().split(/\s+/)[0] || card.displayName;

  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] sm:pb-8">
      <div className="pointer-events-none absolute inset-0 bg-brand-mesh" />

      <SiteChrome
        active="card"
        title={card.displayName}
        subtitle={`${card.brand} · ${card.kind === "custom" ? "Custom" : "Signature"}`}
        className="pt-[env(safe-area-inset-top,0px)]"
      />

      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col px-4 py-6 sm:py-12">
        <section className="grid flex-1 items-center gap-6 sm:gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="relative mx-auto w-full max-w-md">
            <div
              className={`avatar-ring relative overflow-hidden rounded-[1.75rem] border border-brand-border bg-brand-panel shadow-card shadow-glow-sm ${presence.glow}`}
            >
              <div className="aspect-[3/4] w-full bg-black">
                <video
                  key={poster}
                  className="h-full w-full object-cover"
                  style={{ filter: presence.filter }}
                  src={poster}
                  autoPlay
                  loop
                  muted={muted}
                  playsInline
                  poster={poster.endsWith(".svg") ? poster : undefined}
                />
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${presence.wash}`}
                  aria-hidden
                />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/80 via-black/20 to-transparent p-5 pt-16">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {resumeCode ? (
                    <span className="tag border-amber-400/50 bg-amber-500/20 text-amber-50">
                      Your chat
                    </span>
                  ) : card.featured ? (
                    <span className="tag border-transparent bg-brand-accent/90 text-white">
                      Featured
                    </span>
                  ) : card.dedicatedPack ? (
                    <span className="tag border-emerald-400/45 bg-emerald-500/25 text-emerald-50">
                      4K pack
                    </span>
                  ) : packLaneLabel(card.packLane ?? packLaneFor(card.id)) ? (
                    <span className="tag border-emerald-300/30 bg-black/45 text-emerald-50/90">
                      {packLaneLabel(card.packLane ?? packLaneFor(card.id))}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs uppercase tracking-[0.25em] text-brand-accent">
                  Live model · {presence.label}
                </p>
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
                {card.kind === "default" && card.dedicatedPack && (
                  <span className="ml-2 tag border-emerald-400/40 text-emerald-200">
                    4K pack
                  </span>
                )}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-brand-text sm:text-4xl">
                Meet {card.displayName}
              </h2>
              {mind ? (
                <div className="mt-3 rounded-xl border border-brand-accent/25 bg-brand-accent/5 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
                    Mind · {mind.tag}
                    {mind.bilingual ? " · Soft ES spice" : ""}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-muted">{mind.blurb}</p>
                </div>
              ) : (
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-muted sm:mt-4 sm:text-base">
                  {card.teaser}
                </p>
              )}
            </div>

            {card.openingMessage && (
              <blockquote className="rounded-xl border border-brand-accent/30 bg-brand-accent/5 px-4 py-3 text-sm leading-relaxed text-brand-text">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-brand-accent">
                  Opening line
                </p>
                <p className="mt-2 whitespace-pre-wrap text-brand-muted">“{card.openingMessage}”</p>
              </blockquote>
            )}

            {card.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {card.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="tag border-brand-border bg-brand-panel font-medium normal-case tracking-normal text-brand-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="hidden items-center gap-3 sm:flex">
              {resumeEntry?.resumeCode ? (
                <Link
                  href={buildResumeChatPath(resumeEntry)}
                  className={`btn-primary px-6 ring-1 ${
                    resumeEntry.dnaTreeLabel || resumeEntry.dnaTreeNodeId
                      ? "ring-violet-400/50"
                      : "ring-amber-400/45"
                  }`}
                >
                  {resumeEntry.dnaTreeLabel || resumeEntry.dnaTreeNodeId
                    ? `DNA power · ${nick}`
                    : `Continue · ${nick}`}
                </Link>
              ) : (
                <Link href={card.ctaPath} className="btn-primary px-6">
                  Chat with {nick}
                </Link>
              )}
              <Link
                href={card.edgePacePath || `/chat?character=${encodeURIComponent(card.id)}&autostart=1&mode=edge_pace`}
                className="btn-ghost border-rose-400/40 px-5 text-rose-100"
              >
                Edge Pace
              </Link>
              <details className="more-panel relative">
                <summary className="btn-ghost cursor-pointer px-5">
                  {shareLabel}
                </summary>
                <div className="absolute right-0 z-20 mt-2 flex min-w-[11rem] flex-col gap-1 rounded-xl border border-brand-border bg-brand-panel p-1.5 shadow-card">
                  <button type="button" onClick={() => void onShareCard()} className="btn-ghost btn-compact min-h-0 justify-start">
                    {shareLabel} card
                  </button>
                  <button type="button" onClick={() => void onShareAutostart()} className="btn-ghost btn-compact min-h-0 justify-start">
                    {shareLabel} start
                  </button>
                  {resumeCode ? (
                    <button type="button" onClick={() => void onShareResume()} className="btn-ghost btn-compact min-h-0 justify-start text-amber-200">
                      {shareLabel} resume
                    </button>
                  ) : null}
                  {resumeEntry?.resumeCode ? (
                    <Link href={card.ctaPath} className="btn-ghost btn-compact min-h-0 justify-start">
                      New chat
                    </Link>
                  ) : null}
                </div>
              </details>
            </div>

            {notice && (
              <p className="text-sm text-brand-accent" role="status">
                {notice}
              </p>
            )}

            <details className="more-panel rounded-xl border border-brand-border/70 bg-brand-panel/60 px-4 py-3 text-xs text-brand-muted">
              <summary className="cursor-pointer font-medium text-brand-text hover:text-brand-accent">
                Links
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="font-medium text-brand-text">Card</p>
                  <p className="mt-1 break-all font-mono text-[11px]">{shareUrl}</p>
                </div>
                <div>
                  <p className="font-medium text-brand-text">Start chat</p>
                  <p className="mt-1 break-all font-mono text-[11px]">{autostartUrl}</p>
                </div>
                <div>
                  <p className="font-medium text-rose-100">Edge Pace</p>
                  <p className="mt-1 break-all font-mono text-[11px]">{edgePaceUrl}</p>
                </div>
                {resumeUrl && resumeCode ? (
                  <div>
                    <p className="font-medium text-amber-200">
                      Resume ({resumeCode})
                      <span className="ml-1 font-normal text-brand-muted">
                        · {resumeSource === "account" ? "account" : "this device"}
                      </span>
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px]">{resumeUrl}</p>
                  </div>
                ) : (
                  <p className="text-[11px]">Resume link appears after you chat while signed in.</p>
                )}
              </div>
            </details>
          </div>
        </section>

        <footer className="mt-10 text-center text-xs text-brand-muted">
          Uncensored 21+ · Naughty Syntax / KGC Ventures
        </footer>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-border/70 bg-brand-bg/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          {resumeEntry?.resumeCode ? (
            <Link
              href={buildResumeChatPath(resumeEntry)}
              className={`btn-primary flex-1 ring-1 ${
                resumeEntry.dnaTreeLabel || resumeEntry.dnaTreeNodeId
                  ? "ring-violet-400/50"
                  : "ring-amber-400/45"
              }`}
            >
              {resumeEntry.dnaTreeLabel || resumeEntry.dnaTreeNodeId ? "DNA power" : "Continue"}
            </Link>
          ) : (
            <Link href={card.ctaPath} className="btn-primary flex-1">
              Start
            </Link>
          )}
          <button type="button" onClick={() => void onShareCard()} className="btn-ghost flex-1">
            {shareLabel}
          </button>
        </div>
      </div>
    </main>
  );
}
