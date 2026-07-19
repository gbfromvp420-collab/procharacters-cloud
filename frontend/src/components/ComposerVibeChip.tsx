"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";
import type { SessionMode, SessionModeUiState } from "@/lib/types";

const PHASE_LABEL: Record<string, string> = {
  build: "Build",
  hold: "Hold",
  almost: "Almost",
  breathe: "Breathe",
};

/**
 * Sticky chip above the chat composer — mind identity + Edge Pace phase.
 */
export function ComposerVibeChip({
  characterId,
  characterName,
  sessionMode,
  modeState,
  tickOffset = 0,
  status,
}: {
  characterId?: string | null;
  characterName?: string | null;
  sessionMode?: SessionMode | null;
  modeState?: SessionModeUiState | null;
  tickOffset?: number;
  status: "idle" | "connecting" | "ready" | "error" | "ended";
}) {
  const mind = mindFingerprint(characterId);
  const edgeLive = modeState?.mode === "edge_pace" && status === "ready";
  const edgePending = sessionMode === "edge_pace" && status !== "ready";
  const phase = modeState?.phase ? PHASE_LABEL[modeState.phase] ?? modeState.phase : null;
  const remaining =
    edgeLive && modeState
      ? Math.max(0, modeState.phaseRemainingSec - tickOffset)
      : null;

  if (!mind && !edgeLive && !edgePending) return null;

  const nick = characterName?.trim().split(/\s+/)[0] || null;

  return (
    <div
      className="mb-2 flex flex-wrap items-center gap-1.5"
      role="status"
      aria-live="polite"
    >
      {mind && (
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-accent/35 bg-brand-accent/10 px-2.5 py-1 text-[10px] font-medium text-brand-accent">
          <span className="uppercase tracking-[0.14em] opacity-90">
            {nick ? nick : "Mind"} · {mind.tag}
          </span>
          {mind.bilingual && (
            <span className="rounded-full border border-brand-border/70 px-1.5 py-0.5 text-[9px] text-brand-muted">
              ES
            </span>
          )}
        </span>
      )}
      {edgeLive && phase && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/45 bg-rose-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-100">
          Edge Pace · {phase}
          {remaining != null && (
            <span className="font-mono font-normal tabular-nums normal-case tracking-normal text-rose-100/85">
              {remaining}s
            </span>
          )}
        </span>
      )}
      {edgePending && !edgeLive && (
        <span className="inline-flex items-center rounded-full border border-rose-400/35 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-100/90">
          Edge Pace ready
        </span>
      )}
    </div>
  );
}
