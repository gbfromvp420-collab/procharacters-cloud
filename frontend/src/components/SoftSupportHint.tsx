"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchBillingStatus } from "@/lib/api";
import { loadStoredAccount } from "@/lib/account-storage";

const DISMISS_KEY = "procharacters.softSupport.dismissed.v1";

/**
 * Optional support path — only after real engagement, never blocks free chat.
 * Cashflow with dignity: free forever, Day Pass / Supporter when ready.
 */
export function SoftSupportHint({
  hasEngagement,
  className = "",
}: {
  /** True when user has resume(s) or is mid-session with messages. */
  hasEngagement: boolean;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (!hasEngagement) {
          if (!cancelled) setShow(false);
          return;
        }
        if (window.localStorage.getItem(DISMISS_KEY)) {
          if (!cancelled) setShow(false);
          return;
        }
        const account = loadStoredAccount();
        if (!account) {
          if (!cancelled) {
            setSignedIn(false);
            setShow(true);
          }
          return;
        }
        if (!cancelled) setSignedIn(true);
        try {
          const status = await fetchBillingStatus(account.token);
          if (cancelled) return;
          if (status.activePremium) {
            setShow(false);
            return;
          }
          setCheckoutReady(!!status.configured);
          setShow(true);
        } catch {
          if (!cancelled) setShow(true);
        }
      } catch {
        if (!cancelled) setShow(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [hasEngagement]);

  if (!show) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div
      className={`rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-brand-panel/80 to-brand-panel px-3 py-2.5 text-[11px] leading-relaxed ${className}`}
      role="note"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">
            Free forever · optional support
          </p>
          <p className="mt-1 text-brand-muted">
            {signedIn ? (
              <>
                Chat stays free. Optional{" "}
                <strong className="text-brand-text">Day Pass</strong> /{" "}
                <strong className="text-brand-text">Supporter</strong> unlocks more My Characters
                {checkoutReady ? " — when you’re ready." : "."}
              </>
            ) : (
              <>
                Sign in once to sync resume codes across phones. Support is optional —
                <strong className="text-brand-text"> free chat never paywalls</strong>.
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/account"
              className="btn-ghost min-h-0 border-amber-500/40 px-3 py-1.5 text-xs text-amber-100"
            >
              {signedIn ? "View Day Pass" : "Sign in · Account"}
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="min-h-0 px-2 py-1.5 text-[10px] text-brand-muted hover:text-brand-text"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-[10px] text-brand-muted hover:text-brand-text"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
