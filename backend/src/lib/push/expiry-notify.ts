import type { SessionManager } from "../../services/session-manager.js";
import {
  deletePushByEndpoint,
  listPushSubscriptionsForAccount,
  markExpiryNotified,
} from "./push-store.js";
import { isWebPushConfigured, sendWebPush } from "./web-push-service.js";

const WARN_DAYS = Number(process.env.RESUME_EXPIRY_PUSH_DAYS ?? 3);
const NOTIFY_COOLDOWN_MS = Number(
  process.env.RESUME_EXPIRY_PUSH_COOLDOWN_MS ?? 12 * 60 * 60 * 1000,
);

/**
 * If the account has push subscriptions and any resume codes expire soon,
 * send a Web Push (rate-limited per subscription).
 */
export async function notifyAccountResumeExpiry(
  accountId: string,
  sessionManager: SessionManager,
  options?: { siteBase?: string; force?: boolean },
): Promise<{ sent: number; skipped: number; configured: boolean }> {
  if (!isWebPushConfigured()) {
    return { sent: 0, skipped: 0, configured: false };
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
    return { sent: 0, skipped: 0, configured: true };
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

  return { sent, skipped, configured: true };
}
