"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadStoredAccount } from "@/lib/account-storage";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import { buildResumeChatPath } from "@/lib/resume-cache";
import { canNativeShare, shareOrCopyText, shareResultLabel } from "@/lib/share-links";
import {
  getLocalPushSubscription,
  isPushSupported,
} from "@/lib/web-push-client";

/**
 * After End — heat is saved, path back is one tap. Morph the goodbye into return.
 * Mine models get Edit + My models so ownership loop stays closed.
 * Deep sessions get a return seed: hold heat + optional push nudge.
 */
export function SessionPausedBanner({
  characterId,
  characterName,
  resumeCode,
  messageCount,
  isMine = false,
  onResume,
  onDismiss,
}: {
  characterId: string;
  characterName?: string | null;
  resumeCode?: string | null;
  messageCount?: number;
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
    ? buildResumeChatPath({ characterId, resumeCode })
    : `/chat?character=${encodeURIComponent(characterId)}&autostart=1`;

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
          // Still seed sign-in for guests with heat
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
          : "border-brand-accent/35 from-brand-accent/10 via-brand-panel to-brand-panel"
      }`}
      role="status"
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${
          isMine ? "text-violet-200/90" : "text-brand-accent"
        }`}
      >
        Session paused · heat saved
        {isMine ? " · my model" : mind ? ` · ${mind.tag}` : ""}
      </p>
      <p className="mt-1.5 text-sm text-brand-text">
        You left <strong>{nick}</strong> mid-flow
        {messageCount && messageCount > 0 ? ` · ${messageCount} messages deep` : ""}.
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
      {deep && (
        <p className="mt-1.5 text-[11px] text-brand-muted">
          We&apos;ll hold this heat
          {resumeCode ? " on your code" : ""}
          {" — "}
          one tap Continue when you&apos;re ready. Free path stays open.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {onResume ? (
          <button type="button" onClick={onResume} className="btn-primary min-h-0 px-4 py-2 text-xs">
            Continue · {nick}
          </button>
        ) : (
          <Link href={href} className="btn-primary min-h-0 px-4 py-2 text-xs">
            Continue · {nick}
          </Link>
        )}
        {isMine && (
          <>
            <Link
              href={`/chat?character=${encodeURIComponent(characterId)}&edit=1`}
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
        <Link href="/" className="btn-ghost min-h-0 px-4 py-2 text-xs">
          Gallery
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
