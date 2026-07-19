"use client";

import Link from "next/link";

/**
 * Post-checkout unlock — premium should feel usable the second after pay.
 * Primary path: Studio Forge (conversational DNA) → My models — not a dead notice.
 */
export function PremiumUnlockCeremony({
  plan,
  customsLimit,
  planExpiresAt,
  onDismiss,
}: {
  plan: string;
  customsLimit: number;
  planExpiresAt?: string | null;
  onDismiss?: () => void;
}) {
  const planLabel =
    plan === "supporter" ? "Supporter" : plan === "day_pass" ? "Day Pass" : plan.replace(/_/g, " ");
  const isDayPass = plan === "day_pass";

  return (
    <section
      id="premium-unlocked"
      className="mb-4 animate-rise-in scroll-mt-24 rounded-2xl border border-violet-400/45 bg-gradient-to-br from-violet-500/20 via-amber-500/15 to-brand-panel p-5 shadow-glow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-100/95">
            You&apos;re unlocked · {planLabel}
            {isDayPass ? " · forge window open" : ""}
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-brand-text sm:text-xl">
            {isDayPass
              ? "Day Pass is live — forge another DNA model"
              : "Premium is live — use the forge headroom"}
          </h2>
          <p className="mt-1.5 text-sm text-brand-muted">
            Cap is now{" "}
            <strong className="text-amber-100">{customsLimit} My Characters</strong>
            {planExpiresAt
              ? ` · until ${new Date(planExpiresAt).toLocaleString()}`
              : ""}
            . Type a fantasy in Studio — conversational forge builds adaptive DNA under 5s. Free chat
            never paywalled.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/models/studio"
              className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-violet-300/50 hover:brightness-110"
            >
              {isDayPass ? "Forge another model →" : "Open Studio Forge →"}
            </Link>
            <Link
              href="/models/studio"
              className="rounded-lg border border-brand-accent/50 bg-brand-accent/15 px-4 py-2.5 text-sm font-medium text-brand-text hover:border-brand-accent"
            >
              Create My Character
            </Link>
            <Link
              href="/?filter=owned"
              className="rounded-lg border border-violet-400/50 bg-violet-500/15 px-4 py-2.5 text-sm font-medium text-violet-100 hover:border-violet-300/70"
            >
              My models
            </Link>
            <Link
              href="/account#my-models"
              className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100 hover:border-amber-300/60"
            >
              Models hub
            </Link>
            <Link
              href="/chat"
              className="rounded-lg border border-brand-border px-4 py-2.5 text-sm text-brand-muted hover:border-brand-accent hover:text-brand-text"
            >
              Live chat
            </Link>
          </div>
          <p className="mt-3 text-[11px] text-brand-muted">
            Higher upload limits are on — drop clips after forge, then Chat Now and climb the DNA tree.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-[11px] text-brand-muted hover:text-brand-text"
            aria-label="Dismiss unlock"
          >
            ✕
          </button>
        )}
      </div>
    </section>
  );
}
