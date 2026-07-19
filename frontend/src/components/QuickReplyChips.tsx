"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";

function chipsFor(characterId?: string | null, nick?: string): string[] {
  const mind = mindFingerprint(characterId);
  const n = nick || "you";
  const base = [
    "keep going…",
    "slower",
    "look at me",
    "don’t finish yet",
  ];
  switch (mind?.tag) {
    case "Post-set":
      return ["one more rep", "hold the burn", "aguanta…", "edge that pouch", ...base];
    case "Shy heat":
      return ["you’re doing so good", "don’t hide", "whisper it", "come closer", ...base];
    case "Mesh brat":
      return ["make me beg", "show off more", "mean it", "ven…", ...base];
    case "Soft goth":
      return ["slower ritual", "breathe with me", "open lace", "stay still", ...base];
    case "Cool-down":
      return ["set’s not over", "hold the edge", "i’m watching", "interval", ...base];
    case "Brat game":
      return ["count for me", "tease harder", "not yet", "be mean cute", ...base];
    case "Flagship edge":
      return ["slow strokes only", "sheer focus", "edge me", "say please", ...base];
    case "Open panel":
      return ["keep teasing", "look at me", "not yet", "hover…", ...base];
    default:
      return [`hey ${n}`, ...base];
  }
}

/**
 * One-tap vibe chips above the composer — remove blank-page friction mid-heat.
 */
export function QuickReplyChips({
  characterId,
  characterName,
  onPick,
  disabled,
}: {
  characterId?: string | null;
  characterName?: string | null;
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  const nick = characterName?.trim().split(/\s+/)[0] || undefined;
  const chips = chipsFor(characterId, nick).slice(0, 6);

  return (
    <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick replies">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          disabled={disabled}
          onClick={() => onPick(chip)}
          className="rounded-full border border-brand-border/80 bg-brand-bg/80 px-2.5 py-1 text-[10px] text-brand-muted transition hover:border-brand-accent/50 hover:text-brand-text disabled:opacity-40"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
