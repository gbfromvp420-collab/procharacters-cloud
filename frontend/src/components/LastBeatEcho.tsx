"use client";

/**
 * Soft echo of their last line above the composer — keep the thread in your hands.
 */
export function LastBeatEcho({
  text,
  name,
  onQuote,
}: {
  text: string;
  name?: string | null;
  onQuote?: () => void;
}) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const preview = clean.length > 100 ? `${clean.slice(0, 97).trim()}…` : clean;
  const nick = name?.trim().split(/\s+/)[0] || "Them";

  return (
    <button
      type="button"
      onClick={onQuote}
      className="mb-2 w-full rounded-lg border border-brand-border/70 bg-brand-bg/40 px-2.5 py-1.5 text-left transition hover:border-brand-accent/40"
      title="Tap to quote into composer"
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-brand-accent/90">
        Last beat · {nick}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-brand-muted">
        “{preview}”
      </p>
    </button>
  );
}
