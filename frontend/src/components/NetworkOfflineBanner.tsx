"use client";

import { useEffect, useState } from "react";

/**
 * Soft offline strip — drafts still save locally; rejoin when the wire’s back.
 */
export function NetworkOfflineBanner({ className = "" }: { className?: string }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className={`animate-rise-in rounded-xl border border-sky-400/40 bg-sky-500/10 px-3 py-2.5 text-[11px] leading-relaxed ${className}`}
      role="status"
      aria-live="assertive"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/90">
        You’re offline
      </p>
      <p className="mt-1 text-brand-muted">
        Live chat needs a connection. Drafts still auto-save on this device — when you’re back
        online, Continue or Rejoin picks up the heat.
      </p>
    </div>
  );
}
