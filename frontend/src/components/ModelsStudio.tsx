"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { loadStoredAccount, type StoredAccount } from "@/lib/account-storage";
import {
  createCustomCharacter,
  fetchAccountMe,
  fetchBaseModelPrefill,
  listLiveCharacters,
  updateCustomCharacter,
  uploadCharacterClip,
  uploadCharacterClipsBatch,
} from "@/lib/api";
import { CLIP_FILE_ACCEPT } from "@/lib/clip-upload";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import type {
  CustomSceneInput,
  LiveCharacterOption,
  MediaClipKey,
} from "@/lib/types";
import { ClipPreview } from "@/components/ClipPreview";
import { MyCharacterWinToast } from "@/components/MyCharacterWinToast";
import { SiteChrome } from "@/components/SiteChrome";

const CLIP_KEYS: MediaClipKey[] = ["idle", "teasing", "playful", "aroused"];
const BAND_LABEL: Record<MediaClipKey, string> = {
  idle: "Idle",
  teasing: "Tease",
  playful: "Play",
  aroused: "Edge",
};

const ENERGY_PRESETS: Array<{
  id: string;
  label: string;
  tags: string[];
  energy: string;
}> = [
  {
    id: "soft-dom",
    label: "Soft-dom",
    tags: ["soft-dom", "control", "praise"],
    energy:
      "Soft-dom control · slow commands · praise when they obey · deny finish until they beg pretty",
  },
  {
    id: "bratty",
    label: "Bratty",
    tags: ["brat", "tease", "count-games"],
    energy:
      "Playful brat energy · look-but-don’t · count games · cute denial with a laugh · mean-soft",
  },
  {
    id: "shy-heat",
    label: "Shy heat",
    tags: ["shy", "whisper", "praise-sensitive"],
    energy:
      "Shy whisper exhibition · peek-and-hide · blush when praised · soft Spanish optional · edge slow",
  },
  {
    id: "edge-focus",
    label: "Edge focus",
    tags: ["edging", "denial", "sheer"],
    energy:
      "Sheer fabric denial · slow strokes · freeze on the edge · no climax without clear beg",
  },
  {
    id: "ritual",
    label: "Ritual / goth",
    tags: ["ritual", "hypnotic", "lace"],
    energy:
      "Hypnotic ritual pace · open lace still-life · beg quieter · charged cool-downs between edges",
  },
  {
    id: "gym-interval",
    label: "Gym interval",
    tags: ["sweat", "interval", "reps"],
    energy:
      "Post-set cool-down · sweat + sheer · interval edge reps · hold the burn · no early finish",
  },
];

const AUDIENCE_OPTS = [
  { id: "any", label: "Any" },
  { id: "gay", label: "Gay" },
  { id: "bi", label: "Bi" },
  { id: "straight", label: "Straight" },
] as const;

function clipUrlForBase(baseId: string, key: MediaClipKey): string {
  return `/avatar/${baseId}/${key}.mp4`;
}

function ModelsStudioInner({ initialEditId = "" }: { initialEditId?: string }) {
  const router = useRouter();
  const search = useSearchParams();
  // Prefer path param; fall back to legacy ?edit= / ?character=
  const queryEdit =
    search.get("edit")?.trim() || search.get("character")?.trim() || "";
  const editId = (initialEditId || queryEdit).trim();

  // Legacy query → canonical /models/studio/edit/:id
  useEffect(() => {
    if (initialEditId) return;
    if (!queryEdit) return;
    router.replace(`/models/studio/edit/${encodeURIComponent(queryEdit)}`);
  }, [initialEditId, queryEdit, router]);

  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [characters, setCharacters] = useState<LiveCharacterOption[]>([]);
  const [customsLimit, setCustomsLimit] = useState(10);
  const [activePremium, setActivePremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Form
  const [baseModelId, setBaseModelId] = useState("twink-default");
  const [name, setName] = useState("");
  const [archetype, setArchetype] = useState("");
  const [appearance, setAppearance] = useState("");
  const [energy, setEnergy] = useState("");
  const [clothing, setClothing] = useState("");
  const [audience, setAudience] = useState<"gay" | "bi" | "straight" | "any">("any");
  const [vibeTags, setVibeTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [phrases, setPhrases] = useState<string[]>([]);
  const [phraseDraft, setPhraseDraft] = useState("");
  const [scenes, setScenes] = useState<CustomSceneInput[]>([
    { title: "", body: "" },
    { title: "", body: "" },
  ]);
  const [promptBoost, setPromptBoost] = useState("");
  const [featured, setFeatured] = useState(false);
  const [clips, setClips] = useState<Partial<Record<MediaClipKey, string>>>({});
  const [localClipFiles, setLocalClipFiles] = useState<
    Partial<Record<MediaClipKey, { file: File; url: string }>>
  >({});
  const [previewBand, setPreviewBand] = useState<MediaClipKey>("teasing");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const defaults = useMemo(
    () => characters.filter((c) => c.kind === "default"),
    [characters],
  );
  const mine = useMemo(
    () => characters.filter((c) => c.mine === true),
    [characters],
  );
  const used = mine.length;
  const capFull = !editingId && used >= customsLimit;
  const nearCap = !editingId && used >= customsLimit - 1 && used < customsLimit;

  const baseCard = defaults.find((c) => c.id === baseModelId) ?? defaults[0];
  const mind = mindFingerprint(baseModelId, {
    displayName: name || baseCard?.displayName,
    energyLabel: energy || baseCard?.energyLabel,
  });

  const previewSrc = useMemo(() => {
    const local = localClipFiles[previewBand]?.url;
    if (local) return local;
    if (clips[previewBand]) return clips[previewBand]!;
    if (baseCard?.clips?.[previewBand]) return baseCard.clips[previewBand];
    return clipUrlForBase(baseModelId, previewBand);
  }, [baseCard, baseModelId, clips, localClipFiles, previewBand]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2800);
  };

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const acc = loadStoredAccount();
      setAccount(acc);
      const list = await listLiveCharacters(acc?.token);
      setCharacters(list);
      if (acc?.token) {
        try {
          const me = await fetchAccountMe(acc.token);
          if (me.customsLimit) setCustomsLimit(me.customsLimit);
          setActivePremium(!!me.activePremium);
        } catch {
          /* non-fatal */
        }
      }

      // Prefill create defaults
      if (!editId) {
        const first = list.find((c) => c.kind === "default")?.id || "twink-default";
        setBaseModelId(first);
        try {
          const pre = await fetchBaseModelPrefill(first);
          setAppearance(pre.identityHint || "");
          setEnergy(pre.vibeHint || pre.energyLabel || "");
          setClothing(pre.clothingHint || "");
        } catch {
          /* keep empty */
        }
      } else {
        const target = list.find((c) => c.id === editId && c.mine);
        if (target) {
          setEditingId(target.id);
          setName(target.displayName || "");
          setBaseModelId(target.baseModelId || target.avatarBase || "twink-default");
          const rawApp = target.appearance || "";
          const boostSplit = rawApp.split(/\n\n## Naughty Syntax booster\n/i);
          setAppearance(boostSplit[0]?.trim() || rawApp);
          setPromptBoost(boostSplit[1]?.trim() || "");
          const rawEnergy = target.energy || target.energyLabel || "";
          const archMatch = rawEnergy.match(/Archetype:\s*([^.]*)/i)?.[1]?.trim();
          const tagsMatch = rawEnergy.match(/Tags:\s*([^.]+)/i)?.[1];
          if (archMatch) setArchetype(archMatch);
          if (tagsMatch) {
            setVibeTags(
              uniqueTags(
                tagsMatch
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              ),
            );
          }
          setEnergy(
            rawEnergy
              .replace(/\s*Archetype:\s*[^.]*\.?/gi, "")
              .replace(/\s*Tags:\s*[^.]*\.?/gi, "")
              .trim() || rawEnergy,
          );
          setClothing(target.clothing || "");
          setPhrases(target.keyPhrases?.filter(Boolean) ?? []);
          setScenes(
            target.scenes?.length
              ? [
                  ...target.scenes.slice(0, 4),
                  ...Array.from(
                    { length: Math.max(0, 2 - target.scenes.length) },
                    () => ({ title: "", body: "" }),
                  ),
                ].slice(0, 4)
              : [
                  { title: "", body: "" },
                  { title: "", body: "" },
                ],
          );
          setFeatured(target.featured === true);
          const overrides = target.mediaOverrides || {};
          setClips({
            idle: overrides.idle || target.clips?.idle,
            teasing: overrides.teasing || target.clips?.teasing,
            playful: overrides.playful || target.clips?.playful,
            aroused: overrides.aroused || target.clips?.aroused,
          });
        } else {
          setError("Model not found or not yours — start a new create.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load studio");
    } finally {
      setLoading(false);
    }
  }, [editId]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Auto-cycle preview band for “reactivity simulation”
  useEffect(() => {
    const order: MediaClipKey[] = ["idle", "teasing", "playful", "aroused", "teasing"];
    let i = 0;
    const t = window.setInterval(() => {
      i = (i + 1) % order.length;
      setPreviewBand(order[i]!);
    }, 4200);
    return () => window.clearInterval(t);
  }, [baseModelId, editingId]);

  const onPickBase = async (id: string) => {
    if (editingId) return;
    setBaseModelId(id);
    try {
      const pre = await fetchBaseModelPrefill(id);
      setAppearance((prev) => (prev.trim().length > 40 ? prev : pre.identityHint || prev));
      setEnergy((prev) => (prev.trim().length > 20 ? prev : pre.vibeHint || pre.energyLabel || prev));
      setClothing((prev) => (prev.trim().length > 8 ? prev : pre.clothingHint || prev));
      showFlash(`Base · ${pre.displayName}`);
    } catch {
      showFlash("Base selected");
    }
  };

  const applyPreset = (presetId: string) => {
    const p = ENERGY_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setArchetype(p.label);
    setEnergy(p.energy);
    setVibeTags((prev) => uniqueTags([...prev, ...p.tags]));
    showFlash(`Energy · ${p.label}`);
  };

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
    if (!t) return;
    setVibeTags((prev) => uniqueTags([...prev, t]));
    setTagDraft("");
  };

  const addPhrase = () => {
    const p = phraseDraft.trim().slice(0, 120);
    if (!p || phrases.length >= 6) return;
    setPhrases((prev) => [...prev, p]);
    setPhraseDraft("");
  };

  const updateScene = (idx: number, field: "title" | "body", value: string) => {
    setScenes((prev) => {
      const next = [...prev];
      const cur = next[idx] ?? { title: "", body: "" };
      next[idx] = { ...cur, [field]: value };
      return next;
    });
  };

  const addSceneSlot = () => {
    if (scenes.length >= 4) return;
    setScenes((prev) => [...prev, { title: "", body: "" }]);
  };

  const removeSceneSlot = (idx: number) => {
    if (scenes.length <= 2) {
      updateScene(idx, "title", "");
      updateScene(idx, "body", "");
      return;
    }
    setScenes((prev) => prev.filter((_, i) => i !== idx));
  };

  const onLocalClip = (key: MediaClipKey, file: File | null) => {
    setLocalClipFiles((prev) => {
      const next = { ...prev };
      if (prev[key]?.url) URL.revokeObjectURL(prev[key]!.url);
      if (!file) {
        delete next[key];
        return next;
      }
      next[key] = { file, url: URL.createObjectURL(file) };
      return next;
    });
    setPreviewBand(key);
  };

  const onBatchFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list);
    for (const file of files) {
      const base = file.name.toLowerCase();
      let key: MediaClipKey | null = null;
      if (base.includes("idle")) key = "idle";
      else if (base.includes("teas") || base.includes("tease")) key = "teasing";
      else if (base.includes("play")) key = "playful";
      else if (base.includes("arous") || base.includes("edge") || base.includes("hot"))
        key = "aroused";
      if (key) onLocalClip(key, file);
    }
    showFlash(`Loaded ${files.length} file(s) — assign bands if needed`);
  };

  const mergeAppearance = (): string => {
    const core = appearance.trim();
    const boost = promptBoost.trim();
    if (!boost) return core;
    return `${core}\n\n## Naughty Syntax booster\n${boost}`.slice(0, 2000);
  };

  const mergeEnergy = (): string => {
    const tags = vibeTags.length ? ` Tags: ${vibeTags.join(", ")}.` : "";
    const arch = archetype.trim() ? ` Archetype: ${archetype.trim()}.` : "";
    return `${energy.trim()}${arch}${tags}`.trim().slice(0, 800);
  };

  const validScenes = (): CustomSceneInput[] =>
    scenes
      .map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
      .filter((s) => s.title.length >= 2 && s.body.length >= 12)
      .slice(0, 4);

  const canSave =
    !!account?.token &&
    name.trim().length >= 2 &&
    appearance.trim().length >= 12 &&
    energy.trim().length >= 4 &&
    !capFull &&
    !saving;

  const handleSave = async () => {
    if (!account?.token) {
      setError("Sign in required to save a private My Character");
      return;
    }
    if (capFull) {
      setError(`Cap full (${customsLimit}). Delete a model or upgrade.`);
      return;
    }
    if (name.trim().length < 2 || appearance.trim().length < 12) {
      setError("Name (2+) and visual description (12+) required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        appearance: mergeAppearance(),
        energy: mergeEnergy() || undefined,
        clothing: clothing.trim() || undefined,
        baseModelId: editingId ? undefined : baseModelId,
        audience,
        keyPhrases: phrases.length ? phrases.slice(0, 6) : undefined,
        scenes: validScenes().length ? validScenes() : undefined,
      };

      let id = editingId;
      let displayName = name.trim();

      if (editingId) {
        const updated = await updateCustomCharacter(
          editingId,
          {
            name: payload.name,
            appearance: payload.appearance,
            energy: payload.energy,
            clothing: payload.clothing,
            keyPhrases: payload.keyPhrases ?? null,
            scenes: payload.scenes ?? null,
            featured,
          },
          account.token,
        );
        id = updated.id;
        displayName = updated.displayName;
        showFlash(`${displayName} updated`);
      } else {
        const created = await createCustomCharacter(
          {
            name: payload.name,
            appearance: payload.appearance,
            energy: payload.energy,
            clothing: payload.clothing,
            baseModelId,
            audience,
            keyPhrases: payload.keyPhrases,
            scenes: payload.scenes,
          },
          account.token,
        );
        id = created.id;
        displayName = created.displayName;
        setEditingId(created.id);
        if (featured) {
          try {
            await updateCustomCharacter(created.id, { featured: true }, account.token);
          } catch {
            /* featured soft-fail */
          }
        }
      }

      // Upload pending local clips (need id)
      if (id) {
        const pending = Object.entries(localClipFiles) as Array<
          [MediaClipKey, { file: File; url: string }]
        >;
        if (pending.length === 1) {
          const [key, { file }] = pending[0]!;
          const up = await uploadCharacterClip(id, key, file, account.token);
          setClips((c) => ({ ...c, ...up.clips }));
        } else if (pending.length > 1) {
          const files = pending.map(([, v]) => v.file);
          const up = await uploadCharacterClipsBatch(id, files, account.token);
          setClips((c) => ({ ...c, ...up.clips }));
          // Map remaining by emotion from uploaded list
          for (const u of up.uploaded) {
            setClips((c) => ({ ...c, [u.emotion]: u.url }));
          }
        }
        // Clear blob URLs
        setLocalClipFiles((prev) => {
          for (const v of Object.values(prev)) {
            if (v?.url) URL.revokeObjectURL(v.url);
          }
          return {};
        });
      }

      const list = await listLiveCharacters(account.token);
      setCharacters(list);
      setJustCreated({ id: id!, name: displayName });
      showFlash(`${displayName} · private My Character`);
      // Canonical edit URL after first save
      if (id && !editingId) {
        router.replace(`/models/studio/edit/${encodeURIComponent(id)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const startHeat = (mode?: "edge_pace") => {
    if (!justCreated?.id) return;
    const q = new URLSearchParams({
      character: justCreated.id,
      autostart: "1",
    });
    if (mode) q.set("mode", mode);
    router.push(`/chat?${q.toString()}`);
  };

  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-none absolute inset-0 bg-brand-mesh" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(167,139,250,0.12),transparent_50%),radial-gradient(ellipse_at_80%_20%,rgba(244,63,94,0.1),transparent_45%)]" />

      <SiteChrome
        active="studio"
        title="My Models Studio"
        subtitle={
          editingId
            ? "Edit private model · clips · scenes · boost"
            : "Create private Naughty Syntax minds"
        }
        className="pt-[env(safe-area-inset-top,0px)]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Header strip */}
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-200/90">
              Custom Character v2 · private
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-text sm:text-3xl">
              {editingId ? "Edit model" : "Forge a mind"}
            </h1>
            <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-brand-muted">
              Base body + your identity, scenes, and clips. Never public unless you pin
              Featured (soft). Free path always works.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {account ? (
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  capFull
                    ? "border-rose-400/45 bg-rose-500/15 text-rose-100"
                    : nearCap
                      ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                      : "border-violet-400/35 bg-violet-500/10 text-violet-100"
                }`}
              >
                {used}/{customsLimit} slots
                {activePremium ? " · premium" : " · free"}
              </span>
            ) : (
              <Link
                href="/account"
                className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-100"
              >
                Sign in required
              </Link>
            )}
            <Link
              href="/?filter=owned"
              className="btn-ghost min-h-0 px-3 py-1.5 text-xs"
            >
              My models gallery
            </Link>
            <Link href="/account#my-models" className="btn-ghost min-h-0 px-3 py-1.5 text-xs">
              Account hub
            </Link>
          </div>
        </div>

        {flash && (
          <p
            className="mb-3 rounded-lg border border-brand-accent/30 bg-brand-accent/10 px-3 py-2 text-[12px] text-brand-accent"
            role="status"
          >
            {flash}
          </p>
        )}
        {error && (
          <p
            className="mb-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100"
            role="alert"
          >
            {error}
          </p>
        )}

        {justCreated && (
          <MyCharacterWinToast
            show
            characterId={justCreated.id}
            characterName={justCreated.name}
            customsLimit={customsLimit}
            onStart={() => startHeat()}
            onStartEdge={() => startHeat("edge_pace")}
            onDismiss={() => setJustCreated(null)}
          />
        )}

        {!account && !loading && (
          <div className="mb-4 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-4">
            <p className="text-sm font-medium text-brand-text">Sign in to open the studio</p>
            <p className="mt-1 text-[12px] text-brand-muted">
              My Characters are private to your account. Sign in, then forge a mind.
            </p>
            <Link href="/account" className="btn-primary mt-3 inline-flex min-h-0 px-4 py-2 text-sm">
              Sign in
            </Link>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-brand-muted">Loading studio…</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,340px)] lg:items-start lg:gap-6">
            {/* ── Form column ── */}
            <div className="space-y-4">
              {/* Base picker */}
              <section className="rounded-2xl border border-brand-border/80 bg-brand-panel/80 p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                    1 · Base model
                  </h2>
                  {editingId && (
                    <span className="text-[10px] text-brand-muted">Locked on edit</span>
                  )}
                </div>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x">
                  {defaults.map((c) => {
                    const active = c.id === baseModelId;
                    const poster =
                      c.clips?.teasing || c.clips?.idle || clipUrlForBase(c.id, "teasing");
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={!!editingId}
                        onClick={() => void onPickBase(c.id)}
                        className={`snap-start shrink-0 w-[7.5rem] overflow-hidden rounded-xl border text-left transition sm:w-36 ${
                          active
                            ? "border-violet-400/60 ring-2 ring-violet-400/40"
                            : "border-brand-border hover:border-brand-accent/50"
                        } disabled:opacity-70`}
                      >
                        <div className="relative aspect-[3/4] bg-black">
                          <video
                            src={poster}
                            className="h-full w-full object-cover"
                            muted
                            loop
                            playsInline
                            autoPlay
                          />
                          {active && (
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-violet-500/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                              Base
                            </span>
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="truncate text-[11px] font-medium text-brand-text">
                            {c.displayName}
                          </p>
                          <p className="truncate text-[9px] text-brand-muted">
                            {mindFingerprint(c.id)?.tag || c.energyLabel?.split(",")[0]}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Identity */}
              <section className="rounded-2xl border border-brand-border/80 bg-brand-panel/80 p-3 sm:p-4">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                  2 · Identity
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-1">
                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-brand-muted">
                      Name
                    </span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Diego, Mila, your muse…"
                      className="field w-full text-sm"
                      maxLength={80}
                    />
                  </label>
                  <label className="block sm:col-span-1">
                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-brand-muted">
                      Archetype / role
                    </span>
                    <input
                      value={archetype}
                      onChange={(e) => setArchetype(e.target.value)}
                      placeholder="Soft-dom, shy cam boy…"
                      className="field w-full text-sm"
                      maxLength={60}
                    />
                  </label>
                </div>

                <p className="mb-1.5 mt-3 text-[10px] uppercase tracking-wide text-brand-muted">
                  Energy presets
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ENERGY_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                        archetype === p.label
                          ? "border-rose-400/50 bg-rose-500/20 text-rose-50"
                          : "border-brand-border bg-brand-bg text-brand-muted hover:border-brand-accent/50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <label className="mt-3 block">
                  <span className="mb-1 block text-[10px] uppercase tracking-wide text-brand-muted">
                    Visual description · photorealistic lock
                  </span>
                  <textarea
                    value={appearance}
                    onChange={(e) => setAppearance(e.target.value)}
                    rows={5}
                    placeholder="Age 18+, body, hair, skin, face, signature clothing physics, arousal detail…"
                    className="field w-full resize-y text-sm leading-relaxed"
                    maxLength={2000}
                  />
                  <span className="mt-0.5 block text-[10px] text-brand-soft">
                    {appearance.trim().length}/2000 · min 12
                  </span>
                </label>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-brand-muted">
                      Vibe / energy
                    </span>
                    <textarea
                      value={energy}
                      onChange={(e) => setEnergy(e.target.value)}
                      rows={3}
                      placeholder="How they tease, deny, talk…"
                      className="field w-full resize-y text-sm"
                      maxLength={800}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-brand-muted">
                      Clothing focus
                    </span>
                    <input
                      value={clothing}
                      onChange={(e) => setClothing(e.target.value)}
                      placeholder="Sheer thong / crotchless lace…"
                      className="field w-full text-sm"
                      maxLength={200}
                    />
                    <span className="mb-1 mt-2 block text-[10px] uppercase tracking-wide text-brand-muted">
                      Audience
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {AUDIENCE_OPTS.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setAudience(a.id)}
                          className={`rounded-full border px-2.5 py-1 text-[10px] ${
                            audience === a.id
                              ? "border-brand-accent/50 bg-brand-accent/15 text-brand-text"
                              : "border-brand-border text-brand-muted"
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>

                {/* Vibe tags */}
                <div className="mt-3">
                  <p className="mb-1.5 text-[10px] uppercase tracking-wide text-brand-muted">
                    Vibe tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {vibeTags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setVibeTags((p) => p.filter((x) => x !== t))}
                        className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-100"
                        title="Remove"
                      >
                        {t} ×
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Add tag…"
                      className="field min-w-0 flex-1 text-xs"
                    />
                    <button type="button" onClick={addTag} className="btn-ghost min-h-0 px-3 py-1.5 text-xs">
                      Add
                    </button>
                  </div>
                </div>
              </section>

              {/* Phrases */}
              <section className="rounded-2xl border border-brand-border/80 bg-brand-panel/80 p-3 sm:p-4">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                  3 · Key phrases
                </h2>
                <p className="mb-2 text-[11px] text-brand-muted">
                  Signature lines the mind can drop mid-heat (max 6).
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {phrases.map((p, i) => (
                    <button
                      key={`${p}-${i}`}
                      type="button"
                      onClick={() => setPhrases((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-50"
                    >
                      “{p.length > 28 ? `${p.slice(0, 26)}…` : p}” ×
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={phraseDraft}
                    onChange={(e) => setPhraseDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPhrase();
                      }
                    }}
                    placeholder='e.g. “not yet… mírame”'
                    className="field min-w-0 flex-1 text-sm"
                    disabled={phrases.length >= 6}
                  />
                  <button
                    type="button"
                    onClick={addPhrase}
                    disabled={phrases.length >= 6}
                    className="btn-ghost min-h-0 px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </section>

              {/* Scenes */}
              <section className="rounded-2xl border border-brand-border/80 bg-brand-panel/80 p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                    4 · Scene examples
                  </h2>
                  <button
                    type="button"
                    onClick={addSceneSlot}
                    disabled={scenes.length >= 4}
                    className="text-[11px] text-brand-accent hover:underline disabled:opacity-40"
                  >
                    + Scene ({scenes.length}/4)
                  </button>
                </div>
                <p className="mb-3 text-[11px] text-brand-muted">
                  Title + body inject into the prompt — 2–4 slots recommended.
                </p>
                <div className="space-y-3">
                  {scenes.map((s, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-brand-border/60 bg-brand-bg/50 p-2.5"
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                          Scene {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSceneSlot(idx)}
                          className="text-[10px] text-brand-soft hover:text-rose-200"
                        >
                          Clear
                        </button>
                      </div>
                      <input
                        value={s.title}
                        onChange={(e) => updateScene(idx, "title", e.target.value)}
                        placeholder="Title — Mirror tease, Cool-down edge…"
                        className="field mb-1.5 w-full text-xs"
                        maxLength={80}
                      />
                      <textarea
                        value={s.body}
                        onChange={(e) => updateScene(idx, "body", e.target.value)}
                        placeholder="What happens + one line of dialogue (min ~12 chars when filled)"
                        rows={3}
                        className="field w-full resize-y text-xs leading-relaxed"
                        maxLength={600}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Clips */}
              <section className="rounded-2xl border border-brand-border/80 bg-brand-panel/80 p-3 sm:p-4">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                  5 · Avatar clips
                </h2>
                <p className="mb-3 text-[11px] text-brand-muted">
                  Four energy bands (idle → edge). Batch-upload files named idle / teasing /
                  playful / aroused — or assign per slot. Upload runs after save.
                </p>
                <label className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-violet-400/40 bg-violet-500/5 px-3 py-4 text-center transition hover:border-violet-400/70">
                  <span className="text-sm font-medium text-brand-text">Batch drop / select</span>
                  <span className="text-[11px] text-brand-muted">MP4 or WebM · max 40MB each</span>
                  <input
                    type="file"
                    accept={CLIP_FILE_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      onBatchFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CLIP_KEYS.map((key) => {
                    const local = localClipFiles[key]?.url;
                    const src =
                      local ||
                      clips[key] ||
                      baseCard?.clips?.[key] ||
                      clipUrlForBase(baseModelId, key);
                    return (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                            {BAND_LABEL[key]} · {key}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewBand(key)}
                            className={`text-[10px] ${
                              previewBand === key
                                ? "text-rose-200"
                                : "text-brand-soft hover:text-brand-accent"
                            }`}
                          >
                            Preview
                          </button>
                        </div>
                        <ClipPreview src={src} label={key} />
                        <label className="btn-ghost flex min-h-0 cursor-pointer items-center justify-center px-2 py-1.5 text-[10px]">
                          {localClipFiles[key] ? "Replace file" : "Assign file"}
                          <input
                            type="file"
                            accept={CLIP_FILE_ACCEPT}
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              onLocalClip(key, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Prompt boost */}
              <section className="rounded-2xl border border-violet-400/25 bg-violet-500/5 p-3 sm:p-4">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-200/90">
                  6 · Naughty Syntax booster
                </h2>
                <p className="mb-2 text-[11px] text-brand-muted">
                  Optional overlay merged into the identity lock on save (auto-appended under a
                  booster header). Use for filthy specificity without rewriting the base.
                </p>
                <textarea
                  value={promptBoost}
                  onChange={(e) => setPromptBoost(e.target.value)}
                  rows={4}
                  placeholder="Extra mind rules: denial style, Spanish density, fabric physics, no-climax law…"
                  className="field w-full resize-y text-sm leading-relaxed"
                  maxLength={1200}
                />
              </section>

              {/* Visibility + save */}
              <section className="sticky bottom-0 z-20 -mx-3 border-t border-brand-border/80 bg-brand-bg/95 px-3 py-3 backdrop-blur-md sm:static sm:mx-0 sm:rounded-2xl sm:border sm:border-brand-border/80 sm:bg-brand-panel/90 sm:px-4 sm:py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-[12px] text-brand-muted">
                    <input
                      type="checkbox"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                      className="rounded border-brand-border"
                    />
                    Soft Featured pin
                    <span className="text-[10px] text-brand-soft">
                      (still private · pin on your surfaces)
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/chat" className="btn-ghost min-h-0 px-3 py-2 text-xs">
                      Cancel
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={!canSave}
                      className="btn-primary min-h-0 flex-1 px-5 py-2.5 text-sm disabled:opacity-50 sm:flex-none"
                    >
                      {saving
                        ? editingId
                          ? "Updating…"
                          : "Saving…"
                        : !account
                          ? "Sign in to save"
                          : capFull
                            ? "Cap full"
                            : editingId
                              ? "Save changes"
                              : "Save My Character"}
                    </button>
                  </div>
                </div>
                {capFull && (
                  <p className="mt-2 text-[11px] text-amber-100/90">
                    Cap reached.{" "}
                    <Link href="/account#my-models" className="underline">
                      Manage models
                    </Link>
                    {!activePremium && (
                      <>
                        {" "}
                        or{" "}
                        <Link href="/account" className="underline">
                          Day Pass
                        </Link>
                      </>
                    )}
                    .
                  </p>
                )}
              </section>
            </div>

            {/* ── Live preview pane ── */}
            <aside className="lg:sticky lg:top-[4.5rem]">
              <div className="overflow-hidden rounded-2xl border border-brand-border/80 bg-black shadow-card">
                <div className="relative aspect-[3/4] sm:aspect-[4/5]">
                  <video
                    key={previewSrc}
                    src={previewSrc}
                    className="h-full w-full object-cover transition duration-500"
                    muted
                    loop
                    playsInline
                    autoPlay
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-violet-200/90">
                      Live preview · {BAND_LABEL[previewBand]}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {name.trim() || "Unnamed model"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/75">
                      {archetype || mind?.tag || "Custom mind"}
                      {clothing.trim() ? ` · ${clothing.trim().slice(0, 40)}` : ""}
                    </p>
                    {phrases[0] && (
                      <p className="mt-2 line-clamp-2 text-[12px] italic text-rose-100/90">
                        “{phrases[0]}”
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {CLIP_KEYS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setPreviewBand(k)}
                          className={`pointer-events-auto rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${
                            previewBand === k
                              ? "border-rose-300/60 bg-rose-500/40 text-white"
                              : "border-white/20 bg-black/50 text-white/70"
                          }`}
                        >
                          {BAND_LABEL[k]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 border-t border-white/10 bg-brand-panel/95 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                    Reactivity sim
                  </p>
                  <p className="text-[11px] leading-relaxed text-brand-muted">
                    Bands cycle like chat energy — idle → tease → play → edge. Assign clips so
                    each band has its own loop. Not generative video (v2.2).
                  </p>
                  {energy.trim() && (
                    <p className="line-clamp-3 rounded-lg border border-brand-border/60 bg-brand-bg/60 px-2 py-1.5 text-[10px] text-brand-muted">
                      {energy}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {vibeTags.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-violet-400/30 px-1.5 py-0.5 text-[9px] text-violet-100/90"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-brand-soft">
                    Scenes ready: {validScenes().length} · Phrases: {phrases.length} · Base:{" "}
                    {baseCard?.displayName || baseModelId}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function uniqueTags(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const k = raw.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(raw.trim());
  }
  return out.slice(0, 12);
}

/** Suspense boundary for useSearchParams */
export function ModelsStudio({ editId }: { editId?: string } = {}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center text-sm text-brand-muted">
          Opening studio…
        </main>
      }
    >
      <ModelsStudioInner initialEditId={editId} />
    </Suspense>
  );
}
