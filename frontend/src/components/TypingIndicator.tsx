"use client";

import { dnaAssistantBubbleClass, dnaNodeShortLabel, dnaTreeHeatLevel } from "@/lib/energy";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import { presenceBubbleClass, resolvePresenceSkin } from "@/lib/presence";

export function TypingIndicator({
  name,
  characterId,
  dnaTreeNodeId,
  dnaTreeLabel,
}: {
  name?: string | null;
  characterId?: string | null;
  dnaTreeNodeId?: string | null;
  dnaTreeLabel?: string | null;
}) {
  const mind = mindFingerprint(characterId);
  const nick = name?.trim().split(/\s+/)[0] || name || null;
  const skin = resolvePresenceSkin(undefined, characterId);
  const dnaLevel = dnaTreeHeatLevel(dnaTreeNodeId, dnaTreeLabel);
  const dnaShort = dnaNodeShortLabel(dnaTreeNodeId, dnaTreeLabel);
  const dnaBubble = dnaAssistantBubbleClass(dnaTreeNodeId, dnaTreeLabel);
  const bubble = dnaBubble || presenceBubbleClass(skin);
  const hot = dnaLevel >= 2;

  return (
    <div className="flex justify-start animate-rise-in">
      <div
        className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-glow-sm ${bubble} ${
          hot ? "ring-1 ring-violet-400/35" : ""
        }`}
      >
        <span className="flex gap-1" aria-hidden>
          <span className={`typing-dot ${hot ? "typing-dot-dna" : ""}`} />
          <span className={`typing-dot animation-delay-150 ${hot ? "typing-dot-dna" : ""}`} />
          <span className={`typing-dot animation-delay-300 ${hot ? "typing-dot-dna" : ""}`} />
        </span>
        <span className="text-xs text-brand-muted">
          {nick ? (
            <>
              <span className="font-medium text-brand-text">{nick}</span>
              {dnaShort ? (
                <span className="text-violet-200"> · DNA {dnaShort}</span>
              ) : mind ? (
                <span className="text-brand-accent"> · {mind.tag}</span>
              ) : null}
              <span>{hot ? " is climbing…" : " is typing…"}</span>
            </>
          ) : hot ? (
            "Climbing…"
          ) : (
            "Typing…"
          )}
        </span>
      </div>
    </div>
  );
}
