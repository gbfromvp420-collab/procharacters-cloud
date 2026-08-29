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
import { OverflowMenu } from "./OverflowMenu";

export type SiteChromeActive = "gallery" | "chat" | "account" | "card" | "studio";

const NAV: Array<{ key: SiteChromeActive | "home"; href: string; label: string; signedIn?: boolean }> = [
  { key: "gallery", href: "/", label: "Gallery" },
  { key: "chat", href: "/chat", label: "Chat" },
  { key: "studio", href: "/models/studio", label: "Studio", signedIn: true },
  { key: "account", href: "/account", label: "Account" },
];

/**
 * Slim product chrome — title + one continue CTA + a short nav.
 * Secondary extras stay in More so the bar never wraps over the page.
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

  const links = NAV.filter((item) => !item.signedIn || !!handle);

  const navLink = (item: (typeof NAV)[number], compact = false) => {
    const isActive = active === item.key;
    return (
      <Link
        key={item.key}
        href={item.href}
        className={`btn-nav ${isActive ? "btn-nav-active" : ""} ${compact ? "px-2" : ""}`}
        aria-current={isActive ? "page" : undefined}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header
      className={`sticky top-0 z-40 border-b border-brand-border/70 bg-brand-bg/92 backdrop-blur-xl ${className}`}
    >
      <div className="mx-auto flex h-[3.25rem] max-w-6xl items-center gap-3 px-3 sm:h-[3.5rem] sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] uppercase tracking-[0.28em] text-brand-accent">Naughty Syntax</p>
          <p className="truncate text-sm font-semibold leading-tight text-brand-text">
            {title}
            {handle ? (
              <span className="ml-1.5 hidden font-normal text-brand-muted sm:inline">
                · @{handle}
              </span>
            ) : null}
          </p>
          {subtitle ? <span className="sr-only">{subtitle}</span> : null}
        </div>

        <div className="hidden min-w-0 items-center gap-1.5 sm:flex">{trailing}</div>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
          {links.map((item) => navLink(item))}
        </nav>

        {continueHref ? (
          <Link
            href={continueHref}
            className={`btn-primary min-h-0 shrink-0 px-3 py-1.5 text-xs sm:px-3.5 sm:text-sm ${
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

        <div className="md:hidden">
          <OverflowMenu
            label="Menu"
            triggerClassName="btn-ghost min-h-0 px-2.5 py-1.5 text-xs"
          >
            {links.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`menu-item ${active === item.key ? "text-brand-accent" : ""}`}
                aria-current={active === item.key ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            {handle ? (
              <Link href="/welcome" className="menu-item">
                Your taste
              </Link>
            ) : null}
            {continueHref ? (
              <Link href={continueHref} className="menu-item text-brand-accent">
                {urgent ? "Reclaim" : "Continue"}
                {nick ? ` · ${nick}` : ""}
              </Link>
            ) : (
              <Link href="/chat" className="menu-item">
                Live chat
              </Link>
            )}
          </OverflowMenu>
        </div>
      </div>
    </header>
  );
}
