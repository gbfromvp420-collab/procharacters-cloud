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

/** Short fire line derived from whisper energy — not the full coach essay. */
function fireLineFor(characterId?: string | null, edgePhase?: string | null): string {
  if (edgePhase === "almost") return "don’t finish — hold right there";
  if (edgePhase === "hold") return "stay… don’t move yet";
  if (edgePhase === "breathe") return "breathe with me — soft";
  if (edgePhase === "build") return "build it slower";
  const mind = mindFingerprint(characterId);
  switch (mind?.tag) {
    case "Post-set":
      return "one more slow rep…";
    case "Shy heat":
      return "you’re so good like that…";
    case "Mesh brat":
      return "make me beg for it";
    case "Soft goth":
      return "slower… keep the ritual";
    case "Cool-down":
      return "set’s not over";
    case "Brat game":
      return "tease me meaner";
    case "Flagship edge":
      return "slow strokes only";
    case "Open panel":
      return "hover… not yet";
    default:
      return "keep going slow";
  }
}

/**
 * Soft erotic coach line under the composer — Edge Pace cue or mind whisper.
 * Tap seeds a short fire line into the composer.
 */
export function HeatWhisperStrip({
  characterId,
  modeState,
  tickOffset = 0,
  onSeedFire,
}: {
  characterId?: string | null;
  modeState?: SessionModeUiState | null;
  tickOffset?: number;
  onSeedFire?: (text: string) => void;
}) {
  const mind = mindFingerprint(characterId);
  const edge = modeState?.mode === "edge_pace";
  const cue = edge && modeState?.coachCue?.trim() ? modeState.coachCue.trim() : null;
  const remaining =
    edge && modeState
      ? Math.max(0, modeState.phaseRemainingSec - tickOffset)
      : null;
  const line = cue || whisperForMind(characterId);
  const fire = fireLineFor(characterId, edge ? modeState?.phase : null);

  const body = (
    <>
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
        {onSeedFire && (
          <span className="ml-auto text-[9px] uppercase tracking-wide opacity-70">
            tap to seed ↵
          </span>
        )}
      </div>
      <p className="mt-0.5 line-clamp-2 text-left">{line}</p>
    </>
  );

  const shell = `mb-2 w-full rounded-lg border px-2.5 py-1.5 text-[10px] leading-snug ${
    edge && modeState?.phase === "almost"
      ? "border-rose-400/40 bg-rose-500/10 text-rose-50"
      : edge
        ? "border-rose-400/25 bg-rose-500/5 text-rose-100/90"
        : "border-brand-border/60 bg-brand-bg/50 text-brand-muted"
  }`;

  if (onSeedFire) {
    return (
      <button
        type="button"
        onClick={() => onSeedFire(fire)}
        className={`${shell} transition hover:brightness-110 active:scale-[0.99]`}
        title={`Seed: ${fire}`}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={shell} role="note">
      {body}
    </div>
  );
}
