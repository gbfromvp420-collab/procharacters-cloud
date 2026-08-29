"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { CharacterCard } from "@/lib/character-card";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import {
  buildForgeFromHeatPath,
  shouldOfferForgeFromHeat,
  stashForgeHeatSeed,
} from "@/lib/forge-from-heat";
import {
  buildResumeChatPath,
  formatResumeExpiryShort,
  isResumeExpiryUrgent,
  type ResumeCacheEntry,
} from "@/lib/resume-cache";
import { buildResumeCodeShareUrl } from "@/lib/share-links";
import { posterUrl } from "./GalleryTiles";
import { MoreMenu } from "./MoreMenu";

export function ContinueBanner({
  continueTarget,
  continueCard,
  resumeCount,
  onShowAllMyChats,
}: {
  continueTarget: ResumeCacheEntry;
  continueCard: CharacterCard | null;
  resumeCount: number;
  onShowAllMyChats: () => void;
}) {
  const href = buildResumeChatPath(continueTarget);
  const expiryLabel = formatResumeExpiryShort(continueTarget.resumeExpiresAt);
  const urgent = isResumeExpiryUrgent(continueTarget.resumeExpiresAt);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const mind = mindFingerprint(continueTarget.characterId);
  const recap =
    continueTarget.recapLine?.trim() ||
    continueCard?.teaser?.trim() ||
    mind?.blurb ||
    null;
  const displayName =
    continueCard?.displayName || continueTarget.characterName || "Your last chat";
  const nick = displayName.trim().split(/\s+/)[0] || displayName;
  const trailDepth = continueTarget.heatDepth;
  const trailChips = continueTarget.heatChips?.slice(0, 4) ?? [];
  const trailMind = continueTarget.mindTag || mind?.tag;
  const dnaLabel =
    continueTarget.dnaTreeLabel?.trim() ||
    continueTarget.dnaTreeNodeId?.trim() ||
    null;
  const depthLevel =
    trailDepth === "locked"
      ? 4
      : trailDepth === "deep"
        ? 3
        : trailDepth === "edge"
          ? 2
          : trailDepth === "warm"
            ? 1
            : trailDepth === "spark"
              ? 0
              : null;
  const resumeUrl = buildResumeCodeShareUrl(continueTarget.resumeCode, {
    characterId: continueTarget.characterId,
    rehydrate: true,
    sessionMode: dnaLabel ? "edge_pace" : undefined,
  });

  const forgeHeatCtx = {
    characterId: continueTarget.characterId,
    characterName: displayName,
    baseModelId:
      continueCard?.avatarBase ||
      (continueTarget.characterId.startsWith("custom-")
        ? undefined
        : continueTarget.characterId),
    dnaTreeLabel: continueTarget.dnaTreeLabel,
    dnaTreeNodeId: continueTarget.dnaTreeNodeId,
    heatDepth: continueTarget.heatDepth,
    heatChips: continueTarget.heatChips,
    recapLine: continueTarget.recapLine,
    messageCount: continueTarget.messageCount,
  };
  const offerForge = shouldOfferForgeFromHeat({
    messageCount: continueTarget.messageCount,
    dnaTreeLabel: continueTarget.dnaTreeLabel,
    dnaTreeNodeId: continueTarget.dnaTreeNodeId,
    heatDepth: continueTarget.heatDepth,
  });
  const forgeHref = offerForge ? buildForgeFromHeatPath(forgeHeatCtx) : null;

  useEffect(() => {
    if (!showQr) return;
    let cancelled = false;
    setQrError(null);
    void QRCode.toDataURL(resumeUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#0a0a0a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrError("Could not render QR");
      });
    return () => {
      cancelled = true;
    };
  }, [showQr, resumeUrl]);

  const copyCode = async () => {
    const code = continueTarget.resumeCode?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <section
      className={`mb-6 animate-rise-in overflow-hidden rounded-2xl border bg-gradient-to-r via-brand-panel to-brand-panel shadow-glow-sm sm:mb-8 ${
        urgent
          ? "border-rose-500/50 from-rose-500/20"
          : "border-amber-500/40 from-amber-500/15"
      }`}
      aria-label="Continue where you left off"
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {continueCard ? (
            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-brand-border bg-black sm:h-20 sm:w-14">
              <video
                className="h-full w-full object-cover"
                src={posterUrl(continueCard)}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
          ) : (
            <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-black/50 text-lg sm:h-20 sm:w-14">
              ▶
            </div>
          )}
          <div className="min-w-0">
            <p
              className={`text-[10px] uppercase tracking-[0.28em] ${
                urgent ? "text-rose-200/90" : "text-amber-200/90"
              }`}
            >
              {dnaLabel
                ? `DNA power · ${nick}`
                : continueTarget.recapLine || trailDepth
                  ? `Heat trail · ${nick}`
                  : "Continue where you left off"}
            </p>
            <p className="truncate text-base font-semibold text-brand-text sm:text-lg">
              {displayName}
              {trailMind ? (
                <span className="ml-2 text-xs font-normal text-brand-muted">
                  · {trailMind}
                </span>
              ) : null}
              {dnaLabel ? (
                <span className="ml-2 rounded-full border border-violet-400/40 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-100">
                  DNA · {dnaLabel}
                </span>
              ) : null}
            </p>
            {(trailDepth || depthLevel != null) && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {depthLevel != null && (
                  <div className="flex items-center gap-0.5" aria-hidden>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-2.5 rounded-full ${
                          i <= depthLevel
                            ? i >= 3
                              ? "bg-rose-400"
                              : "bg-amber-300"
                            : "bg-brand-border/80"
                        }`}
                      />
                    ))}
                  </div>
                )}
                {trailDepth && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-100/90">
                    {trailDepth}
                  </span>
                )}
                {typeof continueTarget.messageCount === "number" &&
                  continueTarget.messageCount > 0 && (
                    <span className="font-mono text-[10px] text-brand-soft">
                      {continueTarget.messageCount} msgs
                    </span>
                  )}
              </div>
            )}
            {trailChips.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {trailChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-rose-100/90"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
            {recap && (
              <p
                className={`mt-0.5 line-clamp-2 text-[11px] leading-snug ${
                  urgent ? "text-rose-100/85" : "text-amber-100/85"
                }`}
              >
                {continueTarget.recapLine ? `“${recap}”` : recap}
              </p>
            )}
            <p
              className={`mt-0.5 truncate font-mono text-[11px] ${
                urgent ? "text-rose-100/70" : "text-amber-100/70"
              }`}
            >
              Code {continueTarget.resumeCode}
              {continueTarget.source === "account" ? " · synced" : " · this device"}
              {expiryLabel ? ` · ${expiryLabel}` : ""}
              {resumeCount > 1 ? ` · +${resumeCount - 1} more` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={href}
            className={`btn-primary min-h-10 flex-1 px-4 py-2.5 text-sm sm:flex-none ${
              urgent ? "ring-2 ring-rose-400/60" : dnaLabel ? "ring-1 ring-violet-300/45" : ""
            }`}
          >
            {urgent && expiryLabel === "expired"
              ? "Reclaim"
              : dnaLabel
                ? `DNA · ${nick}`
                : `Continue · ${nick}`}
          </Link>
          <MoreMenu>
            {forgeHref ? (
              <Link href={forgeHref} onClick={() => stashForgeHeatSeed(forgeHeatCtx)} role="menuitem">
                {dnaLabel ? `Forge · ${dnaLabel.split(/\s+/)[0]}` : "Forge this heat"}
              </Link>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => setShowQr((v) => !v)}
            >
              {showQr ? "Hide QR" : "QR for other phone"}
            </button>
            <button type="button" role="menuitem" onClick={() => void copyCode()}>
              {copied ? "Copied" : "Copy resume code"}
            </button>
            {resumeCount > 1 ? (
              <button type="button" role="menuitem" onClick={onShowAllMyChats}>
                All my chats
              </button>
            ) : null}
          </MoreMenu>
        </div>
      </div>

      {showQr && (
        <div className="flex flex-col items-center gap-2 border-t border-amber-500/20 bg-black/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-center sm:gap-5">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`QR code to resume chat with ${displayName}`}
              className="h-40 w-40 rounded-xl border border-white/20 bg-white p-2 shadow-card"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-brand-border bg-brand-panel text-xs text-brand-muted">
              {qrError ?? "Generating QR…"}
            </div>
          )}
          <div className="max-w-xs text-center text-[11px] leading-relaxed text-amber-100/85 sm:text-left">
            <p className="font-semibold uppercase tracking-[0.18em] text-amber-200/90">
              Scan to continue · {nick}
            </p>
            <p className="mt-1 text-brand-muted">
              Point another phone’s camera here — opens the same resume without typing the code.
            </p>
            <p className="mt-1.5 font-mono text-[10px] text-amber-100/70">
              {continueTarget.resumeCode}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
