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
 * Single-row product chrome — brand, page title, four destinations, one CTA.
 */
export function SiteChrome({
  active,
  title,
  subtitle,
  className = "",
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
    `btn-nav ${active === key ? "btn-nav-active" : ""}`;

  return (
    <header
      className={`sticky top-0 z-40 border-b border-brand-border/60 bg-brand-bg/92 backdrop-blur-xl ${className}`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-brand-accent">
            Naughty Syntax
          </p>
          <p className="truncate text-[13px] font-semibold leading-tight text-brand-text sm:text-sm">
            {title}
            {handle ? (
              <span className="ml-1.5 text-[11px] font-normal text-brand-muted">
                · @{handle}
              </span>
            ) : null}
          </p>
          {subtitle ? <span className="sr-only">{subtitle}</span> : null}
        </div>

        {trailing ? (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">{trailing}</div>
        ) : null}

        <nav
          className="flex shrink-0 items-center gap-0.5 sm:gap-1"
          aria-label="Primary"
        >
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
            <Link
              href="/models/studio"
              className={`btn-nav ${active === "studio" ? "btn-nav-active text-violet-100" : ""}`}
              title="Studio Forge"
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
        </nav>

        {continueHref ? (
          <Link
            href={continueHref}
            className={`btn-primary min-h-0 shrink-0 px-3 py-1.5 text-xs ${
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
            {urgent ? "Reclaim" : dnaPower ? "DNA" : "Continue"}
            {nick ? ` · ${nick}` : ""}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
