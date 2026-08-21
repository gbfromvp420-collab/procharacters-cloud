/**
 * Web Push (VAPID) helpers for resume-code expiry alerts.
 * Disabled when VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are unset.
 */
import webpush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export function isWebPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

let configured = false;

function ensureConfigured(): boolean {
  if (!isWebPushConfigured()) return false;
  if (!configured) {
    const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:ops@procharacters.cloud";
    webpush.setVapidDetails(
      subject,
      process.env.VAPID_PUBLIC_KEY!.trim(),
      process.env.VAPID_PRIVATE_KEY!.trim(),
    );
    configured = true;
  }
  return true;
}

export async function sendWebPush(
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  payload: PushPayload,
): Promise<{ ok: boolean; gone?: boolean; error?: string }> {
  if (!ensureConfigured()) {
    return { ok: false, error: "Web Push not configured" };
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 },
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode: number }).statusCode)
        : 0;
    // 404 / 410 = subscription expired or unsubscribed
    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, gone: true, error: `HTTP ${statusCode}` };
    }
    const message = error instanceof Error ? error.message : "push failed";
    return { ok: false, error: message };
  }
}
