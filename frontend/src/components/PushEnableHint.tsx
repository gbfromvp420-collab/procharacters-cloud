"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enableWebPush,
  isPushSupported,
  registerPushServiceWorker,
} from "@/lib/web-push-client";

const DISMISS_KEY = "procharacters.pushHint.dismissed.v1";

type Props = {
  /** Bearer token — required to subscribe. */
  accountToken: string | null | undefined;
  /** Only nudge when there's something worth protecting. */
  hasResumeCode: boolean;
  /** User turns in this session (assistant replies don't count). */
  userMessageCount: number;
  className?: string;
};

/**
 * In-chat nudge: signed-in users with a live resume code get a one-tap
 * "Enable alerts" so expiry push isn't buried only on Account.
 * Metrics showed pushSubscribe=0 — surface the path where people already are.
 */
export function PushEnableHint({
  accountToken,
  hasResumeCode,
  userMessageCount,
  className = "",
}: Props) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const hide = useCallback((persistDismiss: boolean) => {
    if (persistDismiss) {
      try {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    }
    setShow(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      try {
        if (!accountToken || !hasResumeCode || userMessageCount < 1) {
          setShow(false);
          return;
        }
        if (!isPushSupported()) {
          setShow(false);
          return;
        }
        if (window.localStorage.getItem(DISMISS_KEY)) {
          setShow(false);
          return;
        }
        // Already allowed + subscribed → no nag
        if (Notification.permission === "granted") {
          const reg = await registerPushServiceWorker();
          const sub = await reg?.pushManager.getSubscription();
          if (sub) {
            if (!cancelled) setShow(false);
            return;
          }
        }
        if (Notification.permission === "denied") {
          if (!cancelled) setShow(false);
          return;
        }
        if (!cancelled) setShow(true);
      } catch {
        if (!cancelled) setShow(false);
      }
    }

    void evaluate();
    return () => {
      cancelled = true;
    };
  }, [accountToken, hasResumeCode, userMessageCount]);

  const onEnable = async () => {
    if (!accountToken) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await enableWebPush(accountToken);
      if (result.ok) {
        setStatus("Alerts on — we’ll ping you when this chat code ages.");
        window.setTimeout(() => hide(true), 2200);
      } else {
        setStatus(result.error || "Could not enable push");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className={`rounded-xl border border-brand-accent/30 bg-brand-accent/5 px-3 py-2.5 text-[11px] leading-relaxed text-brand-muted ${className}`}
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
            Don’t lose this chat
          </p>
          <p className="mt-1 text-brand-muted">
            Enable alerts so we can warn you when your resume code is about to expire — even with
            the tab closed.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !accountToken}
              onClick={() => void onEnable()}
              className="btn-primary min-h-0 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {busy ? "Enabling…" : "Enable alerts"}
            </button>
            <button
              type="button"
              className="text-[10px] text-brand-muted hover:text-brand-text"
              onClick={() => hide(true)}
            >
              Not now
            </button>
          </div>
          {status && <p className="mt-1.5 text-[10px] text-brand-accent">{status}</p>}
        </div>
        <button
          type="button"
          className="shrink-0 text-[10px] text-brand-muted hover:text-brand-text"
          onClick={() => hide(true)}
          aria-label="Dismiss push hint"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
