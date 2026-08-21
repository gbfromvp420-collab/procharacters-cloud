/**
 * Forge this heat — convert a live chat climb into Studio Forge DNA seed.
 * Stash in sessionStorage (query string is a short fallback).
 */

import { mindFingerprint } from "@/lib/mind-fingerprint";

const STASH_KEY = "pc_forge_heat_seed.v1";

export type ForgeHeatContext = {
  characterId: string;
  characterName?: string | null;
  /** Avatar / base for Studio (catalog id or custom base). */
  baseModelId?: string | null;
  dnaTreeLabel?: string | null;
  dnaTreeNodeId?: string | null;
  heatDepth?: string | null;
  heatChips?: string[] | null;
  recapLine?: string | null;
  messageCount?: number;
  isMine?: boolean;
};

export function buildForgeHeatFantasy(ctx: ForgeHeatContext): string {
  const nick = ctx.characterName?.trim().split(/\s+/)[0] || ctx.characterName?.trim() || "them";
  const mind = mindFingerprint(ctx.characterId, {
    displayName: ctx.characterName,
  });
  const dna = ctx.dnaTreeLabel?.trim() || ctx.dnaTreeNodeId?.trim() || null;
  const chips = (ctx.heatChips ?? []).filter(Boolean).slice(0, 5);
  const recap = ctx.recapLine?.trim().slice(0, 160) || null;
  const depth = ctx.heatDepth?.trim() || null;
  const msgs =
    typeof ctx.messageCount === "number" && ctx.messageCount > 0 ? ctx.messageCount : null;

  const lines: string[] = [
    `Forge a private Naughty Syntax DNA model from live heat with ${nick}.`,
    "",
    `Keep the vibe of ${nick}${mind ? ` (${mind.tag})` : ""} — uncensored, photorealistic, obsessive climb energy.`,
  ];

  if (dna) {
    lines.push(
      `Resume DNA climb energy at **${dna}** — do not cold-reset to spark; open mid-tree.`,
    );
  }
  if (depth || msgs) {
    lines.push(
      `Heat trail: ${[depth, msgs != null ? `${msgs} messages deep` : null]
        .filter(Boolean)
        .join(" · ")}.`,
    );
  }
  if (chips.length) {
    lines.push(`Fire chips that worked: ${chips.join(", ")}.`);
  }
  if (recap) {
    lines.push(`Last scene recap: “${recap}”.`);
  }
  if (mind?.bilingual) {
    lines.push("Bilingual spice (English + soft Spanish) when natural.");
  }
  lines.push(
    "",
    "Build adaptive prompt + behavior tree + memory seeds + LiveKit presence so the first chat reclaims this climb.",
  );

  return lines.join("\n").slice(0, 900);
}

/** Persist heat context for Studio (survives navigation better than long query). */
export function stashForgeHeatSeed(ctx: ForgeHeatContext): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      STASH_KEY,
      JSON.stringify({
        ...ctx,
        fantasy: buildForgeHeatFantasy(ctx),
        at: Date.now(),
      }),
    );
  } catch {
    /* private mode */
  }
}

export function takeForgeHeatSeed():
  | (ForgeHeatContext & {
      fantasy?: string;
      at?: number;
    })
  | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STASH_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STASH_KEY);
    const parsed = JSON.parse(raw) as ForgeHeatContext & {
      fantasy?: string;
      at?: number;
    };
    if (!parsed?.characterId) return null;
    // Drop stale stashes (>2h)
    if (parsed.at && Date.now() - parsed.at > 2 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Studio path for Forge this heat (query only — call stashForgeHeatSeed on click).
 */
export function buildForgeFromHeatPath(ctx: ForgeHeatContext): string {
  const params = new URLSearchParams();
  params.set("from", "heat");
  const base =
    ctx.baseModelId?.trim() ||
    (ctx.characterId.startsWith("custom-") ? null : ctx.characterId) ||
    "twink-default";
  params.set("base", base);
  const nick = ctx.characterName?.trim().split(/\s+/)[0] || ctx.characterName?.trim() || "";
  if (nick) params.set("nick", nick.slice(0, 32));
  const dna = ctx.dnaTreeLabel?.trim() || ctx.dnaTreeNodeId?.trim() || "";
  if (dna) params.set("dna", dna.slice(0, 40));
  if (ctx.heatDepth?.trim()) params.set("depth", ctx.heatDepth.trim().slice(0, 16));
  // Tiny seed fragment for shareable URLs without stash
  const micro = buildForgeHeatFantasy(ctx).slice(0, 180);
  if (micro) params.set("seed", micro);
  return `/models/studio?${params.toString()}`;
}

/** Whether heat is deep enough to offer Forge this heat. */
export function shouldOfferForgeFromHeat(ctx: {
  messageCount?: number;
  dnaTreeLabel?: string | null;
  dnaTreeNodeId?: string | null;
  heatDepth?: string | null;
}): boolean {
  const dna = ctx.dnaTreeLabel?.trim() || ctx.dnaTreeNodeId?.trim();
  if (dna && /edge|deny|release|gate|tease/i.test(dna)) return true;
  if (ctx.heatDepth === "deep" || ctx.heatDepth === "locked" || ctx.heatDepth === "edge") {
    return true;
  }
  return (ctx.messageCount ?? 0) >= 4;
}
