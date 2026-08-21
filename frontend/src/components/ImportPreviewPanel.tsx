"use client";

import type { ImportPreview } from "@/lib/api";
import type { ExportCharacterRef } from "@/lib/import-characters";
import type { LiveCharacterOption } from "@/lib/types";

const BUILTIN_OPTIONS = [
  { id: "twink-default", displayName: "Twink Default" },
  { id: "female-default", displayName: "Female Default" },
];

export interface ImportPreviewPanelProps {
  preview: ImportPreview;
  missing: ExportCharacterRef[];
  characterMap: Record<string, string>;
  onCharacterMapChange: (next: Record<string, string>) => void;
  fallbackId: string;
  onFallbackChange: (id: string) => void;
  liveCharacters: LiveCharacterOption[];
  busy?: boolean;
  confirmLabel?: string;
  onRefreshPreview?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** Which successful session to open live after import (chat). */
  openIndex?: number | null;
  onOpenIndexChange?: (index: number) => void;
  showOpenPicker?: boolean;
}

export function ImportPreviewPanel({
  preview,
  missing,
  characterMap,
  onCharacterMapChange,
  fallbackId,
  onFallbackChange,
  liveCharacters,
  busy = false,
  confirmLabel,
  onRefreshPreview,
  onConfirm,
  onCancel,
  openIndex = null,
  onOpenIndexChange,
  showOpenPicker = false,
}: ImportPreviewPanelProps) {
  const options =
    liveCharacters.length > 0
      ? liveCharacters
      : BUILTIN_OPTIONS.map((c) => ({
          id: c.id,
          displayName: c.displayName,
        }));

  const openable = preview.sessions.filter((s) => s.ok);
  const selected =
    typeof openIndex === "number" && openable.some((s) => s.index === openIndex)
      ? openIndex
      : (openable[0]?.index ?? null);

  return (
    <div className="space-y-3 rounded-xl border border-brand-accent/40 bg-brand-accent/5 p-3 animate-fade-in">
      <div>
        <p className="text-sm font-medium text-brand-text">Import preview (dry-run)</p>
        <p className="mt-1 text-[11px] text-brand-muted">
          Nothing written yet.{" "}
          <span className="text-brand-text">{preview.willSucceed} will import</span>
          {preview.willFail > 0 ? ` · ${preview.willFail} blocked` : ""}
          {` · ${preview.totalMessages} msgs`}
          {preview.capped ? " · capped at max bulk size" : ""}
          {` · ${preview.entriesParsed}/${preview.bulkTotal} sessions parsed`}
        </p>
      </div>

      {showOpenPicker && openable.length > 1 && (
        <p className="text-[11px] text-brand-accent">
          Select which chat to open live (others still import as saved sessions).
        </p>
      )}

      <ul className="max-h-48 space-y-1 overflow-y-auto text-[11px]">
        {preview.sessions.slice(0, 20).map((s) => {
          const isOpen = showOpenPicker && s.ok && selected === s.index;
          return (
            <li key={`${s.index}-${s.originalCharacterId}`}>
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 ${
                  s.ok
                    ? isOpen
                      ? "border-brand-accent bg-brand-accent/10 text-brand-text"
                      : "border-brand-border/60 bg-brand-bg text-brand-muted"
                    : "cursor-default border-red-500/30 bg-red-500/5 text-red-200/90"
                }`}
              >
                {showOpenPicker && s.ok && onOpenIndexChange && (
                  <input
                    type="radio"
                    name="import-open-index"
                    className="mt-0.5 accent-brand-accent"
                    checked={selected === s.index}
                    onChange={() => onOpenIndexChange(s.index)}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-brand-text">{s.characterName}</span>
                  {` · ${s.messageCount} msgs`}
                  {s.ok && s.remappedFrom
                    ? ` · remap ${s.remappedFrom} → ${s.characterId}`
                    : s.ok
                      ? ` · ${s.characterId}`
                      : ` · ${s.error ?? "blocked"}`}
                  {isOpen && (
                    <span className="ml-1 text-[10px] uppercase tracking-wide text-brand-accent">
                      open
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
        {preview.sessions.length > 20 && (
          <li className="text-brand-muted">…and {preview.sessions.length - 20} more</li>
        )}
      </ul>

      {missing.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5">
          <p className="text-xs font-medium text-amber-100">Remap missing characters</p>
          <ul className="space-y-2">
            {missing.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-brand-text">{m.name}</p>
                  <p className="truncate font-mono text-[10px] text-brand-muted">
                    {m.id} · {m.sessionCount} chat(s)
                  </p>
                </div>
                <select
                  value={characterMap[m.id] ?? fallbackId}
                  onChange={(e) =>
                    onCharacterMapChange({ ...characterMap, [m.id]: e.target.value })
                  }
                  className="field min-h-0 py-1.5 text-xs sm:max-w-[14rem]"
                >
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <label className="flex flex-wrap items-center gap-2 text-[11px] text-brand-muted">
            Fallback for any other miss
            <select
              value={fallbackId}
              onChange={(e) => onFallbackChange(e.target.value)}
              className="field min-h-0 py-1 text-xs"
            >
              <option value="twink-default">Twink Default</option>
              <option value="female-default">Female Default</option>
              {liveCharacters
                .filter((c) => c.id !== "twink-default" && c.id !== "female-default")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {missing.length > 0 && onRefreshPreview && (
          <button
            type="button"
            disabled={busy}
            onClick={onRefreshPreview}
            className="btn-ghost min-h-0 px-3 py-1.5 text-xs"
          >
            Refresh preview
          </button>
        )}
        <button
          type="button"
          disabled={busy || preview.willSucceed === 0}
          onClick={onConfirm}
          className="btn-primary min-h-0 px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {confirmLabel ?? `Confirm import (${preview.willSucceed})`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="btn-ghost min-h-0 px-3 py-1.5 text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
