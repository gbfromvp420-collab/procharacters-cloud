"use client";

import { useMemo } from "react";
import { mindFingerprint } from "@/lib/mind-fingerprint";

/**
 * Return Intelligence card — when opt-in memory exists, show what they kept
 * and one-tap pick-up seeds so re-entry never feels cold.
 */
export function ReturnHeatCard({
  priorNotes,
  characterId,
  characterName,
  onSeed,
  onFire,
  canFire,
}: {
  priorNotes?: string | null;
  characterId?: string | null;
  characterName?: string | null;
  onSeed?: (text: string) => void;
  onFire?: (text: string) => void;
  canFire?: boolean;
}) {
  const sig = useMemo(() => parseReturnSignals(priorNotes), [priorNotes]);
  const mind = mindFingerprint(characterId);
  const nick = characterName?.trim().split(/\s+/)[0] || "Them";

  if (!sig.hasAnything) return null;

  const seeds = buildPickupSeeds(sig);

  return (
    <div
      className="mb-3 animate-rise-in rounded-xl border border-emerald-400/35 bg-gradient-to-r from-emerald-500/12 via-brand-panel to-brand-panel px-3 py-2.5 text-[11px] leading-relaxed shadow-glow-sm"
      role="status"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/95">
          They remember you
          {sig.name ? ` · ${sig.name}` : ""}
        </p>
        {mind && (
          <span className="rounded-full border border-emerald-400/30 px-2 py-0.5 text-[9px] text-emerald-100/80">
            {mind.tag}
          </span>
        )}
        <span className="rounded-full border border-brand-border/70 px-2 py-0.5 text-[9px] text-brand-muted">
          {nick}
        </span>
      </div>

      <p className="mt-1 text-brand-muted">
        Opt-in heat is sticky. Tap a beat to pick up — no cold open.
      </p>

      {(sig.heat.length > 0 || sig.lastScene.length > 0 || sig.wants.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sig.lastScene.slice(0, 3).map((c) => (
            <span
              key={`s-${c}`}
              className="rounded-full border border-rose-400/35 bg-rose-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-rose-100/90"
            >
              {shortChip(c)}
            </span>
          ))}
          {sig.heat.slice(0, 3).map((c) => (
            <span
              key={`h-${c}`}
              className="rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-100/90"
            >
              {shortChip(c)}
            </span>
          ))}
          {sig.wants.slice(0, 2).map((c) => (
            <span
              key={`w-${c}`}
              className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[9px] text-violet-100/85"
            >
              {shortChip(c)}
            </span>
          ))}
        </div>
      )}

      {(onSeed || onFire) && seeds.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Pick up heat">
          {seeds.map((seed, i) => {
            const fire = !!onFire && i < 2 && seed.length <= 72;
            return (
              <button
                key={seed}
                type="button"
                disabled={fire && canFire === false}
                onClick={() => (fire ? onFire!(seed) : onSeed?.(seed))}
                title={fire ? "Send now" : "Add to composer"}
                className={`rounded-full border px-2.5 py-1 text-[10px] transition disabled:opacity-40 ${
                  fire
                    ? "border-emerald-300/50 bg-emerald-500/20 font-medium text-emerald-50 hover:bg-emerald-500/30"
                    : "border-brand-border/80 bg-black/20 text-brand-muted hover:border-emerald-400/40 hover:text-brand-text"
                }`}
              >
                {seed.length > 42 ? `${seed.slice(0, 40)}…` : seed}
                {fire ? " ↵" : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ReturnSig = {
  name: string | null;
  wants: string[];
  heat: string[];
  lastScene: string[];
  hasAnything: boolean;
};

function parseReturnSignals(prior?: string | null): ReturnSig {
  if (!prior?.trim()) {
    return { name: null, wants: [], heat: [], lastScene: [], hasAnything: false };
  }
  const who = bullets(prior, "Who they are");
  const wants = bullets(prior, "What they want");
  const heat = bullets(prior, "Recurring heat");
  const lastScene = bullets(prior, "Last scene lock");
  const name =
    who.map((w) => w.match(/^Called:\s*(.+)/i)?.[1]?.trim()).find(Boolean) ??
    prior.match(/(?:Called|call(?:ed)? me)\s*[:\s]+([A-Za-z][\w.-]{1,24})/i)?.[1] ??
    null;
  const hasAnything =
    !!name || wants.length > 0 || heat.length > 0 || lastScene.length > 0 ||
    /What they want:|Recurring heat:|Recent sessions:|Last scene lock:/i.test(prior);

  return {
    name: name || null,
    wants: wants.slice(0, 4),
    heat: heat.slice(0, 4),
    lastScene: lastScene.slice(0, 3),
    hasAnything,
  };
}

function bullets(dossier: string, heading: string): string[] {
  const lines = dossier.split("\n");
  const out: string[] = [];
  let inSection = false;
  const headRe = new RegExp(`^${heading}`, "i");
  for (const raw of lines) {
    const line = raw.trim();
    if (
      /^Who they are|^What they want|^Recurring heat|^Last scene lock|^Recent sessions|^Learned heat/i.test(
        line,
      )
    ) {
      inSection = headRe.test(line);
      continue;
    }
    if (!inSection) continue;
    if (line.startsWith("-")) {
      const item = line.replace(/^-\s*/, "").trim();
      if (item) out.push(item);
    }
  }
  return out;
}

function buildPickupSeeds(sig: ReturnSig): string[] {
  const seeds: string[] = [];
  if (sig.name) {
    seeds.push(`you remembered… call me ${sig.name} again while you edge me`);
  }
  if (sig.lastScene[0]) {
    seeds.push(`pick up where we left — ${shortChip(sig.lastScene[0], 36)}`);
  }
  if (sig.heat[0]) {
    seeds.push(`you know what i like — ${shortChip(sig.heat[0], 36)}`);
  }
  if (sig.wants[0]) {
    seeds.push(`same as last time — ${shortChip(sig.wants[0], 40)}`);
  }
  if (!seeds.length) {
    seeds.push("you kept a little of me… don’t cold-open");
    seeds.push("pick up our heat — slow");
  }
  return seeds.slice(0, 4);
}

function shortChip(s: string, max = 28): string {
  const t = s.replace(/^(clothing|pose|act|left at):\s*/i, "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}
