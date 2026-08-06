"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

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
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const criOS = /CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && !criOS;
}

/**
 * Nudge mobile users to install / Add to Home Screen for reliable Web Push.
 * On Chromium Android, uses beforeinstallprompt for a one-tap Install button.
 */
export function InstallAppHint({ className = "" }: { className?: string }) {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    try {
      if (isStandaloneDisplay()) return;
      if (window.sessionStorage.getItem("procharacters.installHint.dismissed") === "1") return;

      const iosSafari = isIosSafari();
      setIos(iosSafari);
      const narrow = window.matchMedia("(max-width: 768px)").matches;

      const onBip = (e: Event) => {
        e.preventDefault();
        setDeferred(e as BeforeInstallPromptEvent);
        setShow(true);
      };
      window.addEventListener("beforeinstallprompt", onBip);

      if (narrow || iosSafari) {
        setShow(true);
      }

      return () => window.removeEventListener("beforeinstallprompt", onBip);
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = () => {
    try {
      window.sessionStorage.setItem("procharacters.installHint.dismissed", "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const onInstall = async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setDeferred(null);
        setShow(false);
      }
    } catch {
      /* user closed prompt */
    } finally {
      setInstalling(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className={`rounded-xl border border-brand-accent/30 bg-brand-accent/5 px-3 py-2.5 text-[11px] leading-relaxed text-brand-muted ${className}`}
      role="note"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
            Home screen · keep the heat
          </p>
          <p className="mt-1 text-brand-muted">
            {ios ? (
              <>
                Safari → <strong className="text-brand-text">Share</strong> →{" "}
                <strong className="text-brand-text">Add to Home Screen</strong>. Open from the icon
                so Continue + push feel like a real app — free path stays free.
              </>
            ) : deferred ? (
              <>
                One tap install — faster return to your chats and stabler alerts when the tab is
                closed. Core chat never paywalls.
              </>
            ) : (
              <>
                Browser menu → <strong className="text-brand-text">Install app</strong> or{" "}
                <strong className="text-brand-text">Add to Home screen</strong>. One icon back to
                Continue + your minds.
              </>
            )}
          </p>
          {deferred && !ios && (
            <button
              type="button"
              disabled={installing}
              onClick={() => void onInstall()}
              className="btn-primary mt-2 min-h-0 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {installing ? "Opening…" : "Install app"}
            </button>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 text-[10px] text-brand-muted hover:text-brand-text"
          onClick={dismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
