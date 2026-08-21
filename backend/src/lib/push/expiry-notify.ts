import type { SessionManager } from "../../services/session-manager.js";
import { bump, recordExpiryCronTick } from "../observability/metrics.js";
import {
  deletePushByEndpoint,
  listPushAccountIds,
  listPushSubscriptionsForAccount,
  markExpiryNotified,
} from "./push-store.js";
import { isWebPushConfigured, sendWebPush } from "./web-push-service.js";

const WARN_DAYS = Number(process.env.RESUME_EXPIRY_PUSH_DAYS ?? 3);
const NOTIFY_COOLDOWN_MS = Number(
  process.env.RESUME_EXPIRY_PUSH_COOLDOWN_MS ?? 12 * 60 * 60 * 1000,
);
/** Background scan interval; 0 disables cron. Default 1 hour. */
const CRON_MS = Number(process.env.RESUME_EXPIRY_PUSH_CRON_MS ?? 60 * 60 * 1000);

type AccountSessionRow = Awaited<ReturnType<SessionManager["listAccountSessions"]>>[number];

/**
 * DNA power trail — mid climb or Edge Pace heat.
 * Mirrors frontend isDnaPowerTrail so push deep-links reclaim Edge Pace.
 */
export function isDnaPowerSession(
  s: Pick<AccountSessionRow, "dnaTreeNodeId" | "sessionMode" | "messageCount">,
): boolean {
  if (s.sessionMode === "edge_pace") return true;
  const node = (s.dnaTreeNodeId || "").toLowerCase();
  if (/edge|deny|release|gate|tease/.test(node)) return true;
  // Engaged DNA forge with a stamped node — still reclaim climb energy
  if (s.dnaTreeNodeId && (s.messageCount ?? 0) >= 4) return true;
  return false;
}

/** Pretty DNA node label for push copy. */
export function dnaNodeLabel(nodeId?: string): string | null {
  if (!nodeId?.trim()) return null;
  const id = nodeId.trim().toLowerCase();
  if (id.includes("release")) return "Release";
  if (id.includes("deny")) return "Deny";
  if (id.includes("edge")) return "Edge";
  if (id.includes("tease")) return "Tease";
  if (id.includes("soft")) return "Soft lock";
  if (id.includes("spark")) return "Spark";
  return nodeId.trim();
}

/**
 * If the account has push subscriptions and any resume codes expire soon,
 * send a Web Push (rate-limited per subscription).
 * DNA power trails deep-link with mode=edge_pace + rehydrate (no cold Continue).
 */
export async function notifyAccountResumeExpiry(
  accountId: string,
  sessionManager: SessionManager,
  options?: { siteBase?: string; force?: boolean },
): Promise<{
  sent: number;
  skipped: number;
  configured: boolean;
  expiring: number;
  dnaPower?: boolean;
}> {
  if (!isWebPushConfigured()) {
    return { sent: 0, skipped: 0, configured: false, expiring: 0 };
  }

  const sessions = await sessionManager.listAccountSessions(accountId);
  const now = Date.now();
  const horizon = WARN_DAYS * 24 * 60 * 60 * 1000;
  const soon = sessions.filter((s) => {
    if (!s.resumeCode || !s.resumeExpiresAt) return false;
    const exp = Date.parse(s.resumeExpiresAt);
    if (Number.isNaN(exp)) return false;
    const left = exp - now;
    return left >= 0 && left <= horizon;
  });

  if (soon.length === 0) {
    return { sent: 0, skipped: 0, configured: true, expiring: 0 };
  }

  const siteBase = (
    options?.siteBase ||
    process.env.MAGIC_LINK_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://procharacters-web-production-7288.up.railway.app"
  ).replace(/\/$/, "");

  // Prefer DNA-hot sessions, then soonest-to-expire — reclaim > bare continue
  const soonSorted = [...soon].sort((a, b) => {
    const da = isDnaPowerSession(a) ? 0 : 1;
    const db = isDnaPowerSession(b) ? 0 : 1;
    if (da !== db) return da - db;
    const ea = Date.parse(a.resumeExpiresAt || "") || Number.POSITIVE_INFINITY;
    const eb = Date.parse(b.resumeExpiresAt || "") || Number.POSITIVE_INFINITY;
    return ea - eb;
  });
  const primary = soonSorted[0];
  const names = soonSorted
    .slice(0, 3)
    .map((s) => s.characterName)
    .join(", ");
  const more = soonSorted.length > 3 ? ` +${soonSorted.length - 3} more` : "";

  const dnaPower = primary ? isDnaPowerSession(primary) : false;
  const nodeLabel = primary ? dnaNodeLabel(primary.dnaTreeNodeId) : null;

  // Prefer last-chat deep link so one tap continues the sticky loop
  let deepUrl = `${siteBase}/account`;
  if (primary?.resumeCode) {
    const q = new URLSearchParams({
      resume: primary.resumeCode.toUpperCase(),
      rehydrate: "1",
    });
    if (primary.characterId) q.set("character", primary.characterId);
    if (dnaPower) q.set("mode", "edge_pace");
    deepUrl = `${siteBase}/chat?${q.toString()}`;
  }

  const primaryName = primary?.characterName?.trim();
  let title = "Procharacters — continue before codes expire";
  let body: string;
  if (dnaPower && soonSorted.length === 1 && primaryName) {
    title = nodeLabel ? `DNA power · ${nodeLabel} reclaim` : "DNA power · Edge reclaim";
    body = nodeLabel
      ? `${primaryName} is still on DNA · ${nodeLabel}. Tap to reclaim Edge Pace before the code expires.`
      : `${primaryName} held your Edge Pace heat. Tap to reclaim before the code expires.`;
  } else if (dnaPower && primaryName) {
    title = "DNA power waiting — codes expire soon";
    body = `${primaryName}${more ? more : ""} — DNA climb still hot. Tap to reclaim Edge Pace (${soonSorted.length} code${soonSorted.length === 1 ? "" : "s"}).`;
  } else if (soonSorted.length === 1 && primaryName) {
    body = `Resume with ${primaryName} before the code expires (within ${WARN_DAYS} days). Tap to continue.`;
  } else {
    body = `${soonSorted.length} code(s) expire within ${WARN_DAYS} days: ${names}${more}. Tap to jump back in.`;
  }

  const payload = {
    title,
    body,
    url: deepUrl,
    tag: "procharacters-resume-expiry",
  };

  const subs = await listPushSubscriptionsForAccount(accountId);
  let sent = 0;
  let skipped = 0;

  for (const sub of subs) {
    if (!options?.force && sub.lastExpiryNotifyAt) {
      const last = Date.parse(sub.lastExpiryNotifyAt);
      if (!Number.isNaN(last) && now - last < NOTIFY_COOLDOWN_MS) {
        skipped += 1;
        continue;
      }
    }
    const result = await sendWebPush({ endpoint: sub.endpoint, keys: sub.keys }, payload);
    if (result.gone) {
      await deletePushByEndpoint(sub.endpoint);
      continue;
    }
    if (result.ok) {
      await markExpiryNotified(sub.endpoint);
      sent += 1;
    } else {
      skipped += 1;
    }
  }

  if (sent > 0 && dnaPower) {
    bump("pushDnaPowerReclaims", sent);
  }

  return {
    sent,
    skipped,
    configured: true,
    expiring: soon.length,
    ...(dnaPower ? { dnaPower: true } : {}),
  };
}

/**
 * Scan every account that has push subscriptions and notify if needed.
 * Used by the background cron — not only when the user opens Account.
 */
export async function notifyAllSubscribedAccounts(
  sessionManager: SessionManager,
  options?: { siteBase?: string },
): Promise<{ accounts: number; sent: number; skipped: number }> {
  if (!isWebPushConfigured()) {
    return { accounts: 0, sent: 0, skipped: 0 };
  }
  const accountIds = await listPushAccountIds();
  let sent = 0;
  let skipped = 0;
  for (const accountId of accountIds) {
    const result = await notifyAccountResumeExpiry(accountId, sessionManager, {
      siteBase: options?.siteBase,
    });
    sent += result.sent;
    skipped += result.skipped;
  }
  return { accounts: accountIds.length, sent, skipped };
}

let cronTimer: ReturnType<typeof setInterval> | null = null;

/** Start periodic expiry push scan. Safe to call once at boot. */
export function startResumeExpiryPushCron(
  sessionManager: SessionManager,
  log?: { info: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void },
): void {
  if (cronTimer) return;
  if (!isWebPushConfigured()) {
    log?.info({}, "Resume expiry push cron skipped (VAPID not configured)");
    return;
  }
  if (!Number.isFinite(CRON_MS) || CRON_MS <= 0) {
    log?.info({ CRON_MS }, "Resume expiry push cron disabled (RESUME_EXPIRY_PUSH_CRON_MS<=0)");
    return;
  }

  const siteBase = process.env.MAGIC_LINK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || undefined;

  const tick = () => {
    void notifyAllSubscribedAccounts(sessionManager, { siteBase })
      .then((summary) => {
        recordExpiryCronTick(summary);
        if (summary.sent > 0 || summary.accounts > 0) {
          log?.info(summary, "Resume expiry push cron tick");
        }
      })
      .catch((error) => {
        log?.warn({ error }, "Resume expiry push cron failed");
      });
  };

  // First run after a short delay so boot isn't blocked
  setTimeout(tick, Math.min(30_000, CRON_MS));
  cronTimer = setInterval(tick, CRON_MS);
  if (typeof cronTimer.unref === "function") cronTimer.unref();
  log?.info({ intervalMs: CRON_MS, warnDays: WARN_DAYS }, "Resume expiry push cron started");
}
