"use client";

import Link from "next/link";
import type { CharacterCard } from "@/lib/character-card";
import {
  buildResumeChatPath,
  type ResumeCacheEntry,
} from "@/lib/resume-cache";

function posterUrl(card: CharacterCard): string {
  const poster = card.posterClip;
  if (poster.startsWith("http") || poster.startsWith("/")) return poster;
  return `/${poster}`;
}

export function ContinueStrip({
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
  const continueHref = buildResumeChatPath(continueTarget);
  return (
    <section
      className="mb-6 animate-rise-in overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-brand-panel to-brand-panel shadow-glow-sm sm:mb-8"
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
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/90">
              Continue where you left off
            </p>
            <p className="truncate text-base font-semibold text-brand-text sm:text-lg">
              {continueCard?.displayName ||
                continueTarget.characterName ||
                "Your last chat"}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-amber-100/80">
              Code {continueTarget.resumeCode}
              {continueTarget.source === "account" ? " · synced" : " · this device"}
              {resumeCount > 1 ? ` · +${resumeCount - 1} more` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
          <Link
            href={continueHref}
            className="btn-primary min-h-touch flex-1 px-4 py-2.5 text-sm sm:flex-none"
          >
            Continue
          </Link>
          {resumeCount > 1 && (
            <button
              type="button"
              onClick={onShowAllMyChats}
              className="btn-ghost min-h-0 flex-1 px-3 py-2 text-xs text-amber-100/90 sm:flex-none"
            >
              All my chats
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function continueChatHref(entry: ResumeCacheEntry | null): string | null {
  if (!entry?.resumeCode) return null;
  return buildResumeChatPath(entry);
}
