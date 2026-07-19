"use client";

import Link from "next/link";
import { useState } from "react";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import { buildResumeChatPath } from "@/lib/resume-cache";
import { canNativeShare, shareOrCopyText, shareResultLabel } from "@/lib/share-links";

/**
 * After End — heat is saved, path back is one tap. Morph the goodbye into return.
 */
export function SessionPausedBanner({
  characterId,
  characterName,
  resumeCode,
  messageCount,
  onResume,
  onDismiss,
}: {
  characterId: string;
  characterName?: string | null;
  resumeCode?: string | null;
  messageCount?: number;
  onResume?: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const mind = mindFingerprint(characterId);
  const nick = characterName?.trim().split(/\s+/)[0] || characterName || "them";
  const href = resumeCode
    ? buildResumeChatPath({ characterId, resumeCode })
    : `/chat?character=${encodeURIComponent(characterId)}&autostart=1`;

  const copyCode = async () => {
    if (!resumeCode) return;
    const result = await shareOrCopyText({ text: resumeCode, title: `Resume ${nick}` });
    if (shareResultLabel(result, "Code")) setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className="mb-3 animate-rise-in rounded-xl border border-brand-accent/35 bg-gradient-to-r from-brand-accent/10 via-brand-panel to-brand-panel px-3 py-3 text-[11px] leading-relaxed shadow-glow-sm"
      role="status"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
        Session paused · heat saved
        {mind ? ` · ${mind.tag}` : ""}
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
