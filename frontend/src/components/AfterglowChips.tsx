"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";

/**
 * Soft reactions under the last assistant bubble — dig deeper without blank composer.
 */
export function AfterglowChips({
  characterId,
  onPick,
  disabled,
}: {
  characterId?: string | null;
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  const mind = mindFingerprint(characterId);
  const chips = (() => {
    switch (mind?.tag) {
      case "Post-set":
        return ["fuck…", "hold it", "one more", "yes", "slower"];
      case "Shy heat":
        return ["so good", "stay", "look at me", "please", "…" ];
      case "Mesh brat":
        return ["meaner", "show me", "make me", "again", "yes"];
      case "Soft goth":
        return ["slower", "deeper", "stay open", "breathe", "…" ];
      case "Cool-down":
        return ["hold", "again", "not done", "watch me", "yes"];
      case "Brat game":
        return ["tease", "count", "harder", "no finish", "cute"];
      case "Flagship edge":
        return ["edge", "slow", "please", "more", "fuck"];
      case "Open panel":
        return ["hover", "look", "not yet", "more", "yes"];
      default:
        return ["yes", "more", "slower", "don’t stop", "fuck…"];
    }
  })();

  return (
    <div
      className="mt-1.5 flex flex-wrap gap-1 animate-fade-in"
      role="group"
      aria-label="Quick reactions"
    >
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          disabled={disabled}
          onClick={() => onPick(chip)}
          className="rounded-full border border-brand-accent/25 bg-brand-accent/5 px-2 py-0.5 text-[10px] text-brand-muted transition hover:border-brand-accent/50 hover:text-brand-text disabled:opacity-40"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
