"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionModeUiState } from "@/lib/types";

function fallbackFire(phase: string): string {
  switch (phase) {
    case "hold":
      return "hold it — don’t finish";
    case "almost":
      return "right there — pull back";
    case "breathe":
      return "breathe with me… again soon";
    case "build":
    default:
      return "build it slower";
  }
}

function fallbackChips(phase: string): string[] {
  switch (phase) {
    case "hold":
      return ["hold it", "stay…"];
    case "almost":
      return ["right there", "pull back"];
    case "breathe":
      return ["breathe", "again soon"];
    case "build":
    default:
      return ["slower", "show me"];
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

function phaseChipClass(phase: string): string {
  switch (phase) {
    case "almost":
      return "border-rose-300/70 bg-rose-500/25 text-rose-50";
    case "hold":
      return "border-amber-400/55 bg-amber-500/15 text-amber-50";
    case "breathe":
      return "border-sky-400/45 bg-sky-500/15 text-sky-50";
    default:
      return "border-rose-400/45 bg-rose-500/15 text-rose-100";
  }
}

/**
 * One-row Edge Pace — phase, timer, fire. No coach essay / DNA grid / chip wall.
 */
export function EdgePaceStrip({
  modeState,
  tickOffset = 0,
  onSeed,
  onFire,
  canFire,
}: {
  modeState: SessionModeUiState;
  tickOffset?: number;
  onSeed?: (text: string) => void;
  onFire?: (text: string) => void;
  canFire?: boolean;
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
  const fire = modeState.fireLine?.trim() || fallbackFire(modeState.phase);
  const chips =
    modeState.phaseChips?.length
      ? modeState.phaseChips.slice(0, 2)
      : fallbackChips(modeState.phase);
  const phase = modeState.phase || "build";
  const urgent = remaining > 0 && remaining <= 8;

  return (
    <div
      className={`mb-1.5 rounded-lg border px-2 py-1.5 ${phaseChipClass(phase)} ${
        flash ? "ring-1 ring-white/30" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em]">
          Edge · {phase}
        </p>
        <p
          className={`shrink-0 font-mono text-[11px] tabular-nums ${
            urgent ? "font-semibold" : "opacity-90"
          }`}
        >
          {remaining}s
        </p>
        <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-black/30" aria-hidden>
          <div
            className={`h-full rounded-full bg-gradient-to-r ${phaseBarClass(phase)} ${
              urgent ? "animate-pulse" : ""
            }`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        {onFire && (
          <button
            type="button"
            disabled={canFire === false}
            onClick={() => onFire(fire)}
            className="shrink-0 rounded-full border border-white/30 bg-black/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide disabled:opacity-40"
          >
            Fire
          </button>
        )}
      </div>
      {(onSeed || onFire) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={canFire === false && !onSeed}
              onClick={() => {
                if (onFire && chip.length <= 14) onFire(chip);
                else onSeed?.(chip);
              }}
              className="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[9px] disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
