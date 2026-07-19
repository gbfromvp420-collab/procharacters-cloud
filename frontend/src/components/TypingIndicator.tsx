"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";
import {
  presenceBubbleClass,
  resolvePresenceSkin,
} from "@/lib/presence";

export function TypingIndicator({
  name,
  characterId,
}: {
  name?: string | null;
  characterId?: string | null;
}) {
  const mind = mindFingerprint(characterId);
  const nick = name?.trim().split(/\s+/)[0] || name || null;
  const skin = resolvePresenceSkin(undefined, characterId);
  const bubble = presenceBubbleClass(skin);

  return (
    <div className="flex justify-start animate-rise-in">
      <div
        className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-glow-sm ${bubble}`}
      >
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
