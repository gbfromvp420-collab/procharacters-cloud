"use client";

/**
 * Soft “how deep is this heat” meter — visual stickiness, not a scoreboard.
 */
export function SessionDepthMeter({
  messageCount,
  liveSeconds,
}: {
  messageCount: number;
  liveSeconds?: number | null;
}) {
  if (messageCount <= 0 && !liveSeconds) return null;

  const level =
    messageCount >= 20 ? 4 : messageCount >= 12 ? 3 : messageCount >= 6 ? 2 : messageCount >= 2 ? 1 : 0;
  const labels = ["spark", "warm", "edge", "deep", "locked"];
  const label = labels[level] ?? "spark";

  const mins =
    liveSeconds != null && liveSeconds >= 60
      ? Math.floor(liveSeconds / 60)
      : null;
  const secs =
    liveSeconds != null && liveSeconds < 60
      ? liveSeconds
      : liveSeconds != null
        ? liveSeconds % 60
        : null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={`Heat depth ${label}`}>
      <div className="flex items-center gap-0.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-3 rounded-full transition-colors ${
              i <= level
                ? i >= 3
                  ? "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]"
                  : i >= 2
                    ? "bg-brand-accent"
                    : "bg-brand-accent/70"
                : "bg-brand-border"
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-brand-muted">
        {label}
      </span>
      {mins != null && (
        <span className="font-mono text-[10px] tabular-nums text-brand-soft">
          {mins}m{secs != null && secs > 0 ? ` ${secs}s` : ""}
        </span>
      )}
      {mins == null && secs != null && (
        <span className="font-mono text-[10px] tabular-nums text-brand-soft">{secs}s</span>
      )}
    </div>
  );
}
