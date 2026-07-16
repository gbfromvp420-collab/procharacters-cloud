"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CharacterCard } from "@/lib/character-card";
import { loadStoredAccount } from "@/lib/account-storage";
import { fetchLatestAccountSessionForCharacter } from "@/lib/api";
import { getResumeForCharacter } from "@/lib/resume-cache";
import { presenceVisual, resolvePresenceSkin } from "@/lib/presence";
import {
  buildCharacterShareUrl,
  buildResumeCodeShareUrl,
  canNativeShare,
  shareOrCopyUrl,
  shareUrlResultLabel,
} from "@/lib/share-links";

interface CharacterCardViewProps {
  card: CharacterCard;
  siteOrigin: string;
}

export function CharacterCardView({ card, siteOrigin }: CharacterCardViewProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [resumeCode, setResumeCode] = useState<string | null>(null);
  const [resumeSource, setResumeSource] = useState<"account" | "local" | null>(null);

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
        ? buildResumeCodeShareUrl(resumeCode, { origin: siteOrigin, characterId: card.id })
        : null,
    [resumeCode, siteOrigin, card.id],
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
    } else {
      setResumeCode(null);
      setResumeSource(null);
    }

    // Prefer account-backed latest (works across devices when signed in)
    const account = loadStoredAccount();
    if (!account) return;

    void fetchLatestAccountSessionForCharacter(account.token, card.id)
      .then((latest) => {
        if (cancelled || !latest?.resumeCode) return;
        setResumeCode(latest.resumeCode);
        setResumeSource("account");
      })
      .catch(() => {
        /* keep cache/local */
      });

    return () => {
      cancelled = true;
    };
  }, [card.id]);

  const flash = (label: string | null) => {
    if (!label) return;
    setNotice(label);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const onShareCard = async () => {
    const result = await shareOrCopyUrl({
      url: shareUrl,
      title: `${card.displayName} · Procharacters`,
      text: card.teaser
        ? `Meet ${card.displayName} — ${card.teaser}`
        : `Meet ${card.displayName} on Procharacters.cloud`,
    });
    flash(shareUrlResultLabel(result, "Card link"));
  };

  const onShareAutostart = async () => {
    const result = await shareOrCopyUrl({
      url: autostartUrl,
      title: `Chat with ${card.displayName}`,
      text: `Start a live chat with ${card.displayName} on Procharacters.cloud`,
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
                {card.kind === "default" && (
                  <span
                    className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      card.dedicatedPack
                        ? "border-emerald-400/40 text-emerald-200"
                        : "border-brand-border text-brand-muted"
                    }`}
                  >
                    {card.dedicatedPack ? "Dedicated pack" : `Interim · ${card.avatarBase}`}
                  </span>
                )}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-brand-text sm:text-4xl">
                Meet {card.displayName}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-muted sm:mt-4 sm:text-base">
                {card.teaser}
              </p>
              {(card.vibeTag || card.energyLabel) && (
                <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-brand-accent">
                  {(card.vibeTag || card.energyLabel).split(",")[0]?.trim()}
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
              <Link
                href={card.edgePacePath || `/chat?character=${encodeURIComponent(card.id)}&autostart=1&mode=edge_pace`}
                className="btn-ghost border-rose-400/40 px-6 text-rose-100"
              >
                Edge Pace
              </Link>
              <button
                type="button"
                onClick={() => void onShareCard()}
                className="btn-ghost px-6"
                title={
                  canNativeShare()
                    ? "Share card via system share sheet"
                    : "Copy card link to clipboard"
                }
              >
                {shareLabel} card
              </button>
              <button
                type="button"
                onClick={() => void onShareAutostart()}
                className="btn-ghost px-6"
                title={
                  canNativeShare()
                    ? "Share autostart chat link"
                    : "Copy autostart chat link"
                }
              >
                {shareLabel} start
              </button>
              {resumeCode && (
                <button
                  type="button"
                  onClick={() => void onShareResume()}
                  className="btn-ghost border-amber-500/40 px-6 text-amber-200"
                  title={
                    resumeSource === "account"
                      ? "Share resume from your account (works on any device when signed in)"
                      : "Share resume from this device"
                  }
                >
                  {shareLabel} resume
                </button>
              )}
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

            <div className="space-y-3 rounded-xl border border-brand-border/70 bg-brand-panel/60 p-4 text-xs text-brand-muted">
              <div>
                <p className="font-medium text-brand-text">Card link</p>
                <p className="mt-1 break-all font-mono text-[11px]">{shareUrl}</p>
              </div>
              <div>
                <p className="font-medium text-brand-text">Start chat (autostart)</p>
                <p className="mt-1 break-all font-mono text-[11px]">{autostartUrl}</p>
              </div>
              <div>
                <p className="font-medium text-rose-100">Edge Pace (autostart)</p>
                <p className="mt-1 break-all font-mono text-[11px]">{edgePaceUrl}</p>
              </div>
              {resumeUrl && resumeCode ? (
                <div>
                  <p className="font-medium text-amber-200">
                    Resume ({resumeCode})
                    <span className="ml-1 font-normal text-brand-muted">
                      · {resumeSource === "account" ? "account / multi-device" : "this device"}
                    </span>
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px]">{resumeUrl}</p>
                </div>
              ) : (
                <p className="text-[11px] text-brand-muted">
                  Resume share appears after you chat while signed in (synced via account sessions).
                </p>
              )}
            </div>
          </div>
        </section>

        <footer className="mt-10 text-center text-xs text-brand-muted">
          Uncensored 18+ · Naughty Syntax / KGC Ventures
        </footer>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-border/70 bg-brand-bg/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-lg flex-wrap gap-2">
          <Link href={card.ctaPath} className="btn-primary min-w-[5rem] flex-1">
            Start
          </Link>
          <Link
            href={
              card.edgePacePath ||
              `/chat?character=${encodeURIComponent(card.id)}&autostart=1&mode=edge_pace`
            }
            className="btn-ghost min-w-[5rem] flex-1 border-rose-400/40 text-rose-100"
          >
            Edge Pace
          </Link>
          <button
            type="button"
            onClick={() => void onShareCard()}
            className="btn-ghost min-w-[4.5rem] flex-1"
          >
            {shareLabel} card
          </button>
          <button
            type="button"
            onClick={() => void onShareAutostart()}
            className="btn-ghost min-w-[4.5rem] flex-1"
          >
            {shareLabel} start
          </button>
          {resumeCode && (
            <button
              type="button"
              onClick={() => void onShareResume()}
              className="btn-ghost min-w-[4.5rem] flex-1 border-amber-500/40 text-amber-200"
            >
              {shareLabel} resume
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
