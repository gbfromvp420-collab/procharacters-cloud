"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  consumeAccountNotice,
  DEFAULT_REAUTH_NOTICE,
  invalidateStoredAccount,
  loadStoredAccount,
} from "@/lib/account-storage";
import { fetchAccountMe, isAccountAuthError } from "@/lib/api";

/**
 * Surfaces a re-login CTA when the stored bearer token is dead
 * (e.g. after accounts Postgres cutover, or session expiry).
 */
export function SessionAuthBanner({
  className = "",
  onInvalidated,
}: {
  className?: string;
  /** Fired when a stale local session is cleared so parents can reset UI. */
  onInvalidated?: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const pending = consumeAccountNotice();
    if (pending) {
      setMessage(pending);
    }

    const stored = loadStoredAccount();
    if (!stored) return;

    void fetchAccountMe(stored.token)
      .then(() => {
        /* token still good */
      })
      .catch((error) => {
        if (cancelled) return;
        if (!isAccountAuthError(error)) return;
        invalidateStoredAccount(DEFAULT_REAUTH_NOTICE);
        setMessage(DEFAULT_REAUTH_NOTICE);
        onInvalidated?.();
      });

    return () => {
      cancelled = true;
    };
  }, [onInvalidated]);

  if (dismissed || !message) return null;

  return (
    <div
      className={`rounded-xl border border-amber-500/45 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-50 shadow-glow-sm sm:px-4 sm:py-3 ${className}`}
      role="status"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 leading-snug">
          <span className="font-semibold text-amber-100">Sign in again. </span>
          {message}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/account"
            className="btn-primary min-h-0 px-3 py-1.5 text-xs sm:text-sm"
          >
            Sign in
          </Link>
          <button
            type="button"
            className="btn-ghost min-h-0 px-2 py-1.5 text-xs text-amber-100/80"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
