"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  fetchBillingCatalog,
  fetchBillingStatus,
  formatUsdCents,
  startBillingCheckout,
} from "@/lib/api";
import { loadStoredAccount } from "@/lib/account-storage";
import {
  markSoftSupportCooldownAfterWin,
  setSessionWinActive,
} from "@/lib/conversion-flags";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import {
  buildForgeFromHeatPath,
  shouldOfferForgeFromHeat,
  stashForgeHeatSeed,
  type ForgeHeatContext,
} from "@/lib/forge-from-heat";
import { canNativeShare, shareOrCopyText, shareResultLabel } from "@/lib/share-links";

const SEEN_KEY = "procharacters.sessionWin.seen.v1";

/**
 * First “this is sticky” win — resume code landed + real chat heat.
 * Celebrates, copies code, points at push/install without blocking free chat.
 * Soft Day Pass CTA only when signed in + Stripe ready + not already premium.
 * Owns the heat→pay moment — Soft Support yields while this is visible.
 * Deep / DNA heat: Forge this heat → Studio DNA seed.
 */
export function SessionWinToast({
  show,
  characterId,
  characterName,
  resumeCode,
  messageCount,
  dnaTreeLabel,
  dnaTreeNodeId,
  heatDepth,
  heatChips,
  recapLine,
  baseModelId,
  isMine = false,
}: {
  show: boolean;
  characterId?: string | null;
  characterName?: string | null;
  resumeCode?: string | null;
  messageCount: number;
  /** Studio Forge DNA node when heat climbed mid-session. */
  dnaTreeLabel?: string | null;
  dnaTreeNodeId?: string | null;
  heatDepth?: string | null;
  heatChips?: string[] | null;
  recapLine?: string | null;
  baseModelId?: string | null;
  isMine?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [offerCheckout, setOfferCheckout] = useState(false);
  const [dayPrice, setDayPrice] = useState("$4.99");
  const [busy, setBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const offeredCheckoutRef = useRef(false);
  const mind = mindFingerprint(characterId);
  const nick = characterName?.trim().split(/\s+/)[0] || "them";
  const dnaLabel = dnaTreeLabel?.trim() || dnaTreeNodeId?.trim() || null;
  const deepDna =
    !!dnaLabel &&
    /edge|deny|release|gate|tease/i.test(dnaLabel);
  const forgeHeatCtx: ForgeHeatContext | null =
    characterId
      ? {
          characterId,
          characterName,
          baseModelId: baseModelId || characterId,
          dnaTreeLabel,
          dnaTreeNodeId,
          heatDepth,
          heatChips,
          recapLine,
          messageCount,
          isMine,
        }
      : null;
  const offerForge =
    !!forgeHeatCtx &&
    shouldOfferForgeFromHeat({
      messageCount,
      dnaTreeLabel,
      dnaTreeNodeId,
      heatDepth,
    });
  const forgeHref = offerForge && forgeHeatCtx ? buildForgeFromHeatPath(forgeHeatCtx) : null;

  useEffect(() => {
    // DNA climbs count as heat faster — unlock win toast at 2 msgs if tree is deep
    const minMsgs = deepDna ? 2 : 3;
    if (!show || !resumeCode || messageCount < minMsgs) {
      setVisible(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem(SEEN_KEY);
      const seen = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      // Once per character per device (re-show after 7d)
      const last = seen[characterId || resumeCode] ?? 0;
      if (Date.now() - last < 7 * 24 * 60 * 60 * 1000) {
        setVisible(false);
        return;
      }
    } catch {
      /* show anyway */
    }
    setVisible(true);
    try {
      const raw = window.localStorage.getItem(SEEN_KEY);
      const seen = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      seen[characterId || resumeCode] = Date.now();
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setVisible(false), 4500);
    return () => window.clearTimeout(t);
  }, [show, resumeCode, messageCount, characterId, deepDna]);

  useEffect(() => {
    setSessionWinActive(visible);
    return () => {
      setSessionWinActive(false);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setOfferCheckout(false);
      offeredCheckoutRef.current = false;
      return;
    }
    let cancelled = false;
    async function probe() {
      try {
        const account = loadStoredAccount();
        if (!account) {
          if (!cancelled) setOfferCheckout(false);
          return;
        }
        const status = await fetchBillingStatus(account.token);
        if (cancelled) return;
        if (status.activePremium || !status.configured) {
          setOfferCheckout(false);
          return;
        }
        setOfferCheckout(true);
        offeredCheckoutRef.current = true;
        try {
          const cat = await fetchBillingCatalog();
          const day = cat.products?.find((p) => p.id === "day_pass");
          if (day && !cancelled) {
            setDayPrice(formatUsdCents(day.amountCents, day.currency));
          }
        } catch {
          /* keep default $4.99 */
        }
      } catch {
        if (!cancelled) setOfferCheckout(false);
      }
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible || !resumeCode) return null;

  const dismiss = (persist: boolean) => {
    if (persist) {
      try {
        const raw = window.localStorage.getItem(SEEN_KEY);
        const seen = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        seen[characterId || resumeCode] = Date.now();
        window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
      } catch {
        /* ignore */
      }
    }
    // Heat-win owned the Day Pass ask — Soft Support cools down so no double-stack
    if (offeredCheckoutRef.current || offerCheckout) {
      markSoftSupportCooldownAfterWin();
    }
    setSessionWinActive(false);
    setVisible(false);
  };

  const copyCode = async () => {
    const result = await shareOrCopyText({
      text: resumeCode,
      title: `Resume ${nick}`,
    });
    const label = shareResultLabel(result, "Resume code");
    if (label) setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const onDayPass = async () => {
    const account = loadStoredAccount();
    if (!account) {
      window.location.href = "/account";
      return;
    }
    setBusy(true);
    setCheckoutError(null);
    try {
      const { url } = await startBillingCheckout(account.token, "day_pass");
      // Persist seen so we don't re-ask heat-win after Stripe return
      dismiss(true);
      window.location.href = url;
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "Checkout failed — free chat still works",
      );
      setBusy(false);
    }
  };

  return (
    <div
      className={`animate-rise-in rounded-xl border px-3 py-2 text-[11px] leading-relaxed shadow-glow-sm ${
        deepDna
          ? "border-violet-400/45 bg-gradient-to-r from-violet-500/15 via-emerald-500/10 to-brand-panel"
          : "border-emerald-400/40 bg-gradient-to-r from-emerald-500/15 via-brand-panel to-brand-panel"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
              deepDna ? "text-violet-200/95" : "text-emerald-200/90"
            }`}
          >
            {deepDna ? "DNA heat locked in" : "Heat locked in"}
            {mind ? ` · ${mind.tag}` : ""}
            {dnaLabel ? ` · DNA ${dnaLabel}` : ""}
          </p>
          <p className="mt-1 text-brand-muted">
            You’re in with <strong className="text-brand-text">{nick}</strong>
            {dnaLabel ? (
              <>
                {" "}
                on{" "}
                <strong className="text-violet-200">DNA · {dnaLabel}</strong>
              </>
            ) : null}
            . Resume code{" "}
            <span className="font-mono text-emerald-100">{resumeCode}</span> saves this climb —
            come back anytime{messageCount >= 3 ? ` · ${messageCount} messages deep` : ""}.
            {offerCheckout ? (
              <>
                {" "}
                Optional <strong className="text-amber-100">Day Pass</strong> unlocks more forged
                My Characters — free chat never paywalls.
              </>
            ) : null}
          </p>
          {checkoutError && (
            <p className="mt-1.5 text-[10px] text-rose-300/90" role="alert">
              {checkoutError}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyCode()}
              className="btn-primary min-h-0 px-3 py-1.5 text-xs"
            >
              {copied ? "Copied!" : canNativeShare() ? "Share code" : "Copy code"}
            </button>
            {forgeHref && forgeHeatCtx && (
              <Link
                href={forgeHref}
                className="btn-ghost min-h-0 border-violet-400/55 bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-50 ring-1 ring-violet-300/35"
                title="Mint private DNA from this climb"
                onClick={() => {
                  stashForgeHeatSeed(forgeHeatCtx);
                  dismiss(true);
                }}
              >
                {dnaLabel ? `Forge this DNA · ${dnaLabel}` : "Forge this heat"}
              </Link>
            )}
            {offerCheckout && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDayPass()}
                className={`btn-ghost min-h-0 px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                  deepDna
                    ? "border-violet-400/55 bg-violet-500/20 text-violet-50"
                    : "border-amber-400/55 bg-amber-500/15 text-amber-100"
                }`}
                title="Optional — free chat never paywalls"
              >
                {busy
                  ? "Opening…"
                  : deepDna
                    ? `Keep forging · Day Pass · ${dayPrice}`
                    : `Day Pass · ${dayPrice}`}
              </button>
            )}
            <Link
              href="/"
              className="btn-ghost min-h-0 px-3 py-1.5 text-xs"
              onClick={() => dismiss(true)}
            >
              Gallery
            </Link>
            <Link
              href="/account"
              className="btn-ghost min-h-0 border-amber-500/35 px-3 py-1.5 text-xs text-amber-100"
              onClick={() => dismiss(true)}
            >
              Push · Account
            </Link>
            <button
              type="button"
              onClick={() => dismiss(true)}
              className="min-h-0 px-2 py-1.5 text-[10px] text-brand-muted hover:text-brand-text"
            >
              Keep chatting
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dismiss(true)}
          className="shrink-0 text-[10px] text-brand-muted hover:text-brand-text"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
