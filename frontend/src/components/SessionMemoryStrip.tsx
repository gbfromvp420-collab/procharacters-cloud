"use client";

import { useState } from "react";

/**
 * Compact “what we remember” UI — prior dossier + this-session notes.
 */
export function SessionMemoryStrip({
  priorNotes,
  sessionNotes,
}: {
  priorNotes?: string | null;
  sessionNotes?: string | null;
}) {
  const hasPrior = !!(priorNotes && priorNotes.trim());
  const hasSession = !!(sessionNotes && sessionNotes.trim());
  const [open, setOpen] = useState(true);

  if (!hasPrior && !hasSession) return null;

  return (
    <div className="rounded-xl border border-violet-400/25 bg-violet-500/5 text-[11px] leading-relaxed">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/90">
          What we remember
          {hasPrior && hasSession ? " · prior + now" : hasPrior ? " · across sessions" : " · this session"}
        </span>
        <span className="text-[10px] text-brand-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-violet-400/15 px-3 py-2">
          {hasPrior && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-200/75">
                Across sessions
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-brand-muted">{priorNotes}</p>
            </div>
          )}
          {hasSession && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                This session
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-brand-muted">{sessionNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
