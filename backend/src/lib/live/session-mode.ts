/**
 * Phase 10 — Assistant modes (v3 preview)
 * Not a full real-time gooning product — session-level tone + soft timers.
 */

export type SessionMode = "normal" | "edge_pace";

export type EdgePhase = "build" | "hold" | "almost" | "breathe";

export interface ModeRuntimeState {
  mode: SessionMode;
  /** ISO when mode started (usually session create). */
  modeStartedAt: string;
  /** 0-based round in edge_pace. */
  round: number;
  phase: EdgePhase;
  /** Seconds remaining in current phase. */
  phaseRemainingSec: number;
  /** Seconds elapsed in current phase. */
  phaseElapsedSec: number;
  /** Human label for UI. */
  label: string;
  /** One-line coach cue for the model. */
  coachCue: string;
}

/** Phase durations in seconds (edge_pace round ≈ 3 min). */
const EDGE_PHASES: Array<{ phase: EdgePhase; seconds: number }> = [
  { phase: "build", seconds: 70 },
  { phase: "hold", seconds: 50 },
  { phase: "almost", seconds: 35 },
  { phase: "breathe", seconds: 25 },
];

const ROUND_SEC = EDGE_PHASES.reduce((s, p) => s + p.seconds, 0);

export function normalizeSessionMode(raw?: string | null): SessionMode {
  return raw === "edge_pace" ? "edge_pace" : "normal";
}

export function computeModeState(
  mode: SessionMode,
  modeStartedAt: string,
  now = Date.now(),
): ModeRuntimeState {
  if (mode !== "edge_pace") {
    return {
      mode: "normal",
      modeStartedAt,
      round: 0,
      phase: "build",
      phaseRemainingSec: 0,
      phaseElapsedSec: 0,
      label: "Normal",
      coachCue: "Natural live cam pace — tease-first, no strict timers.",
    };
  }

  const start = Date.parse(modeStartedAt);
  const elapsedSec = Number.isFinite(start)
    ? Math.max(0, Math.floor((now - start) / 1000))
    : 0;
  const round = Math.floor(elapsedSec / ROUND_SEC);
  let intoRound = elapsedSec % ROUND_SEC;

  let phase: EdgePhase = "build";
  let phaseElapsedSec = intoRound;
  let phaseRemainingSec = EDGE_PHASES[0]!.seconds;

  for (const step of EDGE_PHASES) {
    if (intoRound < step.seconds) {
      phase = step.phase;
      phaseElapsedSec = intoRound;
      phaseRemainingSec = step.seconds - intoRound;
      break;
    }
    intoRound -= step.seconds;
  }

  const cues: Record<EdgePhase, string> = {
    build:
      "BUILD — warm them up slow. Light over-fabric tease, dirty talk, rising heat. Do not rush to the edge yet.",
    hold: "HOLD / EDGE — keep them (and you) right on the edge. Slow strokes, freeze, deny finish. Count breaths.",
    almost:
      "ALMOST — intensify briefly (breath, wet detail, near-peak) then pull back. Still no climax unless they clearly demand release.",
    breathe:
      "BREATHE — soft cool-down 20–30s, keep arousal, reset for next round. Stay visual and in character.",
  };

  const labels: Record<EdgePhase, string> = {
    build: "Build",
    hold: "Hold / Edge",
    almost: "Almost",
    breathe: "Breathe",
  };

  return {
    mode: "edge_pace",
    modeStartedAt,
    round,
    phase,
    phaseElapsedSec,
    phaseRemainingSec,
    label: `Edge Pace · R${round + 1} · ${labels[phase]}`,
    coachCue: cues[phase],
  };
}

/** Prompt block injected each turn when mode is active. */
export function buildSessionModeInstructions(state: ModeRuntimeState): string {
  if (state.mode === "normal") {
    return [
      "## Session mode: Normal",
      "Standard Naughty Syntax live chat. Tease-first pacing. No forced timer cycles.",
      "Still expert at edging when the user wants it — just not on a strict schedule.",
    ].join("\n");
  }

  const avatarByPhase: Record<EdgePhase, string> = {
    build:
      'avatar_intent bias: emotion teasing/seductive/playful, arousal ~0.35–0.55, action hover_touch or stroke_over_fabric',
    hold:
      'avatar_intent bias: emotion edging/intense, arousal ~0.70–0.85, action freeze_edge — body holds with the mind',
    almost:
      'avatar_intent bias: emotion breathless/aroused, arousal ~0.80–0.92, action stroke_over_fabric then freeze',
    breathe:
      'avatar_intent bias: emotion soft/calm, arousal ease to ~0.45–0.60, action subtle_movement — charged cool-down',
  };

  return [
    "## Session mode: Edge Pace (v3 preview)",
    "You are co-piloting a paced edging session. Stay fully in character.",
    `Current: ${state.label}`,
    `Phase remaining: ~${state.phaseRemainingSec}s`,
    `Coach cue: ${state.coachCue}`,
    `Body (avatar_intent): ${avatarByPhase[state.phase]}`,
    "",
    "Rules:",
    "- Weave the phase into dirty talk naturally (do not dump the whole timer block every line).",
    "- Prefer denial / edge unless the user clearly asks to finish.",
    "- Keep signature clothing and photorealistic detail.",
    "- Match avatar_intent to the phase so the video body follows your words.",
    "- This is NOT a separate AI product — you are still the same character model.",
    "- Optional soft Spanish (twink) still sparingly if on-brand.",
  ].join("\n");
}

export function formatModeForUi(state: ModeRuntimeState): {
  mode: SessionMode;
  label: string;
  phase: EdgePhase;
  round: number;
  phaseRemainingSec: number;
  coachCue: string;
} {
  return {
    mode: state.mode,
    label: state.label,
    phase: state.phase,
    round: state.round,
    phaseRemainingSec: state.phaseRemainingSec,
    coachCue: state.coachCue,
  };
}
