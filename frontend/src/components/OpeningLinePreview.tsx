"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";

/**
 * Pre-start / pre-first-message continuity — shows the signature opening so
 * gallery card → chat handoff feels like the same person.
 */
export function OpeningLinePreview({
  characterId,
  characterName,
  openingMessage,
  variant = "idle",
}: {
  characterId?: string | null;
  characterName?: string | null;
  openingMessage?: string | null;
  /** idle = before start; live = session ready but no messages yet */
  variant?: "idle" | "live";
}) {
  const line = openingMessage?.trim();
  if (!line) return null;

  const mind = mindFingerprint(characterId);
  const nick = characterName?.trim().split(/\s+/)[0] || "They";

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
      {variant === "idle" && (
        <p className="mt-1.5 text-[10px] text-brand-soft">
          Start or Edge Pace — they lead with this energy.
        </p>
      )}
    </div>
  );
}
