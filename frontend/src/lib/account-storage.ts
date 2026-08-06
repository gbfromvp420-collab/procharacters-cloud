const STORAGE_KEY = "procharacters.account.v1";
/** One-shot banner after forced sign-out (sessionStorage so it clears with the tab). */
const NOTICE_KEY = "procharacters.account.notice.v1";

export const DEFAULT_REAUTH_NOTICE =
  "We upgraded sign-in — please sign in again to sync chats across devices.";

export interface StoredAccount {
  accountId: string;
  handle: string;
  token: string;
  expiresAt: string;
  savedAt: string;
}

export function loadStoredAccount(): StoredAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAccount;
    if (!parsed.accountId || !parsed.token || !parsed.handle) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      invalidateStoredAccount("Your session expired — sign in again.");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredAccount(account: StoredAccount): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    window.sessionStorage.removeItem(NOTICE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearStoredAccount(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Clear local auth and optionally queue a one-shot re-login banner. */
export function invalidateStoredAccount(reason: string = DEFAULT_REAUTH_NOTICE): void {
  clearStoredAccount();
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(NOTICE_KEY, reason);
  } catch {
    /* ignore */
  }
}

/** Read and clear the re-login banner message (if any). */
export function consumeAccountNotice(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const msg = window.sessionStorage.getItem(NOTICE_KEY);
    if (msg) window.sessionStorage.removeItem(NOTICE_KEY);
    return msg;
  } catch {
    return null;
  }
}

export function peekAccountNotice(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(NOTICE_KEY);
  } catch {
    return null;
  }
}
