"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionModeUiState } from "@/lib/types";

const PHASES: Array<{ id: string; label: string }> = [
  { id: "build", label: "Build" },
  { id: "hold", label: "Hold" },
  { id: "almost", label: "Almost" },
  { id: "breathe", label: "Breathe" },
];

/** Soft DNA tree path — dual with Edge Pace when forge custom-v3. */
const DNA_NODES: Array<{ id: string; label: string }> = [
  { id: "spark", label: "Spark" },
  { id: "soft-lock", label: "Soft" },
  { id: "tease", label: "Tease" },
  { id: "edge", label: "Edge" },
  { id: "deny", label: "Deny" },
  { id: "release-gate", label: "Gate" },
];

function dnaNodeIndex(nodeId?: string | null): number {
  if (!nodeId) return 0;
  const exact = DNA_NODES.findIndex((n) => n.id === nodeId);
  if (exact >= 0) return exact;
  const lower = nodeId.toLowerCase();
  if (lower.includes("release")) return 5;
  if (lower.includes("deny")) return 4;
  if (lower.includes("edge")) return 3;
  if (lower.includes("tease")) return 2;
  if (lower.includes("soft")) return 1;
  return 0;
}

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
      return ["hold it", "don’t finish", "stay…"];
    case "almost":
      return ["right there", "pull back", "don’t finish"];
    case "breathe":
      return ["breathe", "again soon", "still aching"];
    case "build":
    default:
      return ["slower", "show me", "build it"];
  }
}

const PACE_OPEN_KEY = "pc_edge_pace_open";

/**
 * Phase 10 Edge Pace — collapsed by default so the transcript stays the room.
 * One tap opens the board. Almost / last 8s auto-open so “don’t finish” isn’t missed.
 */
export function EdgePaceStrip({
  modeState,
  tickOffset = 0,
  onSeed,
  onFire,
  canFire,
}: {
  modeState: SessionModeUiState;
  /** Local seconds since last WS modeState (client countdown). */
  tickOffset?: number;
  onSeed?: (text: string) => void;
  onFire?: (text: string) => void;
  canFire?: boolean;
}) {
  const [flash, setFlash] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [dnaFlash, setDnaFlash] = useState(false);
  const prevPhase = useRef(modeState.phase);
  const prevDna = useRef(modeState.dnaTreeNodeId);

  useEffect(() => {
    try {
      setUserOpen(sessionStorage.getItem(PACE_OPEN_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (prevPhase.current !== modeState.phase) {
      prevPhase.current = modeState.phase;
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 1400);
      return () => window.clearTimeout(t);
    }
  }, [modeState.phase]);

  useEffect(() => {
    if (
      modeState.dnaTreeNodeId &&
      prevDna.current &&
      prevDna.current !== modeState.dnaTreeNodeId
    ) {
      setDnaFlash(true);
      const t = window.setTimeout(() => setDnaFlash(false), 1100);
      prevDna.current = modeState.dnaTreeNodeId;
      return () => window.clearTimeout(t);
    }
    prevDna.current = modeState.dnaTreeNodeId;
  }, [modeState.dnaTreeNodeId]);

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
  const urgent = remaining > 0 && remaining <= 8;
  const fire =
    modeState.fireLine?.trim() || fallbackFire(modeState.phase);
  const chips =
    modeState.phaseChips?.length
      ? modeState.phaseChips.slice(0, 4)
      : fallbackChips(modeState.phase);
  const dnaLabel = modeState.dnaTreeLabel || modeState.dnaTreeNodeId;
  const dnaIdx = dnaNodeIndex(modeState.dnaTreeNodeId);
  const forceOpen = isAlmost || (urgent && !isBreathe);
  const expanded = userOpen || forceOpen;

  const persistOpen = (next: boolean) => {
    setUserOpen(next);
    try {
      sessionStorage.setItem(PACE_OPEN_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const phaseTone = isAlmost
    ? "text-rose-100"
    : isHold
      ? "text-amber-100"
      : isBreathe
        ? "text-sky-100"
        : "text-rose-200/90";

  const shell = `rounded-xl border text-[11px] leading-relaxed text-rose-50 transition-[border-color,box-shadow,background] duration-500 ${phaseShellClass(modeState.phase)} ${
    flash ? "ring-2 ring-white/30 scale-[1.01]" : ""
  } ${urgent && !isBreathe ? "ring-1 ring-amber-200/40" : ""} ${
    dnaLabel ? "ring-1 ring-violet-400/25" : ""
  } ${dnaFlash || modeState.dnaTreeAdvanced ? "dna-climb-shell" : ""}`;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => persistOpen(true)}
        className={`${shell} flex w-full items-center justify-between gap-2 px-3 py-2 text-left`}
        aria-expanded={false}
        aria-label={`Pace · ${modeState.label} · ${remaining}s · tap to open`}
      >
        <span className={`truncate text-[10px] font-semibold uppercase tracking-[0.18em] ${phaseTone}`}>
          Pace · {modeState.label}
          {dnaLabel ? ` · ${dnaLabel}` : ""}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={`font-mono text-xs tabular-nums ${
              urgent ? "font-semibold text-rose-50" : "text-rose-100/90"
            }`}
          >
            {remaining}s
          </span>
          <span className="text-[10px] font-medium normal-case tracking-normal text-rose-100/70">
            Open
          </span>
        </span>
      </button>
    );
  }

  return (
    <div
      className={`${shell} px-3 py-2.5`}
      role="status"
      aria-live="polite"
      aria-expanded={true}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${phaseTone}`}>
          {modeState.label}
          {isAlmost ? " · DON’T FINISH" : isBreathe ? " · soft" : ""}
          {flash ? " · phase shift" : ""}
          {dnaLabel ? ` · DNA ${dnaLabel}` : ""}
          {(modeState.dnaTreeAdvanced || dnaFlash) && dnaLabel ? " ↑" : ""}
        </p>
        <div className="flex items-center gap-2">
          <p
            className={`font-mono text-xs tabular-nums ${
              isAlmost || urgent
                ? "scale-105 font-semibold text-rose-50"
                : "text-rose-100/90"
            }`}
          >
            {remaining}s
            {urgent ? " · soon" : ""}
          </p>
          {!forceOpen ? (
            <button
              type="button"
              onClick={() => persistOpen(false)}
              className="rounded-full border border-white/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-rose-50/80 hover:border-white/35"
            >
              Hide
            </button>
          ) : null}
        </div>
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
                  ? "animate-pulse bg-rose-400/50 text-white ring-2 ring-rose-200/70"
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

      {/* DNA soft tree — dual with Edge Pace on custom-v3 forge models */}
      {dnaLabel && (
        <div className="mt-1.5 space-y-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-200/90">
            DNA path · {modeState.dnaTreeLabel || modeState.dnaTreeNodeId}
            {(modeState.dnaTreeAdvanced || dnaFlash) && (
              <span className="ml-1 rounded-full border border-violet-300/40 bg-violet-500/25 px-1.5 py-0.5 text-[8px] normal-case tracking-normal">
                climbed
              </span>
            )}
          </p>
          <div className="grid grid-cols-6 gap-0.5" aria-label="Forge DNA heat path">
            {DNA_NODES.map((n, i) => {
              const active = i === dnaIdx;
              const done = i < dnaIdx;
              return (
                <div
                  key={n.id}
                  className={`rounded px-0.5 py-1 text-center text-[8px] font-semibold uppercase tracking-wide transition ${
                    active
                      ? `bg-violet-400/50 text-white ring-1 ring-violet-200/60 ${
                          dnaFlash || modeState.dnaTreeAdvanced
                            ? "dna-climb-node"
                            : "dna-climb-node-live"
                        }`
                      : done
                        ? "bg-violet-500/25 text-violet-100/85"
                        : "bg-black/25 text-violet-100/35"
                  }`}
                >
                  {n.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={`mt-2 h-1.5 overflow-hidden rounded-full bg-black/30 ${
          isAlmost ? "h-2" : ""
        }`}
        aria-hidden
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-linear ${phaseBarClass(modeState.phase)} ${
            isAlmost ? "shadow-[0_0_12px_rgba(251,113,133,0.8)]" : ""
          } ${urgent ? "animate-pulse" : ""}`}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <p
        className={`mt-2 ${
          flash
            ? "font-medium text-white"
            : isAlmost
              ? "font-medium text-rose-50"
              : "text-brand-muted"
        }`}
      >
        {modeState.coachCue}
      </p>

      {/* Phase action row — Seed/Fire + micro chips */}
      {(onSeed || onFire) && (
        <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {onSeed && (
              <button
                type="button"
                onClick={() => onSeed(fire)}
                className="rounded-full border border-white/20 bg-black/25 px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-rose-50/90 hover:border-white/40"
              >
                Seed
              </button>
            )}
            {onFire && (
              <button
                type="button"
                disabled={canFire === false}
                onClick={() => onFire(fire)}
                className={`rounded-full border px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide disabled:opacity-40 ${
                  isAlmost
                    ? "border-rose-200/70 bg-rose-500/40 text-white"
                    : isHold
                      ? "border-amber-200/50 bg-amber-500/30 text-amber-50"
                      : isBreathe
                        ? "border-sky-200/50 bg-sky-500/30 text-sky-50"
                        : "border-rose-300/50 bg-rose-500/25 text-rose-50"
                }`}
              >
                Fire ↵
              </button>
            )}
            <span className="line-clamp-1 max-w-[14rem] font-mono text-[9px] opacity-70">
              “{fire}”
            </span>
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Phase quick replies">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={canFire === false && !onSeed}
                onClick={() => {
                  if (onFire && chip.length <= 14) onFire(chip);
                  else onSeed?.(chip);
                }}
                className="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[9px] text-rose-50/85 hover:border-white/35 disabled:opacity-40"
              >
                {chip}
                {onFire && chip.length <= 14 ? " ↵" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-brand-soft">
        Soft timers · round {modeState.round + 1}
        {modeState.round >= 1 ? " · multi-cycle" : ""}
        {dnaLabel ? " · DNA soft tree live" : ""} · not a full assistant product
      </p>
    </div>
  );
}
