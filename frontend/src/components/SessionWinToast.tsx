"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import { canNativeShare, shareOrCopyText, shareResultLabel } from "@/lib/share-links";

const SEEN_KEY = "procharacters.sessionWin.seen.v1";

/**
 * First “this is sticky” win — resume code landed + real chat heat.
 * Celebrates, copies code, points at push/install without blocking free chat.
 */
export function SessionWinToast({
  show,
  characterId,
  characterName,
  resumeCode,
  messageCount,
}: {
  show: boolean;
  characterId?: string | null;
  characterName?: string | null;
  resumeCode?: string | null;
  messageCount: number;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const mind = mindFingerprint(characterId);
  const nick = characterName?.trim().split(/\s+/)[0] || "them";

  useEffect(() => {
    if (!show || !resumeCode || messageCount < 3) {
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
  }, [show, resumeCode, messageCount, characterId]);

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

  return (
    <div
      className="mb-3 animate-rise-in rounded-xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/15 via-brand-panel to-brand-panel px-3 py-2.5 text-[11px] leading-relaxed shadow-glow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/90">
            Heat locked in
            {mind ? ` · ${mind.tag}` : ""}
          </p>
          <p className="mt-1 text-brand-muted">
            You’re in with <strong className="text-brand-text">{nick}</strong>. Resume code{" "}
            <span className="font-mono text-emerald-100">{resumeCode}</span> saves this chat —
            come back anytime{messageCount >= 3 ? ` · ${messageCount} messages deep` : ""}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyCode()}
              className="btn-primary min-h-0 px-3 py-1.5 text-xs"
            >
              {copied ? "Copied!" : canNativeShare() ? "Share code" : "Copy code"}
            </button>
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
