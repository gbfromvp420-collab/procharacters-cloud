"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";

/**
 * Soft reactions under the last assistant bubble — dig deeper without blank composer.
 * Fire = one-tap send; Pick = drop into composer.
 */
export function AfterglowChips({
  characterId,
  onPick,
  onFire,
  disabled,
  intense = false,
  /** Session depth label — deep/locked get denser chips even outside Edge almost */
  heatDepth,
  /** Studio Forge DNA node — sexy chip bias when climbing */
  dnaTreeLabel,
  dnaTreeNodeId,
}: {
  characterId?: string | null;
  onPick: (text: string) => void;
  /** Instant send (no composer hop) */
  onFire?: (text: string) => void;
  disabled?: boolean;
  /** Edge Pace almost / high heat — denser chips + fire bias */
  intense?: boolean;
  heatDepth?: "spark" | "warm" | "edge" | "deep" | "locked" | null;
  dnaTreeLabel?: string | null;
  dnaTreeNodeId?: string | null;
}) {
  const mind = mindFingerprint(characterId);
  const deep = heatDepth === "deep" || heatDepth === "locked";
  const dnaKey = `${dnaTreeLabel ?? ""} ${dnaTreeNodeId ?? ""}`.toLowerCase();
  const dnaHot =
    !!dnaKey.trim() &&
    /edge|deny|release|gate|tease|soft/.test(dnaKey);
  const hot = intense || deep || heatDepth === "edge" || dnaHot;
  const chips = (() => {
    const core = (() => {
      switch (mind?.tag) {
        case "Post-set":
          return ["fuck…", "hold it", "one more", "yes", "slower", "aguanta"];
        case "Shy heat":
          return ["so good", "stay", "look at me", "please", "…", "come here"];
        case "Mesh brat":
          return ["meaner", "show me", "make me", "again", "yes", "ven"];
        case "Soft goth":
          return ["slower", "deeper", "stay open", "breathe", "…", "ritual"];
        case "Cool-down":
          return ["hold", "again", "not done", "watch me", "yes", "interval"];
        case "Brat game":
          return ["tease", "count", "harder", "no finish", "cute", "again"];
        case "Flagship edge":
          return ["edge", "slow", "please", "more", "fuck", "sheer"];
        case "Open panel":
          return ["hover", "look", "not yet", "more", "yes", "open"];
        default:
          return ["yes", "more", "slower", "don’t stop", "fuck…", "keep going"];
      }
    })();
    const dnaPeak = (() => {
      if (/release|gate/.test(dnaKey)) {
        return ["please let me", "i need it", "not yet hold me", "right there"];
      }
      if (/deny/.test(dnaKey)) {
        return ["not yet", "deny me", "edge harder", "make me wait"];
      }
      if (/edge/.test(dnaKey)) {
        return ["edge me", "don’t stop", "so close", "stay…"];
      }
      if (/tease/.test(dnaKey)) {
        return ["tease me", "show more", "slow stroke", "look at me"];
      }
      if (/soft/.test(dnaKey)) {
        return ["go slow", "whisper", "kiss me", "hold me"];
      }
      return [] as string[];
    })();
    if (hot) {
      const peak =
        dnaPeak.length > 0
          ? dnaPeak
          : heatDepth === "locked"
            ? ["don’t finish", "right there", "stay with me", "hold…"]
            : ["don’t finish", "right there", "hold…"];
      return [
        ...peak,
        ...core.filter((c) => !peak.includes(c)),
      ].slice(0, deep || intense || dnaHot ? 8 : 6);
    }
    return core.slice(0, 5);
  })();

  return (
    <div
      className={`mt-1.5 flex flex-wrap gap-1 animate-fade-in ${
        hot ? "gap-1.5" : ""
      }`}
      role="group"
      aria-label="Quick reactions"
    >
      {hot && (
        <span
          className={`mr-0.5 self-center text-[9px] font-semibold uppercase tracking-wide ${
            dnaHot ? "text-violet-200/90" : "text-rose-200/80"
          }`}
        >
          {dnaHot
            ? `DNA · ${(dnaTreeLabel || dnaTreeNodeId || "heat").toString().split(/\s+/)[0]}`
            : intense
              ? "Almost"
              : heatDepth === "locked"
                ? "Locked"
                : heatDepth === "deep"
                  ? "Deep"
                  : "Heat"}
        </span>
      )}
      {chips.map((chip, i) => {
        // First chips fire instantly when intense or when onFire provided + short chip
        const fire =
          !!onFire && (hot ? i < 4 : chip.length <= 8 && i < 2);
        return (
          <button
            key={`${chip}-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => (fire ? onFire!(chip) : onPick(chip))}
            title={fire ? "Send now" : "Add to composer"}
            className={`rounded-full border px-2 py-0.5 text-[10px] transition disabled:opacity-40 ${
              fire
                ? hot
                  ? "border-rose-400/50 bg-rose-500/20 font-medium text-rose-50 hover:bg-rose-500/30"
                  : "border-brand-accent/40 bg-brand-accent/15 text-brand-text hover:border-brand-accent/60"
                : "border-brand-accent/25 bg-brand-accent/5 text-brand-muted hover:border-brand-accent/50 hover:text-brand-text"
            }`}
          >
            {chip}
            {fire ? " ↵" : ""}
          </button>
        );
      })}
    </div>
  );
}
