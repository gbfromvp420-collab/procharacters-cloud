"use client";

import Link from "next/link";
import { useState } from "react";
import type { CharacterCard } from "@/lib/character-card";
import {
  buildResumeChatPath,
  formatResumeExpiryShort,
  isResumeExpiryUrgent,
  type ResumeCacheEntry,
} from "@/lib/resume-cache";
import { posterUrl } from "./GalleryTiles";

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

  const copyCode = async () => {
    const code = continueTarget.resumeCode?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback for older mobile webviews
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
              <video className="h-full w-full object-cover" src={posterUrl(continueCard)} autoPlay muted loop playsInline preload="metadata" />
            </div>
          ) : (
            <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-black/50 text-lg sm:h-20 sm:w-14">▶</div>
          )}
          <div className="min-w-0">
            <p className={`text-[10px] uppercase tracking-[0.28em] ${urgent ? "text-rose-200/90" : "text-amber-200/90"}`}>
              Continue where you left off
            </p>
            <p className="truncate text-base font-semibold text-brand-text sm:text-lg">
              {continueCard?.displayName || continueTarget.characterName || "Your last chat"}
            </p>
            <p className={`mt-0.5 truncate font-mono text-[11px] ${urgent ? "text-rose-100/85" : "text-amber-100/80"}`}>
              Code {continueTarget.resumeCode}
              {continueTarget.source === "account" ? " · synced" : " · this device"}
              {expiryLabel ? ` · ${expiryLabel}` : ""}
              {resumeCount > 1 ? ` · +${resumeCount - 1} more` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
          <Link
            href={href}
            className={`btn-primary min-h-touch flex-1 px-4 py-2.5 text-sm sm:flex-none ${
              urgent ? "ring-2 ring-rose-400/60" : ""
            }`}
          >
            {urgent && expiryLabel === "expired" ? "Reclaim chat" : "Continue"}
          </Link>
          <button
            type="button"
            onClick={() => void copyCode()}
            className="btn-ghost min-h-0 flex-1 px-3 py-2 text-xs text-amber-100/90 sm:flex-none"
            title="Copy resume code for another device"
          >
            {copied ? "Copied!" : "Copy code"}
          </button>
          {resumeCount > 1 && (
            <button type="button" onClick={onShowAllMyChats} className="btn-ghost min-h-0 flex-1 px-3 py-2 text-xs text-amber-100/90 sm:flex-none">
              All my chats
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
