"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DNA_NODES = ["Spark", "Soft", "Tease", "Edge", "Deny", "Gate"] as const;

/**
 * After Save My Character — celebrate private ownership and push into first heat.
 * DNA forge path: Edge Pace primary, starter line, soft tree teaser.
 * Never blocks free chat; dismiss always available.
 */
export function MyCharacterWinToast({
  show,
  characterId,
  characterName,
  customsLimit,
  starterHint,
  forged = false,
  forgeSource,
  onStart,
  onStartEdge,
  onDismiss,
}: {
  show: boolean;
  characterId?: string | null;
  characterName?: string | null;
  /** Soft cap hint (e.g. 10 free / 40 premium). */
  customsLimit?: number;
  /** Smart starter line shown under Chat Now. */
  starterHint?: string | null;
  /** True when saved with Studio Forge DNA (custom-v3). */
  forged?: boolean;
  forgeSource?: string | null;
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
      className={`mb-3 animate-rise-in rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed shadow-glow-sm ${
        forged
          ? "border-violet-400/50 bg-gradient-to-r from-violet-500/25 via-rose-500/10 to-brand-panel"
          : "border-violet-400/45 bg-gradient-to-r from-violet-500/20 via-brand-panel to-brand-panel"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/90">
            {forged ? "DNA forged · private" : "Ready · private"}
            {forged && forgeSource ? ` · ${forgeSource}` : ""}
          </p>
          <p className="mt-1 text-brand-muted">
            <strong className="text-brand-text">{nick}</strong> is live on your account
            {forged
              ? " with Naughty Syntax DNA — Chat Now or Edge Pace climbs the soft tree"
              : " — Chat Now jumps straight into heat"}
            {customsLimit != null ? ` · ${customsLimit} slots` : ""}.
          </p>
          {starterHint?.trim() && (
            <p className="mt-1.5 line-clamp-2 text-[11px] italic text-violet-100/85">
              Starter · “{starterHint.trim()}”
            </p>
          )}
          {forged && (
            <div
              className="mt-2 grid grid-cols-6 gap-0.5"
              aria-label="DNA path preview — starts at Spark"
            >
              {DNA_NODES.map((label, i) => (
                <div
                  key={label}
                  className={`rounded px-0.5 py-1 text-center text-[8px] font-semibold uppercase tracking-wide ${
                    i === 0
                      ? "bg-violet-400/45 text-white ring-1 ring-violet-200/50"
                      : "bg-black/25 text-violet-100/40"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {forged && onStartEdge ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onStartEdge();
                    onDismiss();
                  }}
                  className="btn-primary min-h-0 border-rose-400/40 bg-rose-500/90 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Edge Pace · climb DNA
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStart();
                    onDismiss();
                  }}
                  className="btn-ghost min-h-0 border-violet-400/45 px-3 py-1.5 text-xs text-violet-100"
                >
                  Chat Now
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onStart();
                    onDismiss();
                  }}
                  className="btn-primary min-h-0 px-3 py-1.5 text-xs"
                >
                  Chat Now
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
              </>
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
