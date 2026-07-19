"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";
import {
  formatResumeExpiryShort,
  isResumeExpiryUrgent,
} from "@/lib/resume-cache";
import type { StoredSession } from "@/lib/session-storage";

/**
 * Idle chat — make Resume the hero path when a device session exists.
 */
export function ChatResumeHero({
  saved,
  onResume,
  onStartFresh,
  busy,
}: {
  saved: StoredSession;
  onResume: () => void;
  onStartFresh: () => void;
  busy?: boolean;
}) {
  const mind = mindFingerprint(saved.characterId);
  const nick =
    saved.characterName?.trim().split(/\s+/)[0] ||
    saved.characterName ||
    "your chat";
  const expiry = formatResumeExpiryShort(saved.resumeExpiresAt);
  const urgent = isResumeExpiryUrgent(saved.resumeExpiresAt);

  return (
    <div
      className={`mb-1 animate-rise-in rounded-xl border px-3 py-2.5 sm:px-3.5 ${
        urgent
          ? "border-rose-400/45 bg-rose-500/10"
          : "border-brand-accent/35 bg-brand-accent/8"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
              urgent ? "text-rose-200/90" : "text-brand-accent"
            }`}
          >
            Ready to continue
            {mind ? ` · ${mind.tag}` : ""}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-brand-text">
            {saved.characterName || saved.characterId}
            {saved.resumeCode ? (
              <span className="ml-2 font-mono text-[11px] font-normal text-amber-200/90">
                {saved.resumeCode}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] text-brand-muted">
            {mind?.blurb || "Pick up the heat where you left off."}
            {expiry ? ` · ${expiry}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onResume}
            className={`btn-primary min-h-0 px-4 py-2 text-xs sm:text-sm disabled:opacity-50 ${
              urgent ? "ring-1 ring-rose-400/60" : ""
            }`}
          >
            Continue · {nick}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onStartFresh}
            className="btn-ghost min-h-0 px-3 py-2 text-xs disabled:opacity-50"
          >
            New chat
          </button>
        </div>
      </div>
    </div>
  );
}
