"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";

type Props = {
  show: boolean;
  resumeCode: string | null;
  characterName: string | null;
  /** Optional character id for mind tag on the rescue strip. */
  characterId?: string | null;
  busy: boolean;
  onRejoin: () => void;
  onDismiss: () => void;
  className?: string;
};

/**
 * Amber rescue strip when a live WebSocket drops unexpectedly.
 * Primary action: Rejoin via resume code or last session credentials.
 */
export function SessionDropRescue({
  show,
  resumeCode,
  characterName,
  characterId,
  busy,
  onRejoin,
  onDismiss,
  className = "",
}: Props) {
  if (!show) return null;

  const who = characterName?.trim() || "your character";
  const nick = who.split(/\s+/)[0] || who;
  const mind = mindFingerprint(characterId);
  const via = resumeCode ? (
    <>
      resume code <span className="font-mono text-amber-100">{resumeCode}</span>
    </>
  ) : (
    "your last session"
  );

  return (
    <div
      className={`animate-rise-in rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-brand-panel to-brand-panel px-3 py-2.5 text-[11px] leading-relaxed shadow-glow-sm ${className}`}
      role="status"
      aria-live="assertive"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">
            Connection dropped
            {mind ? ` · ${mind.tag}` : ""}
          </p>
          <p className="mt-1 text-brand-muted">
            Link to <strong className="text-brand-text">{who}</strong> cut out.
            Rejoin with {via} to keep chatting — memory stays on the server.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onRejoin}
            className="btn-primary min-h-0 px-3 py-1.5 text-xs ring-1 ring-amber-400/40 disabled:opacity-50"
          >
            {busy ? "Rejoining…" : `Rejoin · ${nick}`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="shrink-0 text-[10px] text-brand-muted hover:text-brand-text disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
