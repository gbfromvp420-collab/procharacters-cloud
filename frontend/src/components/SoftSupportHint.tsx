"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchBillingCatalog,
  fetchBillingStatus,
  formatUsdCents,
  startBillingCheckout,
  type BillingCatalogProduct,
} from "@/lib/api";
import { loadStoredAccount } from "@/lib/account-storage";
import {
  isSessionWinActive,
  isSoftSupportInCooldown,
} from "@/lib/conversion-flags";

const DISMISS_KEY = "procharacters.softSupport.dismissed.v1";

/**
 * Optional support path — only after real engagement, never blocks free chat.
 * Yields while SessionWinToast owns the heat→Day Pass moment (no double-ask).
 */
export function SoftSupportHint({
  hasEngagement,
  className = "",
  dnaHeat = false,
}: {
  /** True when user has resume(s) or is mid-session with messages. */
  hasEngagement: boolean;
  className?: string;
  /** Mid-session DNA tree climb — frame support as more forge headroom. */
  dnaHeat?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [products, setProducts] = useState<BillingCatalogProduct[]>([]);
  const [busy, setBusy] = useState<"day_pass" | "supporter" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let poll: number | undefined;

    async function run() {
      try {
        if (!hasEngagement) {
          if (!cancelled) setShow(false);
          return;
        }
        // Heat-win toast owns conversion while visible
        if (isSessionWinActive() || isSoftSupportInCooldown()) {
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
            setCheckoutReady(false);
            setShow(true);
          }
          return;
        }
        if (!cancelled) setSignedIn(true);
        try {
          const [status, catalog] = await Promise.all([
            fetchBillingStatus(account.token),
            fetchBillingCatalog().catch(() => null),
          ]);
          if (cancelled) return;
          if (status.activePremium) {
            setShow(false);
            return;
          }
          // Re-check yield flags after async (win toast may have opened)
          if (isSessionWinActive() || isSoftSupportInCooldown()) {
            setShow(false);
            return;
          }
          setCheckoutReady(!!status.configured);
          if (catalog?.products?.length) {
            setProducts(catalog.products);
          }
          setShow(true);
        } catch {
          if (!cancelled && !isSessionWinActive()) setShow(true);
        }
      } catch {
        if (!cancelled) setShow(false);
      }
    }

    void run();
    // Poll lightly so we hide when SessionWin opens mid-session
    poll = window.setInterval(() => {
      if (isSessionWinActive() || isSoftSupportInCooldown()) {
        setShow(false);
      }
    }, 1200);

    return () => {
      cancelled = true;
      if (poll != null) window.clearInterval(poll);
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

  const priceLabel = (id: "day_pass" | "supporter", fallback: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return fallback;
    return formatUsdCents(p.amountCents, p.currency);
  };

  const onCheckout = async (product: "day_pass" | "supporter") => {
    const account = loadStoredAccount();
    if (!account) {
      window.location.href = "/account";
      return;
    }
    setBusy(product);
    setError(null);
    try {
      const { url } = await startBillingCheckout(account.token, product);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed — free chat still works");
      setBusy(null);
    }
  };

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed ${className} ${
        dnaHeat
          ? "border-violet-400/35 bg-gradient-to-r from-violet-500/12 via-amber-500/8 to-brand-panel/80"
          : "border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-brand-panel/80 to-brand-panel"
      }`}
      role="note"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
              dnaHeat ? "text-violet-200/95" : "text-amber-200/90"
            }`}
          >
            {dnaHeat ? "Forge heat · optional headroom" : "Free forever · optional support"}
          </p>
          <p className="mt-1 text-brand-muted">
            {signedIn ? (
              dnaHeat ? (
                <>
                  You climbed DNA heat. Chat stays free. Optional{" "}
                  <strong className="text-brand-text">Day Pass</strong> unlocks more forged My
                  Characters
                  {checkoutReady ? " — one tap, no pressure." : "."}
                </>
              ) : (
                <>
                  Chat stays free. Optional{" "}
                  <strong className="text-brand-text">Day Pass</strong> /{" "}
                  <strong className="text-brand-text">Supporter</strong> unlocks more My Characters
                  {checkoutReady ? " — one tap when you’re ready." : "."}
                </>
              )
            ) : (
              <>
                Sign in once to sync resume codes across phones. Support is optional —
                <strong className="text-brand-text"> free chat never paywalls</strong>.
              </>
            )}
          </p>
          {error && (
            <p className="mt-1.5 text-[10px] text-rose-300/90" role="alert">
              {error}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {signedIn && checkoutReady ? (
              <>
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => void onCheckout("day_pass")}
                  className="btn-primary min-h-0 border-amber-400/40 bg-amber-500/90 px-3 py-1.5 text-xs text-brand-bg disabled:opacity-60"
                >
                  {busy === "day_pass"
                    ? "Opening…"
                    : `Day Pass · ${priceLabel("day_pass", "$4.99")}`}
                </button>
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => void onCheckout("supporter")}
                  className="btn-ghost min-h-0 border-amber-500/40 px-3 py-1.5 text-xs text-amber-100 disabled:opacity-60"
                >
                  {busy === "supporter"
                    ? "Opening…"
                    : `Supporter · ${priceLabel("supporter", "$9.99")}`}
                </button>
                <Link
                  href="/account"
                  className="min-h-0 px-2 py-1.5 text-[10px] text-brand-muted hover:text-brand-text"
                >
                  Details
                </Link>
              </>
            ) : (
              <Link
                href="/account"
                className="btn-ghost min-h-0 border-amber-500/40 px-3 py-1.5 text-xs text-amber-100"
              >
                {signedIn ? "View Day Pass" : "Sign in · Account"}
              </Link>
            )}
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
