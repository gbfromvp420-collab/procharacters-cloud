"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadStoredAccount } from "@/lib/account-storage";
import {
  buildForgeFromHeatPath,
  shouldOfferForgeFromHeat,
  stashForgeHeatSeed,
} from "@/lib/forge-from-heat";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import {
  buildResumeChatPath,
  type HeatTrailDepth,
} from "@/lib/resume-cache";
import { canNativeShare, shareOrCopyText, shareResultLabel } from "@/lib/share-links";
import {
  getLocalPushSubscription,
  isPushSupported,
} from "@/lib/web-push-client";

/**
 * After End — heat is saved, path back is one tap. Morph the goodbye into return.
 * Mine models get Edit + My models so ownership loop stays closed.
 * Deep sessions + heat trail: show where you left the edge.
 * Deep / DNA heat: Forge this heat → Studio DNA seed.
 */
export function SessionPausedBanner({
  characterId,
  characterName,
  resumeCode,
  messageCount,
  heatDepth,
  heatChips,
  recapLine,
  dnaTreeLabel,
  dnaTreeNodeId,
  baseModelId,
  isMine = false,
  onResume,
  onDismiss,
}: {
  characterId: string;
  characterName?: string | null;
  resumeCode?: string | null;
  messageCount?: number;
  heatDepth?: HeatTrailDepth | null;
  heatChips?: string[] | null;
  recapLine?: string | null;
  dnaTreeLabel?: string | null;
  dnaTreeNodeId?: string | null;
  /** Catalog base for Studio forge prefill */
  baseModelId?: string | null;
  /** Private My Character — show ownership CTAs */
  isMine?: boolean;
  onResume?: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [pushSeed, setPushSeed] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const mind = mindFingerprint(characterId, {
    displayName: characterName,
  });
  const nick = characterName?.trim().split(/\s+/)[0] || characterName || "them";
  const deep = (messageCount ?? 0) >= 3;
  const href = resumeCode
    ? buildResumeChatPath({
        characterId,
        resumeCode,
        dnaTreeLabel: dnaTreeLabel ?? undefined,
        dnaTreeNodeId: dnaTreeNodeId ?? undefined,
        heatDepth: heatDepth ?? undefined,
      })
    : `/chat?character=${encodeURIComponent(characterId)}&autostart=1`;

  const depthLevel =
    heatDepth === "locked"
      ? 4
      : heatDepth === "deep"
        ? 3
        : heatDepth === "edge"
          ? 2
          : heatDepth === "warm"
            ? 1
            : heatDepth === "spark"
              ? 0
              : null;
  const chips = heatChips?.slice(0, 4) ?? [];
  const dnaLabel = dnaTreeLabel?.trim() || dnaTreeNodeId?.trim() || null;
  const offerForge = shouldOfferForgeFromHeat({
    messageCount,
    dnaTreeLabel,
    dnaTreeNodeId,
    heatDepth,
  });
  const forgeHeatCtx = {
    characterId,
    characterName,
    baseModelId:
      baseModelId ||
      (characterId.startsWith("custom-") ? undefined : characterId),
    dnaTreeLabel,
    dnaTreeNodeId,
    heatDepth,
    heatChips,
    recapLine,
    messageCount,
    isMine,
  };
  const forgeHref = offerForge ? buildForgeFromHeatPath(forgeHeatCtx) : null;

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      if (!deep) {
        if (!cancelled) {
          setPushSeed(false);
          setSignedIn(false);
        }
        return;
      }
      try {
        const account = loadStoredAccount();
        if (!cancelled) setSignedIn(!!account);
        if (!isPushSupported()) {
          if (!cancelled) setPushSeed(!account);
          return;
        }
        if (!account) {
          if (!cancelled) setPushSeed(true);
          return;
        }
        const sub = await getLocalPushSubscription();
        if (!cancelled) setPushSeed(!sub);
      } catch {
        if (!cancelled) setPushSeed(false);
      }
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, [deep]);

  const copyCode = async () => {
    if (!resumeCode) return;
    const result = await shareOrCopyText({ text: resumeCode, title: `Resume ${nick}` });
    if (shareResultLabel(result, "Code")) setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className={`mb-3 animate-rise-in rounded-xl border bg-gradient-to-r px-3 py-3 text-[11px] leading-relaxed shadow-glow-sm ${
        isMine
          ? "border-violet-400/40 from-violet-500/15 via-brand-panel to-brand-panel"
          : deep
            ? "border-rose-400/40 from-rose-500/12 via-brand-panel to-brand-panel"
            : "border-brand-accent/35 from-brand-accent/10 via-brand-panel to-brand-panel"
      }`}
      role="status"
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${
          isMine
            ? "text-violet-200/90"
            : deep
              ? "text-rose-200/90"
              : "text-brand-accent"
        }`}
      >
        Session paused · heat trail saved
        {isMine ? " · my model" : mind ? ` · ${mind.tag}` : ""}
        {heatDepth ? ` · ${heatDepth}` : ""}
        {dnaLabel ? ` · DNA ${dnaLabel}` : ""}
      </p>
      <p className="mt-1.5 text-sm text-brand-text">
        You left <strong>{nick}</strong> mid-flow
        {messageCount && messageCount > 0 ? ` · ${messageCount} messages deep` : ""}
        {dnaLabel ? (
          <>
            {" "}
            on <span className="font-semibold text-violet-200">DNA · {dnaLabel}</span>
          </>
        ) : (
          ""
        )}
        .
        {resumeCode ? (
          <>
            {" "}
            Code{" "}
            <span className="font-mono text-amber-100">{resumeCode}</span> brings you back.
          </>
        ) : (
          " Start again anytime — free path stays open."
        )}
      </p>

      {(depthLevel != null || chips.length > 0 || dnaLabel) && (
        <div className="mt-2 space-y-1.5">
          {depthLevel != null && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-2.5 rounded-full ${
                      i <= depthLevel
                        ? i >= 3
                          ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]"
                          : "bg-amber-300"
                        : "bg-brand-border"
                    }`}
                  />
                ))}
              </div>
              {heatDepth && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-100/90">
                  {heatDepth}
                </span>
              )}
              {dnaLabel && (
                <span className="rounded-full border border-violet-400/45 bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-100">
                  DNA · {dnaLabel}
                </span>
              )}
            </div>
          )}
          {depthLevel == null && dnaLabel && (
            <span className="inline-flex rounded-full border border-violet-400/45 bg-violet-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-100">
              DNA · {dnaLabel}
            </span>
          )}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-rose-400/35 bg-rose-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-rose-100/90"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          {recapLine?.trim() && (
            <p className="line-clamp-2 text-[11px] italic text-brand-muted">
              “{recapLine.trim()}”
            </p>
          )}
        </div>
      )}

      {deep && (
        <p className="mt-1.5 text-[11px] text-brand-muted">
          We&apos;ll hold this heat
          {resumeCode ? " on your code" : ""}
          {heatDepth ? ` at ${heatDepth}` : ""}
          {dnaLabel ? ` · DNA ${dnaLabel}` : ""}
          {" — "}
          one tap {dnaLabel ? "DNA power reclaim" : "Continue"} when you&apos;re ready. Free path
          stays open.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {onResume ? (
          <button
            type="button"
            onClick={onResume}
            className={`btn-primary min-h-0 px-4 py-2 text-xs ${
              dnaLabel ? "ring-1 ring-violet-300/50" : ""
            }`}
          >
            {dnaLabel ? `DNA power · ${nick}` : `Continue · ${nick}`}
          </button>
        ) : (
          <Link
            href={href}
            className={`btn-primary min-h-0 px-4 py-2 text-xs ${
              dnaLabel ? "ring-1 ring-violet-300/50" : ""
            }`}
          >
            {dnaLabel ? `DNA power · ${nick}` : `Continue · ${nick}`}
          </Link>
        )}
        {isMine && (
          <>
            <Link
              href={`/models/studio/edit/${encodeURIComponent(characterId)}`}
              className="btn-ghost min-h-0 border-violet-400/40 px-3 py-2 text-xs text-violet-100"
              onClick={onDismiss}
            >
              Edit model
            </Link>
            <Link
              href="/account#my-models"
              className="btn-ghost min-h-0 border-violet-400/30 px-3 py-2 text-xs text-violet-100/90"
              onClick={onDismiss}
            >
              My models
            </Link>
          </>
        )}
        {forgeHref && (
          <Link
            href={forgeHref}
            className="btn-ghost min-h-0 border-violet-400/50 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-50 ring-1 ring-violet-300/30"
            onClick={() => {
              stashForgeHeatSeed(forgeHeatCtx);
              onDismiss();
            }}
            title="Mint private DNA from this climb"
          >
            {dnaLabel ? `Forge this DNA · ${dnaLabel}` : "Forge this heat"}
          </Link>
        )}
        <Link href="/" className="btn-ghost min-h-0 px-4 py-2 text-xs">
          Gallery trail
        </Link>
        {resumeCode && (
          <button
            type="button"
            onClick={() => void copyCode()}
            className="btn-ghost min-h-0 border-amber-500/35 px-3 py-2 text-xs text-amber-100"
          >
            {copied ? "Copied!" : canNativeShare() ? "Share code" : "Copy code"}
          </button>
        )}
        {pushSeed && (
          <Link
            href="/account"
            className="btn-ghost min-h-0 border-emerald-400/40 px-3 py-2 text-xs text-emerald-100"
            onClick={onDismiss}
            title="Optional — never required for free chat"
          >
            {signedIn ? "Enable alerts · hold heat" : "Sign in · hold heat"}
          </Link>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-0 px-2 py-2 text-[10px] text-brand-muted hover:text-brand-text"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
