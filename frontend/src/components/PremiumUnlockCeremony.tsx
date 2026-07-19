"use client";

import Link from "next/link";

/**
 * Post-checkout unlock — premium should feel usable the second after pay.
 * Primary path: Create / My models (headroom), not a dead notice line.
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

  return (
    <section
      id="premium-unlocked"
      className="mb-4 animate-rise-in scroll-mt-24 rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-brand-panel to-violet-500/10 p-5 shadow-glow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100/95">
            You&apos;re unlocked · {planLabel}
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-brand-text sm:text-xl">
            Premium is live — use the headroom
          </h2>
          <p className="mt-1.5 text-sm text-brand-muted">
            Cap is now{" "}
            <strong className="text-amber-100">{customsLimit} My Characters</strong>
            {planExpiresAt
              ? ` · until ${new Date(planExpiresAt).toLocaleString()}`
              : ""}
            . Free chat never changed — this is pure upside.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/chat?create=1"
              className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
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
            Higher upload limits are on too — drop clips on any My Character after create.
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
