"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * After Save My Character — celebrate private ownership and push into first heat.
 * Never blocks free chat; dismiss always available.
 */
export function MyCharacterWinToast({
  show,
  characterId,
  characterName,
  customsLimit,
  onStart,
  onStartEdge,
  onDismiss,
}: {
  show: boolean;
  characterId?: string | null;
  characterName?: string | null;
  /** Soft cap hint (e.g. 10 free / 40 premium). */
  customsLimit?: number;
  onStart: () => void;
  onStartEdge?: () => void;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const nick = characterName?.trim().split(/\s+/)[0] || "Your model";

  useEffect(() => {
    setVisible(!!show && !!characterId);
  }, [show, characterId]);

  if (!visible || !characterId) return null;

  return (
    <div
      className="mb-3 animate-rise-in rounded-xl border border-violet-400/45 bg-gradient-to-r from-violet-500/20 via-brand-panel to-brand-panel px-3 py-2.5 text-[11px] leading-relaxed shadow-glow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/90">
            My Character · private
          </p>
          <p className="mt-1 text-brand-muted">
            <strong className="text-brand-text">{nick}</strong> is saved to your account only —
            not on the public gallery. Start heat whenever you’re ready
            {customsLimit != null ? ` · up to ${customsLimit} models` : ""}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onStart();
                onDismiss();
              }}
              className="btn-primary min-h-0 px-3 py-1.5 text-xs"
            >
              Start heat
            </button>
            {onStartEdge && (
              <button
                type="button"
                onClick={() => {
                  onStartEdge();
                  onDismiss();
                }}
                className="btn-ghost min-h-0 border-rose-400/40 px-3 py-1.5 text-xs text-rose-100"
              >
                Edge Pace
              </button>
            )}
            <Link
              href="/?filter=owned"
              className="btn-ghost min-h-0 border-violet-400/40 px-3 py-1.5 text-xs text-violet-100"
              onClick={onDismiss}
            >
              My models
            </Link>
            <button
              type="button"
              onClick={onDismiss}
              className="min-h-0 px-2 py-1.5 text-[10px] text-brand-muted hover:text-brand-text"
            >
              Later
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-[10px] text-brand-muted hover:text-brand-text"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
