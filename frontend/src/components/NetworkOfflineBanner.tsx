"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buildResumeChatPath,
  getMostRecentResume,
  isDnaPowerTrail,
  isResumeExpiryUrgent,
  listResumeCacheEntries,
} from "@/lib/resume-cache";

/**
 * Soft offline strip — drafts still save locally; rejoin when the wire’s back.
 * Surfaces last resume so Continue is one tap after reconnect.
 */
export function NetworkOfflineBanner({ className = "" }: { className?: string }) {
  const [offline, setOffline] = useState(false);
  const [resumeCount, setResumeCount] = useState(0);
  const [continueHref, setContinueHref] = useState<string | null>(null);
  const [continueNick, setContinueNick] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [dnaPower, setDnaPower] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      setOffline(!navigator.onLine);
      const entries = listResumeCacheEntries();
      setResumeCount(entries.length);
      const top = getMostRecentResume();
      if (top?.resumeCode) {
        setContinueHref(buildResumeChatPath(top));
        setContinueNick(
          top.characterName?.trim().split(/\s+/)[0] || top.characterId || "chat",
        );
        setUrgent(isResumeExpiryUrgent(top.resumeExpiresAt));
        setDnaPower(isDnaPowerTrail(top));
      } else {
        setContinueHref(null);
        setContinueNick(null);
        setUrgent(false);
        setDnaPower(false);
      }
    };
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
        Live chat needs a connection. Drafts still auto-save on this device
        {resumeCount > 0
          ? ` · ${resumeCount} resume${resumeCount === 1 ? "" : "s"} cached`
          : ""}
        . When you’re back online, Continue picks up the heat.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {continueHref && (
          <Link
            href={continueHref}
            className={`btn-ghost min-h-0 px-3 py-1.5 text-xs ${
              dnaPower
                ? "border-violet-400/45 text-violet-100"
                : "border-amber-400/40 text-amber-100"
            } ${urgent ? "ring-1 ring-rose-400/50" : ""}`}
          >
            {urgent ? "Reclaim" : dnaPower ? "DNA power" : "Continue"}
            {continueNick ? ` · ${continueNick}` : ""}
          </Link>
        )}
        <Link
          href="/offline.html"
          className="btn-ghost min-h-0 px-3 py-1.5 text-xs text-sky-100/90"
        >
          Offline shell
        </Link>
      </div>
    </div>
  );
}
