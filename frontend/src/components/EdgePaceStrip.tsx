"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionModeUiState } from "@/lib/types";

const PHASES: Array<{ id: string; label: string }> = [
  { id: "build", label: "Build" },
  { id: "hold", label: "Hold" },
  { id: "almost", label: "Almost" },
  { id: "breathe", label: "Breathe" },
];

function phaseShellClass(phase: string): string {
  switch (phase) {
    case "almost":
      return "border-rose-300/70 bg-rose-500/20 shadow-[0_0_28px_-6px_rgba(244,63,94,0.55)] edge-almost-pulse";
    case "hold":
      return "border-amber-400/50 bg-amber-500/10 shadow-[0_0_22px_-8px_rgba(245,158,11,0.4)]";
    case "breathe":
      return "border-sky-400/45 bg-sky-500/10 shadow-[0_0_22px_-8px_rgba(14,165,233,0.35)]";
    case "build":
    default:
      return "border-rose-400/40 bg-rose-500/10 shadow-glow-sm";
  }
}

function phaseBarClass(phase: string): string {
  switch (phase) {
    case "almost":
      return "from-rose-300 via-fuchsia-400 to-amber-200";
    case "hold":
      return "from-amber-300 to-rose-400";
    case "breathe":
      return "from-sky-300 to-emerald-300";
    default:
      return "from-rose-400 to-amber-300";
  }
}

/**
 * Phase 10 Edge Pace — visual phase strip + countdown (v3 preview).
 * Almost phase ramps visual heat; phase changes flash the coach cue.
 */
export function EdgePaceStrip({
  modeState,
  tickOffset = 0,
}: {
  modeState: SessionModeUiState;
  /** Local seconds since last WS modeState (client countdown). */
  tickOffset?: number;
}) {
  const [flash, setFlash] = useState(false);
  const prevPhase = useRef(modeState.phase);

  useEffect(() => {
    if (prevPhase.current !== modeState.phase) {
      prevPhase.current = modeState.phase;
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 900);
      return () => window.clearTimeout(t);
    }
  }, [modeState.phase]);

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
  const isAlmost = modeState.phase === "almost";
  const isHold = modeState.phase === "hold";
  const isBreathe = modeState.phase === "breathe";

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed text-rose-50 transition-[border-color,box-shadow,background] duration-500 ${phaseShellClass(modeState.phase)} ${
        flash ? "ring-2 ring-white/25" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
            isAlmost
              ? "text-rose-100"
              : isHold
                ? "text-amber-100"
                : isBreathe
                  ? "text-sky-100"
                  : "text-rose-200/90"
          }`}
        >
          {modeState.label}
          {isAlmost ? " · DON’T FINISH" : isBreathe ? " · soft" : ""}
        </p>
        <p
          className={`font-mono text-xs tabular-nums ${
            isAlmost ? "text-rose-50 font-semibold scale-105" : "text-rose-100/90"
          }`}
        >
          {remaining}s
        </p>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1">
        {PHASES.map((p, i) => {
          const active = i === activeIdx;
          const done = i < activeIdx;
          const almostActive = active && p.id === "almost";
          return (
            <div
              key={p.id}
              className={`rounded-md px-1 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wide transition ${
                almostActive
                  ? "bg-rose-400/50 text-white ring-2 ring-rose-200/70 animate-pulse"
                  : active
                    ? p.id === "hold"
                      ? "bg-amber-400/35 text-amber-50 ring-1 ring-amber-300/50"
                      : p.id === "breathe"
                        ? "bg-sky-400/30 text-sky-50 ring-1 ring-sky-300/45"
                        : "bg-rose-400/35 text-rose-50 ring-1 ring-rose-300/50"
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
        className={`mt-2 h-1.5 overflow-hidden rounded-full bg-black/30 ${
          isAlmost ? "h-2" : ""
        }`}
        aria-hidden
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-linear ${phaseBarClass(modeState.phase)} ${
            isAlmost ? "shadow-[0_0_12px_rgba(251,113,133,0.8)]" : ""
          }`}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <p
        className={`mt-2 ${
          flash
            ? "text-white font-medium"
            : isAlmost
              ? "text-rose-50 font-medium"
              : "text-brand-muted"
        }`}
      >
        {modeState.coachCue}
      </p>
      <p className="mt-1 text-[10px] text-brand-soft">
        Soft timers · round {modeState.round + 1} · not a full assistant product
      </p>
    </div>
  );
}
