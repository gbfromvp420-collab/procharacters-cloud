"use client";

import { useEffect, useState } from "react";
import { mindFingerprint } from "@/lib/mind-fingerprint";

/**
 * Soft “pick up the heat” line when resuming — paints before/alongside history.
 */
export function RejoinRecapToast({
  show,
  characterId,
  characterName,
  recapLine,
  priorNotes,
  dnaTreeLabel,
  dnaTreeNodeId,
  onDismiss,
}: {
  show: boolean;
  characterId?: string | null;
  characterName?: string | null;
  recapLine?: string | null;
  priorNotes?: string | null;
  dnaTreeLabel?: string | null;
  dnaTreeNodeId?: string | null;
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const mind = mindFingerprint(characterId);
  const nick = characterName?.trim().split(/\s+/)[0] || "Them";
  const dnaLive =
    dnaTreeLabel?.trim() ||
    dnaTreeNodeId?.trim() ||
    extractDnaLabel(priorNotes) ||
    null;

  const line =
    recapLine?.trim() ||
    (dnaLive ? `DNA · ${dnaLive} still warm — pick up the climb` : null) ||
    extractPriorHeat(priorNotes) ||
    mind?.blurb ||
    null;

  useEffect(() => {
    if (!show || !line) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 6500);
    return () => window.clearTimeout(t);
    // Intentionally omit onDismiss — parent inline callbacks should not restart the toast timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, line]);

  if (!visible || !line) return null;

  return (
    <div
      className={`mb-3 animate-rise-in rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed shadow-glow-sm ${
        dnaLive
          ? "border-violet-400/45 bg-gradient-to-r from-violet-500/15 via-rose-500/10 to-brand-panel"
          : "border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-brand-panel to-brand-panel"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${
              dnaLive ? "text-violet-200/95" : "text-amber-200/90"
            }`}
          >
            {dnaLive ? `DNA power reclaim · ${nick}` : `Pick up the heat · ${nick}`}
            {mind ? ` · ${mind.tag}` : ""}
            {dnaLive ? ` · ${dnaLive.split(/\s+/)[0]}` : ""}
          </p>
          <p className="mt-1 text-brand-muted">
            {recapLine?.trim() ? `“${line}”` : line}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
          className="shrink-0 text-[10px] text-brand-muted hover:text-brand-text"
          aria-label="Dismiss recap"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function extractDnaLabel(prior?: string | null): string | null {
  if (!prior?.trim()) return null;
  const m =
    prior.match(/DNA power climb:\s*([^(\n]+)/i) ||
    prior.match(/DNA tree ·\s*([^.]+)/i);
  return m?.[1]?.trim().replace(/\s*·\s*Edge Pace\s*$/i, "") || null;
}

function extractPriorHeat(prior?: string | null): string | null {
  if (!prior?.trim()) return null;
  const name = prior.match(/(?:Called|call(?:ed)? me)\s*[:\s]+([A-Za-z][\w.-]{1,24})/i)?.[1];
  const scene = prior.match(/Last scene lock[\s\S]*?\n-\s*(.+)/i)?.[1]?.trim();
  const heat = prior.match(/Recurring heat[\s\S]*?\n-\s*(.+)/i)?.[1]?.trim();
  const recent = prior.match(/Recent sessions[\s\S]*?\n-\s*(.+)/i)?.[1]?.trim();
  const wants = prior.match(/What they want[\s\S]*?\n-\s*(.+)/i)?.[1]?.trim();
  const dna = extractDnaLabel(prior);

  if (name && dna) {
    const line = `${name} · DNA ${dna}`;
    return line.length > 120 ? `${line.slice(0, 117)}…` : line;
  }
  if (dna && scene) {
    const line = `DNA · ${dna} · last: ${scene}`;
    return line.length > 120 ? `${line.slice(0, 117)}…` : line;
  }
  if (name && scene) {
    const line = `${name} · last: ${scene}`;
    return line.length > 120 ? `${line.slice(0, 117)}…` : line;
  }
  if (name && heat) {
    const line = `${name} · ${heat}`;
    return line.length > 120 ? `${line.slice(0, 117)}…` : line;
  }
  if (dna) return `DNA · ${dna} still warm`;
  if (scene) return scene.length > 120 ? `${scene.slice(0, 117)}…` : scene;
  if (heat) return heat.length > 120 ? `${heat.slice(0, 117)}…` : heat;
  if (recent) return recent.length > 120 ? `${recent.slice(0, 117)}…` : recent;
  if (wants) return wants.length > 120 ? `${wants.slice(0, 117)}…` : wants;
  return null;
}
