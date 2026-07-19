"use client";

import { useEffect, useState } from "react";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import {
  formatResumeExpiryShort,
  getResumeForCharacter,
  isResumeExpiryUrgent,
  type HeatTrailDepth,
  type ResumeCacheEntry,
} from "@/lib/resume-cache";
import type { StoredSession } from "@/lib/session-storage";

/**
 * Idle chat — make Resume the hero path when a device session exists.
 * Pulls Heat Trail from resume cache when stamped.
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
  const [trail, setTrail] = useState<ResumeCacheEntry | null>(null);

  useEffect(() => {
    try {
      setTrail(getResumeForCharacter(saved.characterId));
    } catch {
      setTrail(null);
    }
  }, [saved.characterId, saved.resumeCode, saved.savedAt]);

  const heatDepth = trail?.heatDepth as HeatTrailDepth | undefined;
  const chips = trail?.heatChips?.slice(0, 4) ?? [];
  const recap = trail?.recapLine?.trim() || null;
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

  return (
    <div
      className={`mb-1 animate-rise-in rounded-xl border px-3 py-2.5 sm:px-3.5 ${
        urgent
          ? "border-rose-400/45 bg-rose-500/10"
          : heatDepth
            ? "border-amber-400/40 bg-amber-500/8"
            : "border-brand-accent/35 bg-brand-accent/8"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
              urgent
                ? "text-rose-200/90"
                : heatDepth
                  ? "text-amber-200/90"
                  : "text-brand-accent"
            }`}
          >
            {heatDepth ? `Heat trail · ${heatDepth}` : "Ready to continue"}
            {trail?.mindTag || mind ? ` · ${trail?.mindTag || mind?.tag}` : ""}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-brand-text">
            {saved.characterName || saved.characterId}
            {saved.resumeCode ? (
              <span className="ml-2 font-mono text-[11px] font-normal text-amber-200/90">
                {saved.resumeCode}
              </span>
            ) : null}
          </p>

          {depthLevel != null && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-2.5 rounded-full ${
                      i <= depthLevel
                        ? i >= 3
                          ? "bg-rose-400"
                          : "bg-amber-300"
                        : "bg-brand-border"
                    }`}
                  />
                ))}
              </div>
              {typeof trail?.messageCount === "number" && trail.messageCount > 0 && (
                <span className="font-mono text-[10px] text-brand-soft">
                  {trail.messageCount} msgs
                </span>
              )}
            </div>
          )}

          {chips.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-rose-100/90"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          <p className="mt-0.5 text-[11px] text-brand-muted">
            {recap
              ? `“${recap}”`
              : mind?.blurb || "Pick up the heat where you left off."}
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
