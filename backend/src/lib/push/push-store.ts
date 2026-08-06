import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { repoPath } from "../paths.js";

export type PushSubscriptionRecord = {
  accountId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  createdAt: string;
  /** Last time we sent an expiry warning to this subscription */
  lastExpiryNotifyAt?: string;
};

type PushFile = {
  version: 1;
  subscriptions: PushSubscriptionRecord[];
};

const byEndpoint = new Map<string, PushSubscriptionRecord>();
let filePath = "";
let loaded = false;

function resolvePath(): string {
  if (process.env.PUSH_SUBSCRIPTIONS_PATH?.trim()) {
    return process.env.PUSH_SUBSCRIPTIONS_PATH.trim();
  }
  if (process.env.ACCOUNTS_PATH?.startsWith("/data")) {
    return "/data/push-subscriptions.json";
  }
  return repoPath("data", "push-subscriptions.json");
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  filePath = resolvePath();
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as PushFile;
    byEndpoint.clear();
    for (const s of parsed.subscriptions ?? []) {
      if (s.endpoint && s.accountId && s.keys?.p256dh && s.keys?.auth) {
        byEndpoint.set(s.endpoint, s);
      }
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      console.error("[push-store] load failed:", error);
    }
  }
  loaded = true;
}

async function persist(): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const body: PushFile = {
    version: 1,
    subscriptions: [...byEndpoint.values()],
  };
  await writeFile(filePath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

export async function initPushStore(path?: string): Promise<{ path: string; count: number }> {
  if (path?.trim()) process.env.PUSH_SUBSCRIPTIONS_PATH = path.trim();
  loaded = false;
  await ensureLoaded();
  return { path: filePath, count: byEndpoint.size };
}

export async function savePushSubscription(options: {
  accountId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}): Promise<PushSubscriptionRecord> {
  await ensureLoaded();
  const record: PushSubscriptionRecord = {
    accountId: options.accountId,
    endpoint: options.endpoint,
    keys: options.keys,
    userAgent: options.userAgent,
    createdAt: byEndpoint.get(options.endpoint)?.createdAt ?? new Date().toISOString(),
    lastExpiryNotifyAt: byEndpoint.get(options.endpoint)?.lastExpiryNotifyAt,
  };
  byEndpoint.set(options.endpoint, record);
  await persist();
  return record;
}

export async function removePushSubscription(
  accountId: string,
  endpoint: string,
): Promise<boolean> {
  await ensureLoaded();
  const existing = byEndpoint.get(endpoint);
  if (!existing || existing.accountId !== accountId) return false;
  byEndpoint.delete(endpoint);
  await persist();
  return true;
}

export async function listPushSubscriptionsForAccount(
  accountId: string,
): Promise<PushSubscriptionRecord[]> {
  await ensureLoaded();
  return [...byEndpoint.values()].filter((s) => s.accountId === accountId);
}

/** All subscriptions (for background expiry scan). */
export async function listAllPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  await ensureLoaded();
  return [...byEndpoint.values()];
}

/** Unique account IDs that have at least one push subscription. */
export async function listPushAccountIds(): Promise<string[]> {
  await ensureLoaded();
  return [...new Set([...byEndpoint.values()].map((s) => s.accountId))];
}

export async function markExpiryNotified(endpoint: string): Promise<void> {
  await ensureLoaded();
  const existing = byEndpoint.get(endpoint);
  if (!existing) return;
  byEndpoint.set(endpoint, {
    ...existing,
    lastExpiryNotifyAt: new Date().toISOString(),
  });
  await persist();
}

export async function deletePushByEndpoint(endpoint: string): Promise<void> {
  await ensureLoaded();
  if (byEndpoint.delete(endpoint)) await persist();
}

export function getPushStorePath(): string {
  return filePath || resolvePath();
}
