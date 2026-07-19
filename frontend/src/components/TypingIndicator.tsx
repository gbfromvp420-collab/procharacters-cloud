"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";

export function TypingIndicator({
  name,
  characterId,
}: {
  name?: string | null;
  characterId?: string | null;
}) {
  const mind = mindFingerprint(characterId);
  const nick = name?.trim().split(/\s+/)[0] || name || null;

  return (
    <div className="flex justify-start animate-rise-in">
      <div className="flex items-center gap-2.5 rounded-2xl border border-brand-accent/30 bg-brand-accent/5 px-4 py-3 shadow-glow-sm">
        <span className="flex gap-1" aria-hidden>
          <span className="typing-dot" />
          <span className="typing-dot animation-delay-150" />
          <span className="typing-dot animation-delay-300" />
        </span>
        <span className="text-xs text-brand-muted">
          {nick ? (
            <>
              <span className="font-medium text-brand-text">{nick}</span>
              {mind ? (
                <span className="text-brand-accent"> · {mind.tag}</span>
              ) : null}
              <span> is typing…</span>
            </>
          ) : (
            "Typing…"
          )}
        </span>
      </div>
    </div>
  );
}
