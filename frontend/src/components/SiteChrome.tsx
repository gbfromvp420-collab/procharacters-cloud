"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadStoredAccount } from "@/lib/account-storage";
import {
  buildResumeChatPath,
  getMostRecentResume,
  isDnaPowerTrail,
  isResumeExpiryUrgent,
  type ResumeCacheEntry,
} from "@/lib/resume-cache";

export type SiteChromeActive = "gallery" | "chat" | "account" | "card" | "studio";

/**
 * Sticky product chrome — same return path on every surface.
 * Continue when a resume exists; My models when signed in.
 */
export function SiteChrome({
  active,
  title,
  subtitle,
  className = "",
  /** Extra controls on the right (chat copy-notice, etc.) */
  trailing,
}: {
  active: SiteChromeActive;
  title: string;
  subtitle?: string | null;
  className?: string;
  trailing?: ReactNode;
}) {
  const [handle, setHandle] = useState<string | null>(null);
  const [resume, setResume] = useState<ResumeCacheEntry | null>(null);

  useEffect(() => {
    const account = loadStoredAccount();
    setHandle(account?.handle ?? null);
    setResume(getMostRecentResume());
  }, [active]);

  // Re-check resume when tab regains focus (other tab may have chatted)
  useEffect(() => {
    const onFocus = () => setResume(getMostRecentResume());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const continueHref = useMemo(() => {
    if (!resume?.resumeCode) return null;
    return buildResumeChatPath(resume);
  }, [resume]);

  const urgent = isResumeExpiryUrgent(resume?.resumeExpiresAt);
  const dnaPower = resume ? isDnaPowerTrail(resume) : false;
  const nick =
    resume?.characterName?.trim().split(/\s+/)[0] || resume?.characterId?.split("-")[0] || null;

  const linkClass = (key: SiteChromeActive) =>
    `btn-ghost min-h-0 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm ${
      active === key ? "border-brand-accent/60 text-brand-accent" : ""
    }`;

  return (
    <div
      className={`sticky top-0 z-40 border-b border-brand-border/70 bg-brand-bg/90 backdrop-blur-xl ${className}`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-brand-accent">Naughty Syntax</p>
          <p className="truncate text-sm font-semibold text-brand-text sm:text-base">
            {title}
            {handle ? (
              <span className="ml-2 text-xs font-normal text-brand-muted">· @{handle}</span>
            ) : null}
          </p>
          {subtitle ? (
            <p className="mt-0.5 hidden truncate text-[10px] text-brand-muted sm:block">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {trailing}
          <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2" aria-label="Primary">
            <Link
              href="/"
              className={linkClass("gallery")}
              aria-current={active === "gallery" ? "page" : undefined}
            >
              Gallery
            </Link>
            <Link
              href="/chat"
              className={linkClass("chat")}
              aria-current={active === "chat" ? "page" : undefined}
            >
              Chat
            </Link>
            {handle ? (
              <>
                <Link
                  href="/models/studio"
                  className={`btn-ghost min-h-0 border-violet-400/35 px-2.5 py-1.5 text-xs text-violet-100 sm:px-3 sm:text-sm ${
                    active === "studio" ? "border-violet-300/70 text-violet-50" : ""
                  }`}
                  title="My Models Studio — create & edit"
                  aria-current={active === "studio" ? "page" : undefined}
                >
                  Studio
                </Link>
                <Link
                  href="/account#my-models"
                  className="btn-ghost min-h-0 border-violet-400/35 px-2.5 py-1.5 text-xs text-violet-100 sm:px-3 sm:text-sm"
                  title="Private My Characters hub"
                >
                  Models
                </Link>
              </>
            ) : null}
            <Link
              href="/account"
              className={linkClass("account")}
              aria-current={active === "account" ? "page" : undefined}
            >
              Account
            </Link>
            {continueHref ? (
              <Link
                href={continueHref}
                className={`btn-primary min-h-0 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm ${
                  urgent
                    ? "ring-2 ring-rose-400/55 animate-pulse"
                    : dnaPower
                      ? "ring-1 ring-violet-400/55"
                      : ""
                }`}
                title={
                  urgent
                    ? "Resume expiring soon — reclaim"
                    : dnaPower
                      ? "DNA power reclaim · Edge Pace + heat"
                      : "Continue last chat"
                }
              >
                {urgent ? "Reclaim" : dnaPower ? "DNA power" : "Continue"}
                {nick ? ` · ${nick}` : ""}
              </Link>
            ) : active !== "chat" ? (
              <Link
                href="/chat"
                className="btn-primary min-h-0 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm"
              >
                Live chat
              </Link>
            ) : null}
          </nav>
        </div>
      </div>
    </div>
  );
}
