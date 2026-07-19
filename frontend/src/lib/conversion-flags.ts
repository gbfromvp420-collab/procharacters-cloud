/**
 * Client flags so conversion surfaces don't double-ask.
 * Session win owns the heat→Day Pass moment; Soft Support yields while it's live.
 */

const SESSION_WIN_ACTIVE = "procharacters.sessionWin.active.v1";
const SOFT_SUPPORT_COOLDOWN = "procharacters.softSupport.cooldownAfterWin.v1";
const PREMIUM_UNLOCK_FLASH = "procharacters.premiumUnlock.flash.v1";

/** Soft Support stays quiet this long after a heat-win Day Pass offer was shown. */
const SOFT_SUPPORT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function setSessionWinActive(active: boolean): void {
  try {
    if (active) {
      window.sessionStorage.setItem(SESSION_WIN_ACTIVE, "1");
    } else {
      window.sessionStorage.removeItem(SESSION_WIN_ACTIVE);
    }
  } catch {
    /* ignore */
  }
}

export function isSessionWinActive(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_WIN_ACTIVE) === "1";
  } catch {
    return false;
  }
}

/** After heat-win offered checkout and user kept chatting — don't stack Soft Support. */
export function markSoftSupportCooldownAfterWin(): void {
  try {
    window.localStorage.setItem(SOFT_SUPPORT_COOLDOWN, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function isSoftSupportInCooldown(): boolean {
  try {
    const raw = window.localStorage.getItem(SOFT_SUPPORT_COOLDOWN);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < SOFT_SUPPORT_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/** Persist just-unlocked payload so Account can show ceremony after confirm. */
export function setPremiumUnlockFlash(payload: {
  plan: string;
  customsLimit: number;
  planExpiresAt?: string | null;
}): void {
  try {
    window.sessionStorage.setItem(
      PREMIUM_UNLOCK_FLASH,
      JSON.stringify({ ...payload, at: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export function consumePremiumUnlockFlash(): {
  plan: string;
  customsLimit: number;
  planExpiresAt?: string | null;
} | null {
  try {
    const raw = window.sessionStorage.getItem(PREMIUM_UNLOCK_FLASH);
    if (!raw) return null;
    window.sessionStorage.removeItem(PREMIUM_UNLOCK_FLASH);
    const parsed = JSON.parse(raw) as {
      plan?: string;
      customsLimit?: number;
      planExpiresAt?: string | null;
      at?: number;
    };
    // Only valid for this browser session return (~30 min safety)
    if (parsed.at && Date.now() - parsed.at > 30 * 60 * 1000) return null;
    if (!parsed.plan || parsed.customsLimit == null) return null;
    return {
      plan: parsed.plan,
      customsLimit: parsed.customsLimit,
      planExpiresAt: parsed.planExpiresAt ?? null,
    };
  } catch {
    return null;
  }
}

export function clearPremiumUnlockFlash(): void {
  try {
    window.sessionStorage.removeItem(PREMIUM_UNLOCK_FLASH);
  } catch {
    /* ignore */
  }
}
