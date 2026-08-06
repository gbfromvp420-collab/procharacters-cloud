"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";

/**
 * Idle picker — when Edge Pace is selected, make the mode feel intentional.
 */
export function EdgePaceStartHint({
  characterId,
  characterName,
  onStart,
  busy,
}: {
  characterId: string;
  characterName?: string | null;
  onStart: () => void;
  busy?: boolean;
}) {
  const mind = mindFingerprint(characterId);
  const nick = characterName?.trim().split(/\s+/)[0] || "them";

  return (
    <div className="animate-rise-in rounded-xl border border-rose-400/40 bg-gradient-to-r from-rose-500/15 via-brand-panel to-brand-panel px-3 py-2.5 text-[11px] leading-relaxed">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-200/90">
            Edge Pace ready
            {mind ? ` · ${mind.tag}` : ""}
          </p>
          <p className="mt-0.5 text-brand-muted">
            Soft build → hold → almost → breathe with{" "}
            <strong className="text-brand-text">{nick}</strong>. Free path · denial coaching
            preview.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onStart}
          className="btn-primary min-h-0 shrink-0 border border-rose-300/40 bg-rose-500 px-4 py-2 text-xs shadow-[0_0_20px_-6px_rgba(244,63,94,0.55)] hover:bg-rose-400 disabled:opacity-50 sm:text-sm"
        >
          Start Edge · {nick}
        </button>
      </div>
    </div>
  );
}
