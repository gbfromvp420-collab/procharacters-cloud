"use client";

import { useMemo, useState } from "react";

/**
 * Compact “what we remember” UI — prior dossier + this-session notes + scene lock chips.
 * Chips are tappable when onChipPick is set — seed the composer with the lock beat.
 */
export function SessionMemoryStrip({
  priorNotes,
  sessionNotes,
  onChipPick,
}: {
  priorNotes?: string | null;
  sessionNotes?: string | null;
  /** Tap a scene-lock chip → seed into composer */
  onChipPick?: (text: string) => void;
}) {
  const hasPrior = !!(priorNotes && priorNotes.trim());
  const hasSession = !!(sessionNotes && sessionNotes.trim());
  const [open, setOpen] = useState(true);

  const sessionParsed = useMemo(
    () => (hasSession ? parseSessionNotes(sessionNotes!) : null),
    [hasSession, sessionNotes],
  );
  const priorParsed = useMemo(
    () => (hasPrior ? parseDossier(priorNotes!) : null),
    [hasPrior, priorNotes],
  );

  if (!hasPrior && !hasSession) return null;

  const chips = sessionParsed?.chips ?? [];

  return (
    <div className="rounded-xl border border-violet-400/25 bg-violet-500/5 text-[11px] leading-relaxed">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/90">
          What we remember
          {hasPrior && hasSession
            ? " · prior + now"
            : hasPrior
              ? " · across sessions"
              : " · this session"}
        </span>
        <span className="text-[10px] text-brand-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-violet-400/15 px-3 py-2">
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Scene lock chips">
              {chips.map((chip) => {
                const seed = chipToComposerSeed(chip);
                if (onChipPick) {
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => onChipPick(seed)}
                      title="Seed into composer"
                      className="rounded-full border border-rose-400/35 bg-rose-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-rose-100/90 transition hover:border-rose-300/60 hover:bg-rose-500/20"
                    >
                      {chip}
                    </button>
                  );
                }
                return (
                  <span
                    key={chip}
                    className="rounded-full border border-rose-400/35 bg-rose-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-rose-100/90"
                  >
                    {chip}
                  </span>
                );
              })}
            </div>
          )}

          {hasPrior && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-200/75">
                Across sessions
              </p>
              {priorParsed?.sections.length ? (
                <div className="mt-1 space-y-1.5">
                  {priorParsed.sections.map((sec) => (
                    <div key={sec.title}>
                      <p className="text-[9px] text-violet-200/60">{sec.title}</p>
                      <ul className="mt-0.5 list-inside list-disc text-brand-muted">
                        {sec.items.slice(0, 4).map((item) => (
                          <li key={item} className="whitespace-pre-wrap">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-0.5 whitespace-pre-wrap text-brand-muted">{priorNotes}</p>
              )}
            </div>
          )}

          {hasSession && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                This session
              </p>
              {sessionParsed?.headline && (
                <p className="mt-0.5 text-brand-muted">{sessionParsed.headline}</p>
              )}
              {sessionParsed?.vibe && (
                <p className="mt-0.5 text-brand-muted">
                  <span className="text-amber-200/70">Vibe · </span>
                  {sessionParsed.vibe}
                </p>
              )}
              {sessionParsed?.userBeats && (
                <p className="mt-0.5 text-brand-muted">
                  <span className="text-amber-200/70">You · </span>
                  {sessionParsed.userBeats}
                </p>
              )}
              {sessionParsed?.lastBeat && (
                <p className="mt-0.5 text-brand-muted">
                  <span className="text-amber-200/70">Them · </span>
                  {sessionParsed.lastBeat}
                </p>
              )}
              {!sessionParsed?.headline && !sessionParsed?.vibe && !sessionParsed?.userBeats && (
                <p className="mt-0.5 whitespace-pre-wrap text-brand-muted">{sessionNotes}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseSessionNotes(raw: string): {
  headline?: string;
  vibe?: string;
  userBeats?: string;
  lastBeat?: string;
  chips: string[];
} {
  const text = raw.replace(/\s+/g, " ").trim();
  const headline = text.match(/Session with [^.]+\./i)?.[0];
  const vibe = text.match(/Ongoing vibe:\s*([^.]+)/i)?.[1]?.trim();
  const userBeats = text
    .match(/Recent user beats:\s*(.+?)(?:\s+Last character beat:|$)/i)?.[1]
    ?.trim()
    .replace(/\s*Stay consistent.*$/i, "");
  const lastBeat = text.match(/Last character beat:\s*[“"](.+?)[”"]/i)?.[1]?.trim();

  const scene = text.match(/Scene lock:\s*([^.]*(?:\.[^A-Z]*)?)/i)?.[1] ?? "";
  const chips: string[] = [];
  const clothing = scene.match(/clothing="([^"]+)"/i)?.[1];
  const pose = scene.match(/pose=([^;]+)/i)?.[1]?.trim();
  const act = scene.match(/act=([^;]+)/i)?.[1]?.trim();
  const arousal = scene.match(/arousal=([^;]+)/i)?.[1]?.trim();
  const game = scene.match(/game=([^;]+)/i)?.[1]?.trim();
  const called = scene.match(/called=([^;]+)/i)?.[1]?.trim();
  if (clothing) chips.push(clothing);
  if (pose && !/live cam presence/i.test(pose)) chips.push(pose);
  if (act && !/^tease \/ escalate$/i.test(act)) chips.push(act);
  if (arousal) chips.push(arousal);
  if (game && !/tease \/ escalate/i.test(game)) chips.push(game);
  if (called) chips.push(called);
  if (vibe) {
    for (const part of vibe.split(";")) {
      const p = part.trim();
      if (
        p &&
        chips.length < 8 &&
        /heat ·|edge|denial|sheer|crotchless|gym|shy|brat|goth|kiss|hand|pose/i.test(p)
      ) {
        chips.push(p.length > 28 ? `${p.slice(0, 27)}…` : p);
      }
    }
  }

  return {
    headline,
    vibe,
    userBeats: userBeats ? stripQuotesNoise(userBeats) : undefined,
    lastBeat,
    chips: unique(chips).slice(0, 6),
  };
}

function parseDossier(raw: string): { sections: Array<{ title: string; items: string[] }> } {
  const sections: Array<{ title: string; items: string[] }> = [];
  let current: { title: string; items: string[] } | null = null;

  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (/^Who they are/i.test(t)) {
      current = { title: "Who", items: [] };
      sections.push(current);
      continue;
    }
    if (/^What they want/i.test(t)) {
      current = { title: "Wants", items: [] };
      sections.push(current);
      continue;
    }
    if (/^Recurring heat/i.test(t)) {
      current = { title: "Heat", items: [] };
      sections.push(current);
      continue;
    }
    if (/^Last scene lock/i.test(t)) {
      current = { title: "Last scene", items: [] };
      sections.push(current);
      continue;
    }
    if (/^Recent sessions/i.test(t)) {
      current = { title: "Recent", items: [] };
      sections.push(current);
      continue;
    }
    if (/^Learned heat prefs/i.test(t)) {
      current = { title: "Prefs", items: [t.replace(/^Learned heat prefs\s*/i, "").trim()] };
      sections.push(current);
      continue;
    }
    if (current && t.startsWith("-")) {
      const item = t.replace(/^-\s*/, "").trim();
      if (item) current.items.push(item);
    }
  }

  return { sections: sections.filter((s) => s.items.length > 0) };
}

function stripQuotesNoise(s: string): string {
  return s.replace(/[“”]/g, '"').trim();
}

/** Turn a scene-lock chip into a short user line for the composer. */
function chipToComposerSeed(chip: string): string {
  const c = chip.trim();
  if (/^heat ·/i.test(c)) return "stay in this heat with me…";
  if (/edging|denial|peak|hold/i.test(c)) return "hold it — don’t finish yet";
  if (/sheer|crotchless|lingerie|clothing|signature/i.test(c)) return `keep the ${c}… look at me`;
  if (/kneel|on back|straddl|lean|mirror|standing|close/i.test(c)) return `stay ${c} for me`;
  if (/stroke|grip|hands|kiss|grind|hover|eye contact|edging hold/i.test(c))
    return `more of that — ${c}`;
  if (/praise|soft-dom/i.test(c)) return "praise me while you edge me";
  // Call name / short tag
  if (/^[A-Z][a-zA-Z.-]{1,18}$/.test(c)) return `call me ${c}`;
  return `keep going — ${c}`;
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
