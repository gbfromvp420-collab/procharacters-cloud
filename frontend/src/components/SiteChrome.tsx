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
 * Sticky product chrome — one row, no wrap, one primary return CTA.
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
    resume?.characterName?.trim().split(/\s+/)[0] ||
    resume?.characterId?.split("-")[0] ||
    null;

  const linkClass = (key: SiteChromeActive) =>
    `inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-brand-muted transition hover:text-brand-text sm:px-3 sm:text-sm ${
      active === key ? "bg-brand-panel text-brand-text" : ""
    }`;

  return (
    <div
      className={`sticky top-0 z-40 border-b border-brand-border/70 bg-brand-bg/90 backdrop-blur-xl ${className}`}
    >
      <div className="mx-auto flex min-h-[3.25rem] max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.28em] text-brand-accent">Naughty Syntax</p>
          <p className="truncate text-sm font-semibold leading-tight text-brand-text">
            {title}
            {handle ? (
              <span className="ml-1.5 hidden font-normal text-brand-muted sm:inline">
                · @{handle}
              </span>
            ) : null}
          </p>
          {subtitle ? (
            <p className="mt-0 hidden truncate text-[10px] text-brand-muted lg:block">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {trailing ? <div className="hidden items-center gap-1.5 md:flex">{trailing}</div> : null}
          <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Primary">
            <Link href="/" className={linkClass("gallery")} aria-current={active === "gallery" ? "page" : undefined}>
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
              <Link
                href="/models/studio"
                className={`hidden sm:inline-flex ${linkClass("studio")} ${
                  active === "studio" ? "text-violet-100" : ""
                }`}
                title="Studio Forge — create & edit"
                aria-current={active === "studio" ? "page" : undefined}
              >
                Studio
              </Link>
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
                className={`btn-primary ml-0.5 h-8 min-h-0 px-2.5 py-0 text-xs sm:px-3 ${
                  urgent
                    ? "ring-2 ring-rose-400/55"
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
                {urgent ? "Reclaim" : "Continue"}
                {nick ? (
                  <span className="hidden sm:inline">{` · ${nick}`}</span>
                ) : null}
              </Link>
            ) : null}
          </nav>
        </div>
      </div>
    </div>
  );
}
