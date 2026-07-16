"use client";

import { useEffect, useState } from "react";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || iosStandalone;
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const criOS = /CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && !criOS;
}

/**
 * Nudge mobile users to install / Add to Home Screen for reliable Web Push.
 * Hidden once running as installed PWA or after dismiss.
 */
export function InstallAppHint({ className = "" }: { className?: string }) {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    try {
      if (isStandaloneDisplay()) return;
      if (window.sessionStorage.getItem("procharacters.installHint.dismissed") === "1") return;
      const narrow = window.matchMedia("(max-width: 768px)").matches;
      if (!narrow && !("BeforeInstallPromptEvent" in window)) {
        // Desktop usually fine in browser; still allow if very useful — skip
        return;
      }
      setIos(isIosSafari());
      setShow(narrow || isIosSafari());
    } catch {
      /* ignore */
    }
  }, []);

  if (!show) return null;

  return (
    <div
      className={`rounded-xl border border-brand-accent/30 bg-brand-accent/5 px-3 py-2.5 text-[11px] leading-relaxed text-brand-muted ${className}`}
      role="note"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
            Install for better push
          </p>
          <p className="mt-1 text-brand-muted">
            {ios ? (
              <>
                Safari → <strong className="text-brand-text">Share</strong> →{" "}
                <strong className="text-brand-text">Add to Home Screen</strong>, then open from the
                icon. Notifications are more reliable that way.
              </>
            ) : (
              <>
                Use your browser menu → <strong className="text-brand-text">Install app</strong> or{" "}
                <strong className="text-brand-text">Add to Home screen</strong>, then open from the
                icon for stabler alerts.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-[10px] text-brand-muted hover:text-brand-text"
          onClick={() => {
            try {
              window.sessionStorage.setItem("procharacters.installHint.dismissed", "1");
            } catch {
              /* ignore */
            }
            setShow(false);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
