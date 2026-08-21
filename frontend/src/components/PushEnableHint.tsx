"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { sendTestPush } from "@/lib/api";
import { loadStoredAccount } from "@/lib/account-storage";
import { loadStoredSession } from "@/lib/session-storage";
import { enableWebPush, isPushSupported, registerPushServiceWorker } from "@/lib/web-push-client";

const DISMISS_KEY = "procharacters.pushHint.dismissed.v1";
const TESTED_KEY = "procharacters.pushHint.tested.v1";
const RESUME_CACHE_KEY = "procharacters.resumeByCharacter.v1";

type Mode = "enable" | "verify" | "sign_in";

type Props = {
  accountToken?: string | null;
  hasResumeCode?: boolean;
  className?: string;
};

function hasAnyResumeCode(): boolean {
  try {
    const stored = loadStoredSession();
    if (stored?.resumeCode) return true;
    const raw = window.localStorage.getItem(RESUME_CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {
      byCharacter?: Record<string, { resumeCode?: string }>;
    };
    return Object.values(parsed.byCharacter ?? {}).some((e) => !!e?.resumeCode);
  } catch {
    return false;
  }
}

function markTested() {
  try {
    window.localStorage.setItem(TESTED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Full phone-smoke loop on /chat:
 * 1. Sign-in CTA if resume exists but guest
 * 2. Enable alerts if signed in, not subscribed
 * 3. Send test once after subscribe (or if never tested)
 */
export function PushEnableHint({
  accountToken: accountTokenProp,
  hasResumeCode: hasResumeCodeProp,
  className = "",
}: Props) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const hide = useCallback((persistDismiss: boolean) => {
    if (persistDismiss) {
      try {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    }
    setMode(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function evaluate() {
      try {
        if (window.localStorage.getItem(DISMISS_KEY)) {
          if (!cancelled) setMode(null);
          return;
        }
        if (!isPushSupported()) {
          if (!cancelled) setMode(null);
          return;
        }

        const hasResume = hasResumeCodeProp !== undefined ? hasResumeCodeProp : hasAnyResumeCode();
        if (!hasResume) {
          if (!cancelled) setMode(null);
          return;
        }

        const account = loadStoredAccount();
        const resolvedToken = accountTokenProp ?? account?.token ?? null;
        if (!cancelled) setToken(resolvedToken);

        // Guest with a resume worth protecting
        if (!resolvedToken) {
          if (!cancelled) setMode("sign_in");
          return;
        }

        if (Notification.permission === "denied") {
          if (!cancelled) setMode(null);
          return;
        }

        let subscribed = false;
        if (Notification.permission === "granted") {
          const reg = await registerPushServiceWorker();
          const sub = await reg?.pushManager.getSubscription();
          subscribed = !!sub;
        }

        const alreadyTested = !!window.localStorage.getItem(TESTED_KEY);

        if (!subscribed) {
          if (!cancelled) setMode("enable");
          return;
        }

        // Subscribed but never smoke-tested on this browser
        if (!alreadyTested) {
          if (!cancelled) setMode("verify");
          return;
        }

        if (!cancelled) setMode(null);
      } catch {
        if (!cancelled) setMode(null);
      }
    }

    void evaluate();
    timer = window.setInterval(() => void evaluate(), 4000);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [accountTokenProp, hasResumeCodeProp]);

  const resolveToken = () => token ?? accountTokenProp ?? loadStoredAccount()?.token ?? null;

  const onEnable = async () => {
    const t = resolveToken();
    if (!t) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await enableWebPush(t);
      if (result.ok) {
        setStatus("Alerts on — send a test to prove the shade.");
        setMode("verify");
      } else {
        setStatus(result.error || "Could not enable push");
      }
    } finally {
      setBusy(false);
    }
  };

  const onSendTest = async () => {
    const t = resolveToken();
    if (!t) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await sendTestPush(t);
      if (result.ok && result.sent > 0) {
        markTested();
        setStatus(`Test sent to ${result.sent} device(s) — check the notification shade.`);
        window.setTimeout(() => hide(true), 2800);
      } else if (result.ok && result.sent === 0) {
        setStatus("No devices got the test — try Enable alerts again.");
        setMode("enable");
      } else {
        setStatus(result.error || "Test failed");
      }
    } catch (err) {
      // Includes 429 "try again in Ns" from sendTestPush
      setStatus(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(false);
    }
  };

  if (!mode) return null;

  const title =
    mode === "sign_in"
      ? "Don’t lose this chat"
      : mode === "verify"
        ? "Prove alerts work"
        : "Don’t lose this chat";

  const body =
    mode === "sign_in"
      ? "Sign in so we can alert you when your resume code is about to expire — even with the tab closed."
      : mode === "verify"
        ? "You’re subscribed. Send a one-shot test now — no need to open Account."
        : "Enable alerts so we can warn you when your resume code is about to expire — even with the tab closed.";

  return (
    <div
      className={`rounded-xl border border-brand-accent/30 bg-brand-accent/5 px-3 py-2.5 text-[11px] leading-relaxed text-brand-muted ${className}`}
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
            {title}
          </p>
          <p className="mt-1 text-brand-muted">{body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {mode === "sign_in" && (
              <Link
                href="/account"
                className="btn-primary min-h-0 px-3 py-1.5 text-xs no-underline"
              >
                Sign in for alerts
              </Link>
            )}
            {mode === "enable" && (
              <button
                type="button"
                disabled={busy || !resolveToken()}
                onClick={() => void onEnable()}
                className="btn-primary min-h-0 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {busy ? "Enabling…" : "Enable alerts"}
              </button>
            )}
            {mode === "verify" && (
              <>
                <button
                  type="button"
                  disabled={busy || !resolveToken()}
                  onClick={() => void onSendTest()}
                  className="btn-primary min-h-0 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send test"}
                </button>
                <button
                  type="button"
                  className="text-[10px] text-brand-muted hover:text-brand-text"
                  onClick={() => {
                    markTested();
                    hide(true);
                  }}
                >
                  Skip
                </button>
              </>
            )}
            {mode !== "verify" && (
              <button
                type="button"
                className="text-[10px] text-brand-muted hover:text-brand-text"
                onClick={() => hide(true)}
              >
                Not now
              </button>
            )}
          </div>
          {status && <p className="mt-1.5 text-[10px] text-brand-accent">{status}</p>}
        </div>
        <button
          type="button"
          className="shrink-0 text-[10px] text-brand-muted hover:text-brand-text"
          onClick={() => {
            if (mode === "verify") markTested();
            hide(true);
          }}
          aria-label="Dismiss push hint"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
