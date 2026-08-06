"use client";

import { mindFingerprint } from "@/lib/mind-fingerprint";

/**
 * Shows when an unsent draft is waiting for this mind — nudge to Start or clear.
 */
export function DraftRecoveryHint({
  characterId,
  characterName,
  draftPreview,
  onClear,
}: {
  characterId: string;
  characterName?: string | null;
  draftPreview: string;
  onClear: () => void;
}) {
  const mind = mindFingerprint(characterId);
  const nick = characterName?.trim().split(/\s+/)[0] || "them";
  const preview =
    draftPreview.length > 90 ? `${draftPreview.slice(0, 87).trim()}…` : draftPreview;

  return (
    <div className="animate-fade-in rounded-xl border border-amber-400/35 bg-amber-500/8 px-3 py-2 text-[11px] leading-relaxed">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
            Draft waiting · {nick}
            {mind ? ` · ${mind.tag}` : ""}
          </p>
          <p className="mt-0.5 line-clamp-2 text-brand-muted">“{preview}”</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-[10px] text-brand-muted hover:text-brand-text"
        >
          Clear draft
        </button>
      </div>
    </div>
  );
}
