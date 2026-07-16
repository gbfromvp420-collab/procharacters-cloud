"use client";

import type { SessionModeUiState } from "@/lib/types";

const PHASES: Array<{ id: string; label: string }> = [
  { id: "build", label: "Build" },
  { id: "hold", label: "Hold" },
  { id: "almost", label: "Almost" },
  { id: "breathe", label: "Breathe" },
];

/**
 * Phase 10 Edge Pace — visual phase strip + countdown (v3 preview).
 */
export function EdgePaceStrip({
  modeState,
  tickOffset = 0,
}: {
  modeState: SessionModeUiState;
  /** Local seconds since last WS modeState (client countdown). */
  tickOffset?: number;
}) {
  if (modeState.mode !== "edge_pace") return null;

  const remaining = Math.max(0, modeState.phaseRemainingSec - tickOffset);
  const duration =
    modeState.phaseDurationSec && modeState.phaseDurationSec > 0
      ? modeState.phaseDurationSec
      : Math.max(remaining + (modeState.phaseElapsedSec ?? 0), 1);
  const elapsed = Math.min(
    duration,
    (modeState.phaseElapsedSec ?? Math.max(0, duration - modeState.phaseRemainingSec)) +
      tickOffset,
  );
  const progress = Math.min(1, Math.max(0, elapsed / duration));
  const activeIdx = Math.max(
    0,
    PHASES.findIndex((p) => p.id === modeState.phase),
  );

  return (
    <div
      className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-rose-50 shadow-glow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-200/90">
          {modeState.label}
        </p>
        <p className="font-mono text-xs tabular-nums text-rose-100/90">{remaining}s</p>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1">
        {PHASES.map((p, i) => {
          const active = i === activeIdx;
          const done = i < activeIdx;
          return (
            <div
              key={p.id}
              className={`rounded-md px-1 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wide ${
                active
                  ? "bg-rose-400/35 text-rose-50 ring-1 ring-rose-300/50"
                  : done
                    ? "bg-rose-500/15 text-rose-100/70"
                    : "bg-black/20 text-rose-100/40"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {p.label}
            </div>
          );
        })}
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-300 transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <p className="mt-2 text-brand-muted">{modeState.coachCue}</p>
      <p className="mt-1 text-[10px] text-brand-soft">
        Soft timers · round {modeState.round + 1} · not a full assistant product
      </p>
    </div>
  );
}
