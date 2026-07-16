"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStoredAccount } from "@/lib/account-storage";
import { loadStoredSession } from "@/lib/session-storage";
import {
  enableWebPush,
  isPushSupported,
  registerPushServiceWorker,
} from "@/lib/web-push-client";

const DISMISS_KEY = "procharacters.pushHint.dismissed.v1";
const RESUME_CACHE_KEY = "procharacters.resumeByCharacter.v1";

type Props = {
  /**
   * Optional overrides (e.g. live ChatApp session). When omitted, reads
   * account + resume from localStorage so we can mount from chat/page.tsx
   * without editing the large ChatApp module.
   */
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

/**
 * In-chat / page-level nudge: signed-in users with a resume code get one-tap
 * "Enable alerts" so expiry push isn't buried only on Account.
 * Metrics showed pushSubscribe=0 — surface the path where people already are.
 */
export function PushEnableHint({
  accountToken: accountTokenProp,
  hasResumeCode: hasResumeCodeProp,
  className = "",
}: Props) {
  const [show, setShow] = useState(false);
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
    setShow(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function evaluate() {
      try {
        if (window.localStorage.getItem(DISMISS_KEY)) {
          if (!cancelled) setShow(false);
          return;
        }
        if (!isPushSupported()) {
          if (!cancelled) setShow(false);
          return;
        }

        const account = loadStoredAccount();
        const resolvedToken = accountTokenProp ?? account?.token ?? null;
        const hasResume =
          hasResumeCodeProp !== undefined ? hasResumeCodeProp : hasAnyResumeCode();

        if (!cancelled) setToken(resolvedToken);

        if (!resolvedToken || !hasResume) {
          if (!cancelled) setShow(false);
          return;
        }

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
    // Poll lightly — resume/account land after first chat save
    timer = window.setInterval(() => void evaluate(), 4000);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [accountTokenProp, hasResumeCodeProp]);

  const onEnable = async () => {
    const t = token ?? accountTokenProp ?? loadStoredAccount()?.token;
    if (!t) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await enableWebPush(t);
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
              disabled={busy || !(token ?? accountTokenProp)}
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
