"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CharacterCard } from "@/lib/character-card";
import { isSmokeTestCard } from "@/lib/character-card";
import {
  EMPTY_PERSONA,
  PATH_COPY,
  buildPersonaStarter,
  loadPersona,
  personaChatHref,
  savePersona,
  skipPersona,
  stashPersonaStarter,
  type Gender,
  type Orientation,
  type PlayPath,
  type UserPersona,
} from "@/lib/user-persona";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

type Step =
  | "path"
  | "userName"
  | "userBio"
  | "userOrient"
  | "userGender"
  | "pickFace"
  | "charName"
  | "charBio"
  | "charOrient"
  | "charGender"
  | "scene";

const CUSTOM_STEPS: Step[] = [
  "path",
  "userName",
  "userBio",
  "userOrient",
  "userGender",
  "pickFace",
  "charName",
  "charBio",
  "charOrient",
  "charGender",
  "scene",
];

const PRESET_STEPS: Step[] = [
  "path",
  "userName",
  "userBio",
  "userOrient",
  "userGender",
  "pickFace",
  "scene",
];

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://procharacters-web-production-7288.up.railway.app";

function poster(card: CharacterCard): string {
  const p = card.posterClip;
  if (!p) return "";
  if (p.startsWith("http")) return p;
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${SITE}${path}`;
}

export function WelcomeQuest() {
  const router = useRouter();
  const [draft, setDraft] = useState<UserPersona>(EMPTY_PERSONA);
  const [index, setIndex] = useState(0);
  const [faces, setFaces] = useState<CharacterCard[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const existing = loadPersona();
    if (existing && !existing.skipped) setDraft({ ...EMPTY_PERSONA, ...existing });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${API_BASE}/api/v1/characters/gallery`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { characters?: CharacterCard[] } | null) => {
        if (cancelled || !data?.characters) return;
        const list = data.characters.filter((c) => !isSmokeTestCard(c));
        const featured = list.filter((c) => c.featured);
        setFaces((featured.length >= 6 ? featured : list).slice(0, 8));
      })
      .catch(() => {
        /* gallery optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const steps = draft.path === "custom" || !draft.path ? CUSTOM_STEPS : PRESET_STEPS;
  const step = steps[Math.min(index, steps.length - 1)]!;
  const total = steps.length;
  const at = index + 1;

  const patch = (partial: Partial<UserPersona>) =>
    setDraft((d) => ({ ...d, ...partial }));

  const canContinue = useMemo(() => {
    switch (step) {
      case "path":
        return !!draft.path;
      case "userName":
        return draft.userName.trim().length >= 2;
      case "userBio":
        return draft.userBio.trim().length >= 8;
      case "userOrient":
        return !!draft.userOrientation;
      case "userGender":
        return !!draft.userGender;
      case "pickFace":
        return !!draft.characterId;
      case "charName":
        return draft.characterName.trim().length >= 2;
      case "charBio":
        return draft.characterBio.trim().length >= 8;
      case "charOrient":
        return !!draft.characterOrientation;
      case "charGender":
        return !!draft.characterGender;
      case "scene":
        return draft.scenario.trim().length >= 8;
      default:
        return false;
    }
  }, [step, draft]);

  const finish = () => {
    setBusy(true);
    const path = draft.path ?? "custom";
    const preset = PATH_COPY[path];
    const selected = faces.find((c) => c.id === draft.characterId);
    const next: UserPersona = {
      ...draft,
      path,
      characterName:
        draft.characterName.trim() || selected?.displayName || preset.title,
      characterBio: draft.characterBio.trim() || preset.defaultBio,
      completedAt: new Date().toISOString(),
      skipped: false,
    };
    savePersona(next);
    const starter = buildPersonaStarter(next);
    if (starter && next.characterId) stashPersonaStarter(next.characterId, starter);
    router.push(personaChatHref(next));
  };

  const next = () => {
    if (step === "pickFace" && draft.characterId && !draft.characterName) {
      const card = faces.find((c) => c.id === draft.characterId);
      if (card) {
        patch({
          characterName: card.displayName,
          characterBio:
            draft.path && draft.path !== "custom"
              ? PATH_COPY[draft.path].defaultBio
              : card.teaser,
        });
      }
    }
    if (index >= steps.length - 1) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
  };

  const back = () => setIndex((i) => Math.max(0, i - 1));

  const heading: Record<Step, string> = {
    path: "How do you want to play?",
    userName: "What do they call you?",
    userBio: "Who are you in this heat?",
    userOrient: "Your orientation",
    userGender: "Your gender",
    pickFace: "Pick a face",
    charName: "Their name",
    charBio: "Who are they?",
    charOrient: "Their orientation",
    charGender: "Their gender",
    scene: "What’s the scene?",
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden bg-brand-bg">
      <div className="pointer-events-none absolute inset-0 bg-brand-mesh opacity-70" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={index === 0 ? () => router.push("/") : back}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-brand-panel text-lg text-brand-text"
            aria-label="Back"
          >
            ‹
          </button>
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i <= index ? "bg-brand-text" : "bg-brand-border"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col pt-10">
          <p className="text-[11px] uppercase tracking-[0.28em] text-brand-accent">
            Naughty Syntax · {at} / {total}
          </p>
          <h1 className="mt-3 text-[1.85rem] font-semibold leading-tight tracking-tight text-brand-text">
            {heading[step]}
          </h1>

          <div className="mt-8">
            {step === "path" && (
              <div className="flex flex-col gap-3">
                {(
                  [
                    ["gooner_guide", PATH_COPY.gooner_guide],
                    ["edging_buddies", PATH_COPY.edging_buddies],
                    ["custom", PATH_COPY.custom],
                  ] as const
                ).map(([id, copy]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      patch({
                        path: id as PlayPath,
                        characterBio:
                          id === "custom" ? draft.characterBio : copy.defaultBio,
                      });
                    }}
                    className={`quest-choice text-left ${
                      draft.path === id ? "quest-choice-on" : ""
                    }`}
                  >
                    <p className="text-base font-semibold">{copy.title}</p>
                    <p className="mt-1 text-sm text-brand-muted">{copy.blurb}</p>
                    {id !== "custom" ? (
                      <p className="mt-2 text-[11px] text-brand-soft">
                        Custom or select a face · alter later
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            )}

            {step === "userName" && (
              <input
                autoFocus
                value={draft.userName}
                onChange={(e) => patch({ userName: e.target.value.slice(0, 40) })}
                placeholder="Your name"
                className="quest-field"
              />
            )}

            {step === "userBio" && (
              <textarea
                autoFocus
                value={draft.userBio}
                onChange={(e) => patch({ userBio: e.target.value.slice(0, 280) })}
                placeholder="Brief · how you show up, what you want"
                rows={4}
                className="quest-field resize-none"
              />
            )}

            {step === "userOrient" && (
              <ChoiceRow
                value={draft.userOrientation}
                options={[
                  ["gay", "Gay"],
                  ["bi", "Bi"],
                  ["straight", "Straight"],
                ]}
                onPick={(v) => patch({ userOrientation: v as Orientation })}
              />
            )}

            {step === "userGender" && (
              <ChoiceRow
                value={draft.userGender}
                options={[
                  ["male", "Male"],
                  ["female", "Female"],
                  ["trans", "Trans"],
                ]}
                onPick={(v) => patch({ userGender: v as Gender })}
              />
            )}

            {step === "pickFace" && (
              <div className="grid grid-cols-2 gap-3">
                {faces.map((card) => {
                  const on = draft.characterId === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() =>
                        patch({
                          characterId: card.id,
                          characterName: card.displayName,
                        })
                      }
                      className={`overflow-hidden rounded-2xl border text-left ${
                        on
                          ? "border-brand-accent ring-2 ring-brand-accent/40"
                          : "border-brand-border"
                      }`}
                    >
                      <div className="aspect-[3/4] bg-black">
                        {poster(card) ? (
                          <video
                            src={poster(card)}
                            className="h-full w-full object-cover"
                            muted
                            loop
                            playsInline
                            autoPlay
                          />
                        ) : null}
                      </div>
                      <p className="truncate px-2.5 py-2 text-sm font-medium text-brand-text">
                        {card.displayName}
                      </p>
                    </button>
                  );
                })}
                {faces.length === 0 ? (
                  <p className="col-span-2 text-sm text-brand-muted">Loading faces…</p>
                ) : null}
              </div>
            )}

            {step === "charName" && (
              <input
                autoFocus
                value={draft.characterName}
                onChange={(e) => patch({ characterName: e.target.value.slice(0, 40) })}
                placeholder="Character name"
                className="quest-field"
              />
            )}

            {step === "charBio" && (
              <textarea
                autoFocus
                value={draft.characterBio}
                onChange={(e) => patch({ characterBio: e.target.value.slice(0, 280) })}
                placeholder="Core personality · how they tease, hold, talk"
                rows={4}
                className="quest-field resize-none"
              />
            )}

            {step === "charOrient" && (
              <ChoiceRow
                value={draft.characterOrientation}
                options={[
                  ["gay", "Gay"],
                  ["bi", "Bi"],
                  ["straight", "Straight"],
                ]}
                onPick={(v) => patch({ characterOrientation: v as Orientation })}
              />
            )}

            {step === "charGender" && (
              <ChoiceRow
                value={draft.characterGender}
                options={[
                  ["male", "Male"],
                  ["female", "Female"],
                  ["trans", "Trans"],
                ]}
                onPick={(v) => patch({ characterGender: v as Gender })}
              />
            )}

            {step === "scene" && (
              <textarea
                autoFocus
                value={draft.scenario}
                onChange={(e) => patch({ scenario: e.target.value.slice(0, 400) })}
                placeholder="Brief scene · where you are, what starts"
                rows={4}
                className="quest-field resize-none"
              />
            )}
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            disabled={!canContinue || busy}
            onClick={next}
            className="quest-continue"
          >
            {busy ? "Opening…" : index >= steps.length - 1 ? "Start heat" : "Continue"}
          </button>
          <button
            type="button"
            onClick={() => {
              skipPersona();
              router.push("/account#chats");
            }}
            className="w-full py-2 text-center text-sm text-brand-muted hover:text-brand-text"
          >
            Skip for now
          </button>
        </div>
      </div>
    </main>
  );
}

function ChoiceRow({
  value,
  options,
  onPick,
}: {
  value: string | null;
  options: Array<[string, string]>;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          className={`quest-choice ${value === id ? "quest-choice-on" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
