/**
 * Shared DNA / Continue reclaim payload for expiry push + Send test.
 * One tap should reopen heat — never dump a hot trail on /account.
 */

export type ReclaimSessionLike = {
  characterId?: string;
  characterName?: string;
  resumeCode?: string;
  resumeExpiresAt?: string;
  updatedAt?: string;
  sessionMode?: string;
  dnaTreeNodeId?: string;
  messageCount?: number;
};

export type ReclaimPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  dnaPower: boolean;
  characterName?: string;
  characterId?: string;
};

/**
 * DNA power trail — mid climb or Edge Pace heat.
 * Mirrors frontend isDnaPowerTrail so push deep-links reclaim Edge Pace.
 */
export function isDnaPowerSession(
  s: Pick<ReclaimSessionLike, "dnaTreeNodeId" | "sessionMode" | "messageCount">,
): boolean {
  if (s.sessionMode === "edge_pace") return true;
  const node = (s.dnaTreeNodeId || "").toLowerCase();
  if (/edge|deny|release|gate|tease/.test(node)) return true;
  if (s.dnaTreeNodeId && (s.messageCount ?? 0) >= 4) return true;
  return false;
}

/** Pretty DNA node label for push copy. */
export function dnaNodeLabel(nodeId?: string | null): string | null {
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

export function buildReclaimChatUrl(
  siteBase: string,
  session: Pick<ReclaimSessionLike, "resumeCode" | "characterId">,
  dnaPower: boolean,
): string {
  const base = siteBase.replace(/\/$/, "");
  const code = session.resumeCode?.trim();
  if (!code) return `${base}/account`;
  const q = new URLSearchParams({
    resume: code.toUpperCase(),
    rehydrate: "1",
  });
  if (session.characterId) q.set("character", session.characterId);
  if (dnaPower) q.set("mode", "edge_pace");
  return `${base}/chat?${q.toString()}`;
}

/** Prefer DNA-hot, then newest resume — same priority as a real expiry ping. */
export function pickTestReclaimSession(
  sessions: ReclaimSessionLike[],
): ReclaimSessionLike | null {
  const withCode = sessions.filter((s) => !!s.resumeCode?.trim());
  if (withCode.length === 0) return null;
  const dna = withCode.filter((s) => isDnaPowerSession(s));
  const pool = dna.length > 0 ? dna : withCode;
  return (
    [...pool].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0] ??
    null
  );
}

/**
 * Phone-smoke test notification. When a chat exists, tap reclaims it.
 * No session → Account fallback (same as today).
 */
export function buildTestPushPayload(
  sessions: ReclaimSessionLike[],
  siteBase: string,
): ReclaimPushPayload {
  const base = siteBase.replace(/\/$/, "");
  const primary = pickTestReclaimSession(sessions);
  if (!primary?.resumeCode) {
    return {
      title: "Procharacters · test alert",
      body: "Push works. Chat while signed in so the next tap can reclaim heat — not just open Account.",
      url: `${base}/account`,
      tag: "procharacters-push-test",
      dnaPower: false,
    };
  }

  const dnaPower = isDnaPowerSession(primary);
  const name = primary.characterName?.trim() || "them";
  const nodeLabel = dnaNodeLabel(primary.dnaTreeNodeId);
  const url = buildReclaimChatUrl(base, primary, dnaPower);

  if (dnaPower) {
    return {
      title: nodeLabel ? `DNA power · ${nodeLabel} reclaim` : "DNA power · Edge reclaim",
      body: nodeLabel
        ? `${name} is still on DNA · ${nodeLabel}. Tap to reclaim Edge Pace — this is a test.`
        : `${name} held your Edge Pace heat. Tap to reclaim — this is a test.`,
      url,
      tag: "procharacters-push-test",
      dnaPower: true,
      characterName: name,
      characterId: primary.characterId,
    };
  }

  return {
    title: `Continue · ${name}`,
    body: `Resume with ${name}. Tap to pick up — this is a test, not an expiry warning.`,
    url,
    tag: "procharacters-push-test",
    dnaPower: false,
    characterName: name,
    characterId: primary.characterId,
  };
}
