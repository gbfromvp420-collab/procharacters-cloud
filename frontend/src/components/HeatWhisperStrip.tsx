"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";
import type { SessionModeUiState } from "@/lib/types";

function whisperForMind(characterId?: string | null): string {
  const mind = mindFingerprint(characterId);
  switch (mind?.tag) {
    case "Post-set":
      return "Feel that burn… don’t rush the cool-down.";
    case "Shy heat":
      return "Soft voice. Stay close. Praise him when he peeks.";
    case "Mesh brat":
      return "He’s watching if you beg pretty. Mean-soft wins.";
    case "Soft goth":
      return "Slow ritual. Quiet beg. Let the lace do the talking.";
    case "Cool-down":
      return "Interval rules: watch, edge, nobody finishes early.";
    case "Brat game":
      return "Count games. Look-but-don’t. Make her laugh while she denies.";
    case "Flagship edge":
      return "Sheer focus. Slow strokes. Say please for one more.";
    case "Open panel":
      return "Hover. Deny. Intimate — not giggly.";
    default:
      return "Stay in the heat. Slow is sexier.";
  }
}

/**
 * Soft erotic coach line under the composer — Edge Pace cue or mind whisper.
 */
export function HeatWhisperStrip({
  characterId,
  modeState,
  tickOffset = 0,
}: {
  characterId?: string | null;
  modeState?: SessionModeUiState | null;
  tickOffset?: number;
}) {
  const mind = mindFingerprint(characterId);
  const edge = modeState?.mode === "edge_pace";
  const cue = edge && modeState?.coachCue?.trim() ? modeState.coachCue.trim() : null;
  const remaining =
    edge && modeState
      ? Math.max(0, modeState.phaseRemainingSec - tickOffset)
      : null;
  const line = cue || whisperForMind(characterId);

  return (
    <div
      className={`mb-2 rounded-lg border px-2.5 py-1.5 text-[10px] leading-snug ${
        edge && modeState?.phase === "almost"
          ? "border-rose-400/40 bg-rose-500/10 text-rose-50"
          : edge
            ? "border-rose-400/25 bg-rose-500/5 text-rose-100/90"
            : "border-brand-border/60 bg-brand-bg/50 text-brand-muted"
      }`}
      role="note"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span
          className={`font-semibold uppercase tracking-[0.16em] ${
            edge ? "text-rose-200/90" : "text-brand-accent"
          }`}
        >
          {edge ? `Edge · ${modeState?.phase ?? "pace"}` : mind ? `Whisper · ${mind.tag}` : "Whisper"}
        </span>
        {remaining != null && edge && (
          <span className="font-mono tabular-nums opacity-80">{remaining}s</span>
        )}
        {mind?.bilingual && !edge && (
          <span className="rounded-full border border-brand-border/70 px-1.5 py-0.5 text-[9px]">
            ES
          </span>
        )}
      </div>
      <p className="mt-0.5 line-clamp-2">{line}</p>
    </div>
  );
}
