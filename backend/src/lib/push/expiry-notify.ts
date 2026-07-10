import type { SessionManager } from "../../services/session-manager.js";
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

/**
 * If the account has push subscriptions and any resume codes expire soon,
 * send a Web Push (rate-limited per subscription).
 */
export async function notifyAccountResumeExpiry(
  accountId: string,
  sessionManager: SessionManager,
  options?: { siteBase?: string; force?: boolean },
): Promise<{ sent: number; skipped: number; configured: boolean; expiring: number }> {
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

  const names = soon
    .slice(0, 3)
    .map((s) => s.characterName)
    .join(", ");
  const more = soon.length > 3 ? ` +${soon.length - 3} more` : "";
  const payload = {
    title: "Procharacters resume codes expiring",
    body: `${soon.length} code(s) expire within ${WARN_DAYS} days: ${names}${more}`,
    url: `${siteBase}/account`,
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
    const result = await sendWebPush(
      { endpoint: sub.endpoint, keys: sub.keys },
      payload,
    );
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

  return { sent, skipped, configured: true, expiring: soon.length };
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

  const siteBase =
    process.env.MAGIC_LINK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || undefined;

  const tick = () => {
    void notifyAllSubscribedAccounts(sessionManager, { siteBase })
      .then((summary) => {
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
