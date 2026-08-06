"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";

/** Short user-side reply seeds that match each mind’s energy (not the opening itself). */
function replySeedFor(characterId?: string | null, nick?: string): string {
  const mind = mindFingerprint(characterId);
  const n = nick || "you";
  switch (mind?.tag) {
    case "Post-set":
      return `damn ${n.toLowerCase() === "you" ? "" : n + " "}that cool-down looks dangerous… keep going slow for me`;
    case "Shy heat":
      return `hey… i see you. you don’t have to rush — just stay right there for me`;
    case "Mesh brat":
      return `yeah i’m looking. don’t stop showing off — make me ask for it`;
    case "Soft goth":
      return `i’m still. keep the ritual slow… i want every second of that lace`;
    case "Cool-down":
      return `set’s not over. hold that edge for me — i’m watching the whole cool-down`;
    case "Brat game":
      return `cute. now make me work for it — count and tease, don’t finish me yet`;
    case "Flagship edge":
      return `fuck… slow strokes only. edge me with that sheer — say when i can beg`;
    case "Open panel":
      return `i’m not rushing you. keep teasing that open panel — look at me while you do`;
    default:
      return `i’m here. keep going slow — don’t rush the heat`;
  }
}

/**
 * Pre-start / pre-first-message continuity — shows the signature opening so
 * gallery card → chat handoff feels like the same person.
 */
export function OpeningLinePreview({
  characterId,
  characterName,
  openingMessage,
  variant = "idle",
  onSeedReply,
}: {
  characterId?: string | null;
  characterName?: string | null;
  openingMessage?: string | null;
  /** idle = before start; live = session ready but no messages yet */
  variant?: "idle" | "live";
  /** Drop a mind-matched reply seed into the composer */
  onSeedReply?: (text: string) => void;
}) {
  const line = openingMessage?.trim();
  if (!line) return null;

  const mind = mindFingerprint(characterId);
  const nick = characterName?.trim().split(/\s+/)[0] || "They";
  const seed = replySeedFor(characterId, nick);

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed ${
        variant === "live"
          ? "border-brand-accent/30 bg-brand-accent/5"
          : "border-brand-border/80 bg-brand-bg/60"
      }`}
      role="note"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
          {variant === "live" ? `${nick} opens with` : `How ${nick} opens`}
        </p>
        {mind && (
          <span className="rounded-full border border-brand-border px-2 py-0.5 text-[9px] text-brand-muted">
            {mind.tag}
          </span>
        )}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-brand-muted">“{line}”</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {variant === "idle" && (
          <p className="text-[10px] text-brand-soft">
            Start or Edge Pace — they lead with this energy.
          </p>
        )}
        {onSeedReply && (
          <button
            type="button"
            onClick={() => onSeedReply(seed)}
            className="btn-ghost min-h-0 border-brand-accent/35 px-2.5 py-1 text-[10px] text-brand-accent"
            title="Drop a matching reply into the composer"
          >
            {variant === "live" ? "Seed my reply" : "Preload reply"}
          </button>
        )}
      </div>
    </div>
  );
}
