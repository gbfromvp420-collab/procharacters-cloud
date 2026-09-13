/** Parse /health brain fields without leaking vendor/billing detail to strangers. */

export type LlmFailureReason =
  | "credits_or_spending_limit"
  | "auth"
  | "rate_limited"
  | "timeout"
  | "refusal"
  | "empty_response"
  | "network"
  | "upstream_error";

export type HealthLlm = {
  ok?: boolean;
  configured?: boolean;
  lastFailureReason?: LlmFailureReason | null;
  consecutiveFailures?: number;
};

export type ProductHealth = {
  status?: string;
  product?: "ok" | "degraded" | string;
  llm?: HealthLlm;
};

export function isChatBrainUp(health: ProductHealth | null | undefined): boolean {
  if (!health) return true;
  if (health.product === "degraded") return false;
  if (health.llm && health.llm.configured === false) return false;
  if (health.llm && health.llm.ok === false) return false;
  return true;
}

/** Ops-facing chip copy. Never includes console.x.ai or key material. */
export function brainChipLabel(health: ProductHealth | null | undefined): {
  label: string;
  ok: boolean | "warn" | "info";
  title: string;
} {
  const llm = health?.llm;
  if (!llm) {
    return { label: "Chat brain ?", ok: "info", title: "No llm block on /health yet" };
  }
  if (llm.configured === false) {
    return {
      label: "Chat brain off",
      ok: "warn",
      title: "Live chat key is not configured — stub replies only",
    };
  }
  if (llm.ok === false) {
    const reason = llm.lastFailureReason ? ` · ${llm.lastFailureReason}` : "";
    return {
      label: "Chat brain down",
      ok: "warn",
      title: `Chat is failing${reason}. Top up / check the provider console (human ops).`,
    };
  }
  return {
    label: "Chat brain up",
    ok: true,
    title: "Last brain call succeeded",
  };
}

/** Stranger-facing outage copy. No vendor, credits, or console instructions. */
export function chatOutageCopy(health: ProductHealth | null | undefined): {
  title: string;
  body: string;
} | null {
  if (isChatBrainUp(health)) return null;
  if (health?.llm?.configured === false) {
    return {
      title: "Live chat is warming up",
      body: "Replies are not live on this server yet. You can still browse. Try chat again in a moment.",
    };
  }
  return {
    title: "Chat is taking a breather",
    body: "The models are temporarily unavailable. Nothing you typed was lost — send it again in a moment.",
  };
}
