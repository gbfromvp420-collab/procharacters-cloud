"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forgeExpandAction } from "@/app/models/studio/actions";
import { loadStoredAccount, type StoredAccount } from "@/lib/account-storage";
import {
  createCustomCharacter,
  fetchAccountMe,
  forgeExpandFantasy,
  listLiveCharacters,
  updateCustomCharacter,
  uploadCharacterClip,
  uploadCharacterClipsBatch,
} from "@/lib/api";
import { CLIP_FILE_ACCEPT } from "@/lib/clip-upload";
import {
  downloadDnaJson,
  estimateIntensity,
  FORGE_EXAMPLE_PROMPTS,
  sentimentToBand,
  type NaughtySyntaxDna,
} from "@/lib/forge-dna";
import { takeForgeHeatSeed } from "@/lib/forge-from-heat";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import type {
  CustomSceneInput,
  LiveCharacterOption,
  MediaClipKey,
} from "@/lib/types";
import { ClipPreview } from "@/components/ClipPreview";
import { ForgeAvatarComposer } from "@/components/ForgeAvatarComposer";
import { MyCharacterWinToast } from "@/components/MyCharacterWinToast";
import { SiteChrome } from "@/components/SiteChrome";

const CLIP_KEYS: MediaClipKey[] = ["idle", "teasing", "playful", "aroused"];
const BAND_LABEL: Record<MediaClipKey, string> = {
  idle: "Idle",
  teasing: "Tease",
  playful: "Play",
  aroused: "Edge",
};

/** Lean energy chips — 1-tap vibe, no long auto-fill essays. */
const ENERGY_PRESETS: Array<{
  id: string;
  label: string;
  tag: string;
  energy: string;
}> = [
  {
    id: "brat",
    label: "Brat",
    tag: "brat",
    energy: "Playful brat · tease, count games, mean-soft denial",
  },
  {
    id: "soft-dom",
    label: "Soft-dom",
    tag: "soft-dom",
    energy: "Soft-dom · slow commands, praise, deny until they beg pretty",
  },
  {
    id: "edge",
    label: "Edge",
    tag: "edging",
    energy: "Edge focus · freeze on the brink · no finish without clear beg",
  },
  {
    id: "shy",
    label: "Shy heat",
    tag: "shy",
    energy: "Shy heat · whisper, blush on praise, peek-and-hide escalate",
  },
  {
    id: "ritual",
    label: "Ritual",
    tag: "ritual",
    energy: "Ritual pace · hypnotic still moments · charged cool-downs",
  },
  {
    id: "gym",
    label: "Gym",
    tag: "sweat",
    energy: "Gym cool-down · sweat + interval holds · burn, no early finish",
  },
];

const PHRASE_SUGGESTIONS = [
  "not yet… look at me",
  "hold it — good",
  "say please",
  "slower… right there",
  "don’t finish without me",
  "tell me what you need",
];

const VISUAL_MAX = 280;
const PHRASE_MAX = 4;
const SCENE_MAX = 2;
const TAG_MAX = 2;

function clipUrlForBase(baseId: string, key: MediaClipKey): string {
  return `/avatar/${baseId}/${key}.mp4`;
}

function detectBandFromName(fileName: string): MediaClipKey | null {
  const base = fileName.toLowerCase();
  if (base.includes("idle")) return "idle";
  if (base.includes("teas") || base.includes("tease")) return "teasing";
  if (base.includes("play")) return "playful";
  if (base.includes("arous") || base.includes("edge") || base.includes("hot"))
    return "aroused";
  return null;
}

function ModelsStudioInner({ initialEditId = "" }: { initialEditId?: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const queryEdit =
    search.get("edit")?.trim() || search.get("character")?.trim() || "";
  const editId = (initialEditId || queryEdit).trim();

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

  // Slim form
  const [baseModelId, setBaseModelId] = useState("twink-default");
  const [name, setName] = useState("");
  const [appearance, setAppearance] = useState("");
  const [energy, setEnergy] = useState("");
  const [vibeTags, setVibeTags] = useState<string[]>([]);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [phraseDraft, setPhraseDraft] = useState("");
  const [scenes, setScenes] = useState<CustomSceneInput[]>([]);
  const [nsBoostOn, setNsBoostOn] = useState(false);
  const [promptBoost, setPromptBoost] = useState("");
  const [featured, setFeatured] = useState(false);
  const [clips, setClips] = useState<Partial<Record<MediaClipKey, string>>>({});
  const [localClipFiles, setLocalClipFiles] = useState<
    Partial<Record<MediaClipKey, { file: File; url: string }>>
  >({});
  /** Files that need a band — auto-detect failed or user will 1-click assign. */
  const [pendingClips, setPendingClips] = useState<
    Array<{ file: File; url: string; id: string }>
  >([]);
  const [previewBand, setPreviewBand] = useState<MediaClipKey>("teasing");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{
    id: string;
    name: string;
    starter?: string;
    forged?: boolean;
    forgeSource?: string | null;
  } | null>(null);
  const [showPromptSim, setShowPromptSim] = useState(true);

  // Studio Forge v3 Unchained
  const [fantasy, setFantasy] = useState("");
  const [forging, setForging] = useState(false);
  const [dna, setDna] = useState<NaughtySyntaxDna | null>(null);
  const [forgeMs, setForgeMs] = useState<number | null>(null);
  const [forgeSource, setForgeSource] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualBandLock, setManualBandLock] = useState(false);
  /** Heat→Forge conversion banner (from chat End / win toast). */
  const [heatSeedBanner, setHeatSeedBanner] = useState<string | null>(null);
  const heatSeedApplied = useRef(false);

  // Forge this heat — one-shot prefill fantasy + base from chat climb
  useEffect(() => {
    if (heatSeedApplied.current) return;
    if (editId) return;
    if (search.get("from") !== "heat") return;
    heatSeedApplied.current = true;
    const stashed = takeForgeHeatSeed();
    const qBase = search.get("base")?.trim();
    const qSeed = search.get("seed")?.trim();
    const qNick = search.get("nick")?.trim();
    const qDna = search.get("dna")?.trim();
    const fantasyText = stashed?.fantasy?.trim() || qSeed || "";
    if (fantasyText.length >= 8) {
      setFantasy(fantasyText);
    }
    if (stashed?.baseModelId?.trim() || qBase) {
      setBaseModelId(stashed?.baseModelId?.trim() || qBase || "twink-default");
    }
    if (qNick) {
      setName(`${qNick} DNA`.slice(0, 40));
    }
    const dnaBit = stashed?.dnaTreeLabel || stashed?.dnaTreeNodeId || qDna;
    setHeatSeedBanner(
      dnaBit
        ? `Heat seed loaded · DNA · ${dnaBit} — Forge model to lock the climb`
        : "Heat seed loaded from chat — Forge model to mint private DNA",
    );
    // Clean query so refresh doesn't re-apply empty stash
    router.replace("/models/studio", { scroll: false });
  }, [editId, search, router]);

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
    window.setTimeout(() => setFlash(null), 2400);
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

      if (!editId) {
        const first =
          list.find((c) => c.kind === "default")?.id || "twink-default";
        setBaseModelId(first);
        // No heavy auto-fill — blank canvas on purpose
      } else {
        const target = list.find((c) => c.id === editId && c.mine);
        if (target) {
          setEditingId(target.id);
          setName(target.displayName || "");
          setBaseModelId(
            target.baseModelId || target.avatarBase || "twink-default",
          );
          const rawApp = target.appearance || "";
          const boostSplit = rawApp.split(/\n\n## Naughty Syntax booster\n/i);
          setAppearance((boostSplit[0]?.trim() || rawApp).slice(0, VISUAL_MAX));
          const boost = boostSplit[1]?.trim() || "";
          setPromptBoost(boost);
          setNsBoostOn(!!boost);

          const rawEnergy = target.energy || target.energyLabel || "";
          const tagsMatch = rawEnergy.match(/Tags:\s*([^.]+)/i)?.[1];
          if (tagsMatch) {
            setVibeTags(
              uniqueTags(
                tagsMatch
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              ).slice(0, TAG_MAX),
            );
          }
          const cleanEnergy = rawEnergy
            .replace(/\s*Archetype:\s*[^.]*\.?/gi, "")
            .replace(/\s*Tags:\s*[^.]*\.?/gi, "")
            .trim();
          setEnergy(cleanEnergy || rawEnergy);
          const matched = ENERGY_PRESETS.find(
            (p) =>
              cleanEnergy.includes(p.energy.slice(0, 20)) ||
              (tagsMatch || "").includes(p.tag),
          );
          if (matched) setPresetId(matched.id);

          setPhrases((target.keyPhrases?.filter(Boolean) ?? []).slice(0, PHRASE_MAX));
          setScenes(
            target.scenes?.length
              ? target.scenes.slice(0, SCENE_MAX).map((s) => ({
                  title: s.title,
                  body: s.body,
                }))
              : [],
          );
          setFeatured(target.featured === true);
          if (target.dna) {
            setDna(target.dna);
            setFantasy(target.dna.fantasyRaw || "");
            setForgeSource(target.dna.source);
            setShowAdvanced(true);
          }
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

  // Sentiment-aware clip band from fantasy / DNA (editor immersion)
  useEffect(() => {
    if (manualBandLock) return;
    const text = fantasy.trim() || appearance.trim() || energy.trim();
    if (text.length < 4) return;
    setPreviewBand(sentimentToBand(text, dna));
  }, [fantasy, appearance, energy, dna, manualBandLock]);

  // Light band cycle for preview life when no fantasy driving sentiment
  useEffect(() => {
    if (fantasy.trim().length >= 8 || manualBandLock) return;
    const order: MediaClipKey[] = ["idle", "teasing", "playful", "aroused"];
    let i = Math.max(0, order.indexOf(previewBand));
    const t = window.setInterval(() => {
      i = (i + 1) % order.length;
      setPreviewBand(order[i]!);
    }, 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseModelId, editingId, fantasy, manualBandLock]);

  const forgeIntensity = useMemo(
    () => estimateIntensity(fantasy || appearance || energy, dna),
    [fantasy, appearance, energy, dna],
  );

  const onPickBase = (id: string) => {
    if (editingId) return;
    setBaseModelId(id);
    showFlash(`Base · video only`);
  };

  const applyPreset = (id: string) => {
    const p = ENERGY_PRESETS.find((x) => x.id === id);
    if (!p) return;
    if (presetId === id) {
      // Toggle off
      setPresetId(null);
      setEnergy("");
      setVibeTags((prev) => prev.filter((t) => t !== p.tag));
      return;
    }
    setPresetId(id);
    setEnergy(p.energy);
    setVibeTags((prev) => uniqueTags([p.tag, ...prev.filter((t) => t !== p.tag)]).slice(0, TAG_MAX));
    showFlash(p.label);
  };

  const toggleTag = (tag: string) => {
    setVibeTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= TAG_MAX) return uniqueTags([tag, ...prev]).slice(0, TAG_MAX);
      return uniqueTags([...prev, tag]);
    });
  };

  const addPhrase = (raw?: string) => {
    const p = (raw ?? phraseDraft).trim().slice(0, 120);
    if (!p || phrases.length >= PHRASE_MAX) return;
    if (phrases.some((x) => x.toLowerCase() === p.toLowerCase())) return;
    setPhrases((prev) => [...prev, p]);
    if (!raw) setPhraseDraft("");
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
    if (scenes.length >= SCENE_MAX) return;
    setScenes((prev) => [...prev, { title: "", body: "" }]);
  };

  const removeSceneSlot = (idx: number) => {
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
    let auto = 0;
    const needAssign: Array<{ file: File; url: string; id: string }> = [];
    for (const file of files) {
      const key = detectBandFromName(file.name);
      if (key) {
        onLocalClip(key, file);
        auto += 1;
      } else {
        needAssign.push({
          file,
          url: URL.createObjectURL(file),
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        });
      }
    }
    if (needAssign.length) {
      setPendingClips((prev) => [...prev, ...needAssign]);
    }
    showFlash(
      auto
        ? `Auto-banded ${auto}${needAssign.length ? ` · ${needAssign.length} to assign` : ""}`
        : `${needAssign.length} clip(s) — tap a band`,
    );
  };

  const assignPending = (pendingId: string, key: MediaClipKey) => {
    setPendingClips((prev) => {
      const item = prev.find((p) => p.id === pendingId);
      if (!item) return prev;
      onLocalClip(key, item.file);
      URL.revokeObjectURL(item.url);
      return prev.filter((p) => p.id !== pendingId);
    });
  };

  const dismissPending = (pendingId: string) => {
    setPendingClips((prev) => {
      const item = prev.find((p) => p.id === pendingId);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((p) => p.id !== pendingId);
    });
  };

  const mergeAppearance = (): string => {
    const core = appearance.trim();
    if (!nsBoostOn) return core;
    const boost = promptBoost.trim();
    if (!boost) return core;
    return `${core}\n\n## Naughty Syntax booster\n${boost}`.slice(0, 2000);
  };

  const mergeEnergy = (): string => {
    const tags = vibeTags.length ? ` Tags: ${vibeTags.join(", ")}.` : "";
    return `${energy.trim()}${tags}`.trim().slice(0, 400);
  };

  const validScenes = (): CustomSceneInput[] =>
    scenes
      .map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
      .filter((s) => s.title.length >= 2 && s.body.length >= 12)
      .slice(0, SCENE_MAX);

  /** Real-time prompt merge sim (mirrors slim server overlay). */
  const promptSim = useMemo(() => {
    const lines: string[] = [
      `# My Character — ${name.trim() || "Unnamed"}`,
      ``,
      `Consenting adult 21+. Photorealistic. Uncensored. First person live cam.`,
      ``,
      `## Identity lock (user-authored)`,
      appearance.trim() || "_(add a short visual — 1–2 sentences)_",
    ];
    if (nsBoostOn && promptBoost.trim()) {
      lines.push(``, `## Naughty Syntax booster`, promptBoost.trim());
    }
    lines.push(``, `## Energy`, mergeEnergy() || "_(pick a vibe chip or write one line)_");
    if (vibeTags.length) {
      lines.push(`Tags: ${vibeTags.join(", ")}`);
    }
    if (phrases.length) {
      lines.push(``, `## Key phrases (sparingly)`);
      for (const p of phrases) lines.push(`- “${p}”`);
    }
    const sc = validScenes();
    if (sc.length) {
      lines.push(``, `## Scene anchors`);
      sc.forEach((s, i) => lines.push(`${i + 1}. **${s.title}** — ${s.body}`));
    }
    lines.push(
      ``,
      `## Rules`,
      `- Stay in THIS identity; video base is clips only (${baseModelId})`,
      `- Escalate with user; climax only on clear ask`,
    );
    return lines.join("\n");
    // validScenes/mergeEnergy depend on form state already in deps via scenes/energy/tags
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    name,
    appearance,
    nsBoostOn,
    promptBoost,
    energy,
    vibeTags,
    phrases,
    scenes,
    baseModelId,
  ]);

  const smartStarter = useMemo(() => {
    if (dna?.starterLine) return dna.starterLine;
    if (phrases[0]) return phrases[0];
    if (vibeTags.includes("edging") || presetId === "edge")
      return "Start slow — edge me, don’t let me finish yet.";
    if (vibeTags.includes("brat") || presetId === "brat")
      return "Come tease me. Don’t make it easy.";
    if (vibeTags.includes("soft-dom") || presetId === "soft-dom")
      return "Take control. Soft, but don’t let me rush.";
    if (name.trim()) return `Hey ${name.trim().split(/\s+/)[0]} — pick up where the heat starts.`;
    return "Start heat — match my pace.";
  }, [dna, phrases, vibeTags, presetId, name]);

  const applyForgeResult = (result: {
    dna: NaughtySyntaxDna;
    form: {
      name: string;
      appearance: string;
      energy: string;
      baseModelId: string;
      keyPhrases: string[];
      scenes: Array<{ title: string; body: string }>;
    };
    expandMs?: number | null;
    source?: string;
  }) => {
    setDna(result.dna);
    setForgeMs(result.expandMs ?? result.dna.expandMs ?? null);
    setForgeSource(result.source ?? result.dna.source);
    if (!editingId && result.form.baseModelId) {
      setBaseModelId(result.form.baseModelId);
    }
    setName(result.form.name);
    setAppearance(result.form.appearance.slice(0, VISUAL_MAX));
    const tagsMatch = result.form.energy.match(/Tags:\s*([^.]+)/i)?.[1];
    if (tagsMatch) {
      setVibeTags(
        uniqueTags(
          tagsMatch
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        ).slice(0, TAG_MAX),
      );
    } else if (result.dna.vibeTags?.length) {
      setVibeTags(uniqueTags(result.dna.vibeTags).slice(0, TAG_MAX));
    }
    const cleanEnergy = result.form.energy
      .replace(/\s*Tags:\s*[^.]*\.?/gi, "")
      .trim();
    setEnergy(cleanEnergy || result.dna.vibe);
    const matched = ENERGY_PRESETS.find(
      (p) =>
        result.dna.vibeTags?.includes(p.tag) ||
        cleanEnergy.toLowerCase().includes(p.tag),
    );
    if (matched) setPresetId(matched.id);
    setPhrases((result.form.keyPhrases ?? []).slice(0, PHRASE_MAX));
    setScenes(
      (result.form.scenes ?? []).slice(0, SCENE_MAX).map((s) => ({
        title: s.title,
        body: s.body,
      })),
    );
    setManualBandLock(false);
    setPreviewBand(sentimentToBand(result.dna.fantasyRaw || result.form.appearance, result.dna));
    showFlash(
      `DNA forged · ${result.source ?? result.dna.source}${
        result.expandMs != null ? ` · ${result.expandMs}ms` : ""
      }`,
    );
  };

  const handleForge = async () => {
    const text = fantasy.trim();
    if (text.length < 8) {
      setError("Type your fantasy (min 8 chars) — name, vibe, body, kinks…");
      return;
    }
    setForging(true);
    setError(null);
    try {
      // Prefer Server Action; fall back to direct REST if action fails
      const actionResult = await forgeExpandAction({
        fantasy: text,
        baseModelId: editingId ? baseModelId : undefined,
        displayNameHint: name.trim() || undefined,
      });
      if (actionResult.ok) {
        const data = actionResult.data as {
          dna: NaughtySyntaxDna;
          form: {
            name: string;
            appearance: string;
            energy: string;
            baseModelId: string;
            keyPhrases: string[];
            scenes: Array<{ title: string; body: string }>;
          };
          expandMs?: number | null;
          source?: string;
        };
        applyForgeResult({
          dna: data.dna,
          form: data.form,
          expandMs: actionResult.expandMs ?? data.expandMs,
          source: actionResult.source ?? data.source,
        });
        return;
      }
      const rest = await forgeExpandFantasy({
        fantasy: text,
        baseModelId: editingId ? baseModelId : undefined,
        displayNameHint: name.trim() || undefined,
      });
      applyForgeResult(rest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Forge expand failed");
    } finally {
      setForging(false);
    }
  };

  const canSave =
    !!account?.token &&
    name.trim().length >= 2 &&
    appearance.trim().length >= 12 &&
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
      setError("Name (2+) and a short visual (12+ chars) required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        appearance: mergeAppearance(),
        energy: mergeEnergy() || undefined,
        // No forced clothing — identity box owns look
        clothing: undefined as string | undefined,
        baseModelId: editingId ? undefined : baseModelId,
        audience: "any" as const,
        keyPhrases: phrases.length ? phrases.slice(0, PHRASE_MAX) : undefined,
        scenes: validScenes().length ? validScenes() : undefined,
        dna: dna ?? undefined,
      };

      let id = editingId;
      let displayName = name.trim();
      const wasCreate = !editingId;

      if (editingId) {
        const updated = await updateCustomCharacter(
          editingId,
          {
            name: payload.name,
            appearance: payload.appearance,
            energy: payload.energy,
            keyPhrases: payload.keyPhrases ?? null,
            scenes: payload.scenes ?? null,
            featured,
            dna: dna ?? undefined,
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
            baseModelId,
            audience: "any",
            keyPhrases: payload.keyPhrases,
            scenes: payload.scenes,
            dna: dna ?? undefined,
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
          for (const u of up.uploaded) {
            setClips((c) => ({ ...c, [u.emotion]: u.url }));
          }
        }
        setLocalClipFiles((prev) => {
          for (const v of Object.values(prev)) {
            if (v?.url) URL.revokeObjectURL(v.url);
          }
          return {};
        });
      }

      const list = await listLiveCharacters(account.token);
      setCharacters(list);
      setJustCreated({
        id: id!,
        name: displayName,
        starter: smartStarter || dna?.starterLine || undefined,
        forged: !!dna,
        forgeSource: dna?.source ?? forgeSource,
      });
      showFlash(
        dna
          ? `${displayName} · DNA forged · Edge Pace ready`
          : `${displayName} · ready`,
      );
      if (id && wasCreate) {
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
    // Smart starter seed for chat session (sessionStorage — chat may ignore; mind already loaded)
    try {
      if (justCreated.starter) {
        sessionStorage.setItem(
          "pc_studio_starter",
          JSON.stringify({
            characterId: justCreated.id,
            starter: justCreated.starter,
            at: Date.now(),
          }),
        );
      }
    } catch {
      /* ignore */
    }
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
        title="Studio Forge"
        subtitle={
          editingId
            ? "Unchained edit · DNA + clips"
            : "Conversational forge · DNA under 5s"
        }
        className="pt-[env(safe-area-inset-top,0px)]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-200/90">
              Studio Forge · v3 Unchained · private
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-text sm:text-3xl">
              {editingId ? "Tune the god you made" : "Speak it into heat"}
            </h1>
            <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-brand-muted">
              Type the fantasy. Forge expands identity, branches, behavior tree,
              LiveKit reactivity, and memory seeds — then Chat Now.
            </p>
            {heatSeedBanner && (
              <p
                className="mt-2 max-w-xl rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-[11px] leading-relaxed text-violet-50"
                role="status"
              >
                {heatSeedBanner}
              </p>
            )}
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
                {used}/{customsLimit}
                {activePremium ? " · premium" : ""}
              </span>
            ) : (
              <Link
                href="/account"
                className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-100"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/?filter=owned"
              className="btn-ghost min-h-0 px-3 py-1.5 text-xs"
            >
              My models
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
            starterHint={justCreated.starter}
            forged={justCreated.forged === true}
            forgeSource={justCreated.forgeSource}
            onStart={() => startHeat()}
            onStartEdge={() => startHeat("edge_pace")}
            onDismiss={() => setJustCreated(null)}
          />
        )}

        {!account && !loading && (
          <div className="mb-4 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-4">
            <p className="text-sm font-medium text-brand-text">Sign in to open the studio</p>
            <p className="mt-1 text-[12px] text-brand-muted">
              Private models only. Sign in, then forge in under a minute.
            </p>
            <Link href="/account" className="btn-primary mt-3 inline-flex min-h-0 px-4 py-2 text-sm">
              Sign in
            </Link>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-brand-muted">Loading studio…</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,360px)] lg:items-start lg:gap-6">
            <div className="space-y-3">
              {/* 0 · Conversational Forge */}
              <section className="relative overflow-hidden rounded-2xl border border-rose-400/30 bg-gradient-to-br from-rose-500/10 via-brand-panel/90 to-violet-500/10 p-3 sm:p-4">
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-500/15 blur-2xl" />
                <div className="relative mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-200">
                    Conversational forge
                  </h2>
                  <span className="text-[10px] text-brand-soft">
                    LLM expand · target &lt;5s · zero censorship
                  </span>
                </div>
                <textarea
                  value={fantasy}
                  onChange={(e) => {
                    setFantasy(e.target.value.slice(0, 4000));
                    setManualBandLock(false);
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void handleForge();
                    }
                  }}
                  rows={4}
                  placeholder="Describe the avatar you can't quit — name, body, clothing, vibe, kinks, how they edge or spoil you…"
                  className="field relative w-full resize-none text-sm leading-relaxed"
                  maxLength={4000}
                  disabled={forging}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {FORGE_EXAMPLE_PROMPTS.map((ex) => (
                    <button
                      key={ex.slice(0, 24)}
                      type="button"
                      onClick={() => {
                        setFantasy(ex);
                        setManualBandLock(false);
                      }}
                      className="max-w-full truncate rounded-full border border-brand-border/70 bg-brand-bg/60 px-2.5 py-1 text-[10px] text-brand-muted transition hover:border-rose-400/40 hover:text-rose-100"
                    >
                      {ex.length > 48 ? `${ex.slice(0, 46)}…` : ex}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleForge()}
                    disabled={forging || fantasy.trim().length < 8}
                    className="btn-primary min-h-0 px-5 py-2.5 text-sm disabled:opacity-50"
                  >
                    {forging ? "Forging DNA…" : "Forge model"}
                  </button>
                  {dna && (
                    <>
                      <button
                        type="button"
                        onClick={() => downloadDnaJson(dna)}
                        className="btn-ghost min-h-0 px-3 py-2 text-xs"
                      >
                        Export DNA
                      </button>
                      <span className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-[10px] text-violet-100">
                        {forgeSource ?? dna.source}
                        {forgeMs != null ? ` · ${forgeMs}ms` : ""}
                        {" · "}
                        {dna.memorySeeds?.length ?? 0} seeds
                      </span>
                    </>
                  )}
                  <span className="text-[10px] text-brand-soft">⌘/Ctrl+Enter</span>
                </div>
                {dna && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-brand-border/50 bg-brand-bg/40 p-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-brand-muted">
                        Evolution
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-brand-text">
                        power {dna.evolution.power.toFixed(2)} · intimacy{" "}
                        {dna.evolution.intimacy.toFixed(2)} · chaos{" "}
                        {dna.evolution.chaos.toFixed(2)}
                        <br />
                        denial {dna.evolution.denial.toFixed(2)} · pace{" "}
                        {dna.evolution.pace.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand-border/50 bg-brand-bg/40 p-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-brand-muted">
                        Branches
                      </p>
                      <p className="mt-1 line-clamp-3 text-[10px] text-brand-text">
                        dark · chaotic · flirty ready
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-brand-soft">
                        {dna.adaptivePrompt.branches.flirty.slice(0, 90)}…
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand-border/50 bg-brand-bg/40 p-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-brand-muted">
                        Memory seeds
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {dna.memorySeeds.slice(0, 3).map((s) => (
                          <li
                            key={s.id}
                            className="truncate text-[10px] text-brand-text"
                            title={s.text}
                          >
                            <span className="text-rose-200/80">[{s.kind}]</span>{" "}
                            {s.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </section>

              {/* Advanced toggle — form fields after forge or manual */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="text-[11px] font-medium text-brand-accent hover:underline"
                >
                  {showAdvanced
                    ? "Hide manual fields"
                    : dna
                      ? "Tune fields · clips · booster"
                      : "Manual forge · fields without LLM"}
                </button>
                {dna && !showAdvanced && (
                  <span className="text-[10px] text-brand-soft">
                    DNA filled · save when ready
                  </span>
                )}
              </div>

              {(showAdvanced || editingId || !dna) && (
              <>
              {/* 1 · Base */}
              <section className="rounded-2xl border border-brand-border/80 bg-brand-panel/80 p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                    1 · Base (video)
                  </h2>
                  {editingId ? (
                    <span className="text-[10px] text-brand-muted">Locked</span>
                  ) : (
                    <span className="text-[10px] text-brand-soft">1-tap · no identity fill</span>
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
                        onClick={() => onPickBase(c.id)}
                        className={`snap-start shrink-0 w-[6.75rem] overflow-hidden rounded-xl border text-left transition sm:w-32 ${
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
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 2 · Quick identity */}
              <section className="rounded-2xl border border-brand-border/80 bg-brand-panel/80 p-3 sm:p-4">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                  2 · Quick identity
                </h2>
                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-wide text-brand-muted">
                    Name
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your muse…"
                    className="field w-full text-sm"
                    maxLength={80}
                    autoComplete="off"
                  />
                </label>

                <p className="mb-1.5 mt-3 text-[10px] uppercase tracking-wide text-brand-muted">
                  Vibe · pick 1 (or 2 tags)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ENERGY_PRESETS.map((p) => {
                    const on = presetId === p.id || vibeTags.includes(p.tag);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p.id)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                          on
                            ? "border-rose-400/50 bg-rose-500/20 text-rose-50"
                            : "border-brand-border bg-brand-bg text-brand-muted hover:border-brand-accent/50"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                {vibeTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {vibeTags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTag(t)}
                        className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-100"
                      >
                        {t} ×
                      </button>
                    ))}
                  </div>
                )}

                <label className="mt-3 block">
                  <span className="mb-1 block text-[10px] uppercase tracking-wide text-brand-muted">
                    Visual · 1–2 sentences
                  </span>
                  <textarea
                    value={appearance}
                    onChange={(e) => setAppearance(e.target.value.slice(0, VISUAL_MAX))}
                    rows={3}
                    placeholder="Who they look like in the room — body, hair, outfit vibe. Keep it short; identity wins over base video."
                    className="field w-full resize-none text-sm leading-relaxed"
                    maxLength={VISUAL_MAX}
                  />
                  <span className="mt-0.5 block text-[10px] text-brand-soft">
                    {appearance.trim().length}/{VISUAL_MAX} · min 12
                  </span>
                </label>
              </section>

              {/* 3 · Phrases */}
              <section className="rounded-2xl border border-brand-border/80 bg-brand-panel/80 p-3 sm:p-4">
                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                  3 · Key phrases
                </h2>
                <p className="mb-2 text-[11px] text-brand-muted">
                  Optional · max {PHRASE_MAX}. Tap a suggestion or type your own — nothing forced.
                </p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {PHRASE_SUGGESTIONS.map((s) => {
                    const usedPhrase = phrases.some(
                      (p) => p.toLowerCase() === s.toLowerCase(),
                    );
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={usedPhrase || phrases.length >= PHRASE_MAX}
                        onClick={() => addPhrase(s)}
                        className="rounded-full border border-brand-border bg-brand-bg px-2 py-0.5 text-[10px] text-brand-muted transition hover:border-rose-400/40 hover:text-rose-100 disabled:opacity-35"
                      >
                        + {s}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {phrases.map((p, i) => (
                    <button
                      key={`${p}-${i}`}
                      type="button"
                      onClick={() => setPhrases((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-50"
                    >
                      “{p.length > 32 ? `${p.slice(0, 30)}…` : p}” ×
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
                    placeholder="Your line…"
                    className="field min-w-0 flex-1 text-sm"
                    disabled={phrases.length >= PHRASE_MAX}
                  />
                  <button
                    type="button"
                    onClick={() => addPhrase()}
                    disabled={phrases.length >= PHRASE_MAX}
                    className="btn-ghost min-h-0 px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </section>

              {/* 4 · Scenes optional */}
              <section className="rounded-2xl border border-brand-border/80 bg-brand-panel/80 p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                    4 · Scenes
                  </h2>
                  <button
                    type="button"
                    onClick={addSceneSlot}
                    disabled={scenes.length >= SCENE_MAX}
                    className="text-[11px] text-brand-accent hover:underline disabled:opacity-40"
                  >
                    {scenes.length === 0 ? "+ Add scene (optional)" : `+ Scene (${scenes.length}/${SCENE_MAX})`}
                  </button>
                </div>
                {scenes.length === 0 ? (
                  <p className="text-[11px] text-brand-muted">
                    Skip if you want — vibe + visual is enough to chat.
                  </p>
                ) : (
                  <div className="space-y-2">
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
                            Remove
                          </button>
                        </div>
                        <input
                          value={s.title}
                          onChange={(e) => updateScene(idx, "title", e.target.value)}
                          placeholder="Title"
                          className="field mb-1.5 w-full text-xs"
                          maxLength={80}
                        />
                        <textarea
                          value={s.body}
                          onChange={(e) => updateScene(idx, "body", e.target.value)}
                          placeholder="Short beat + one line of dialogue"
                          rows={2}
                          className="field w-full resize-none text-xs leading-relaxed"
                          maxLength={400}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 5 · Clips */}
              <section className="rounded-2xl border border-brand-border/80 bg-brand-panel/80 p-3 sm:p-4">
                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                  5 · Clips
                </h2>
                <p className="mb-2 text-[11px] text-brand-muted">
                  Drop files — auto-band from filename, or 1-click assign. Uploads after save.
                </p>
                <label className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-violet-400/40 bg-violet-500/5 px-3 py-3 text-center transition hover:border-violet-400/70">
                  <span className="text-sm font-medium text-brand-text">Upload clips</span>
                  <span className="text-[11px] text-brand-muted">
                    idle / teasing / playful / aroused in name · MP4/WebM
                  </span>
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

                {pendingClips.length > 0 && (
                  <div className="mb-3 space-y-2 rounded-xl border border-amber-400/30 bg-amber-500/5 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-100/90">
                      Assign band
                    </p>
                    {pendingClips.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center gap-1.5 border-b border-brand-border/40 pb-2 last:border-0 last:pb-0"
                      >
                        <span className="min-w-0 flex-1 truncate text-[11px] text-brand-text">
                          {p.file.name}
                        </span>
                        {CLIP_KEYS.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => assignPending(p.id, k)}
                            className="rounded-full border border-brand-border px-2 py-0.5 text-[9px] font-semibold uppercase text-brand-muted hover:border-rose-400/50 hover:text-rose-100"
                          >
                            {BAND_LABEL[k]}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => dismissPending(p.id)}
                          className="text-[10px] text-brand-soft hover:text-rose-200"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CLIP_KEYS.map((key) => {
                    const local = localClipFiles[key]?.url;
                    const src =
                      local ||
                      clips[key] ||
                      baseCard?.clips?.[key] ||
                      clipUrlForBase(baseModelId, key);
                    const custom = !!(local || clips[key]);
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-brand-muted">
                            {BAND_LABEL[key]}
                            {custom ? " · yours" : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewBand(key)}
                            className={`text-[9px] ${
                              previewBand === key ? "text-rose-200" : "text-brand-soft"
                            }`}
                          >
                            ▶
                          </button>
                        </div>
                        <ClipPreview src={src} label={key} />
                        <label className="btn-ghost flex min-h-0 cursor-pointer items-center justify-center px-1 py-1 text-[9px]">
                          {local ? "Replace" : "Assign"}
                          <input
                            type="file"
                            accept={CLIP_FILE_ACCEPT}
                            className="hidden"
                            onChange={(e) => {
                              onLocalClip(key, e.target.files?.[0] ?? null);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 6 · NS booster toggle */}
              <section className="rounded-2xl border border-violet-400/25 bg-violet-500/5 p-3 sm:p-4">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={nsBoostOn}
                    onChange={(e) => setNsBoostOn(e.target.checked)}
                    className="mt-0.5 rounded border-brand-border"
                  />
                  <span>
                    <span className="block text-[12px] font-medium text-violet-100">
                      Naughty Syntax booster
                    </span>
                    <span className="mt-0.5 block text-[11px] text-brand-muted">
                      One slim overlay — filthy specificity without rewriting identity.
                    </span>
                  </span>
                </label>
                {nsBoostOn && (
                  <textarea
                    value={promptBoost}
                    onChange={(e) => setPromptBoost(e.target.value.slice(0, 400))}
                    rows={2}
                    placeholder="e.g. sheer fabric physics · deny climax · soft Spanish optional"
                    className="field mt-2 w-full resize-none text-sm leading-relaxed"
                    maxLength={400}
                  />
                )}
              </section>

              {/* Save bar */}
              <section className="sticky bottom-0 z-20 -mx-3 border-t border-brand-border/80 bg-brand-bg/95 px-3 py-3 backdrop-blur-md sm:static sm:mx-0 sm:rounded-2xl sm:border sm:border-brand-border/80 sm:bg-brand-panel/90 sm:px-4 sm:py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-[12px] text-brand-muted">
                    <input
                      type="checkbox"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                      className="rounded border-brand-border"
                    />
                    Soft Featured
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
                          ? "Saving…"
                          : "Forging…"
                        : !account
                          ? "Sign in to save"
                          : capFull
                            ? "Cap full"
                            : editingId
                              ? "Save · Chat ready"
                              : "Save · Chat Now"}
                    </button>
                  </div>
                </div>
                {capFull && (
                  <p className="mt-2 text-[11px] text-amber-100/90">
                    Cap reached.{" "}
                    <Link href="/account#my-models" className="underline">
                      Manage models
                    </Link>
                    .
                  </p>
                )}
              </section>
              </>
              )}

              {/* Always-visible save when DNA forged without advanced open */}
              {dna && !showAdvanced && !editingId && (
                <section className="sticky bottom-0 z-20 -mx-3 border-t border-brand-border/80 bg-brand-bg/95 px-3 py-3 backdrop-blur-md sm:static sm:mx-0 sm:rounded-2xl sm:border sm:border-brand-border/80 sm:bg-brand-panel/90 sm:px-4 sm:py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={!canSave}
                      className="btn-primary min-h-0 flex-1 px-5 py-2.5 text-sm disabled:opacity-50"
                    >
                      {saving ? "Forging…" : !account ? "Sign in to save" : "Save DNA · Chat Now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadDnaJson(dna)}
                      className="btn-ghost min-h-0 px-3 py-2 text-xs"
                    >
                      Export
                    </button>
                  </div>
                </section>
              )}
            </div>

            {/* Live preview + prompt sim + canvas composer */}
            <aside className="lg:sticky lg:top-[4.5rem] space-y-3">
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
                  <ForgeAvatarComposer
                    band={previewBand}
                    intensity={forgeIntensity}
                    dna={dna}
                  />
                  <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 z-[3] p-3 sm:p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-violet-200/90">
                      Live · {BAND_LABEL[previewBand]}
                      {fantasy.trim().length >= 8 ? " · sentiment" : ""}
                      {dna ? " · DNA" : ""}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {name.trim() || "Unnamed"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/75">
                      {ENERGY_PRESETS.find((p) => p.id === presetId)?.label ||
                        vibeTags[0] ||
                        mind?.tag ||
                        "Custom mind"}
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
                          onClick={() => {
                            setManualBandLock(true);
                            setPreviewBand(k);
                          }}
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                      {dna ? "DNA prompt core · live" : "Prompt merge · live"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowPromptSim((v) => !v)}
                      className="text-[10px] text-brand-accent hover:underline"
                    >
                      {showPromptSim ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showPromptSim && (
                    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-brand-border/60 bg-brand-bg/80 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-brand-muted">
                      {dna?.adaptivePrompt?.core || promptSim}
                    </pre>
                  )}
                  {dna && (
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(dna.adaptivePrompt.branches) as Array<
                        keyof typeof dna.adaptivePrompt.branches
                      >).map((b) => (
                        <span
                          key={b}
                          className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-rose-100/90"
                          title={dna.adaptivePrompt.branches[b]}
                        >
                          {b}
                        </span>
                      ))}
                      <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[9px] text-violet-100/90">
                        tree:{dna.behaviorTree.rootId}
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] text-brand-soft">
                    Phrases {phrases.length}/{PHRASE_MAX} · Scenes {validScenes().length}/
                    {SCENE_MAX} · Base clips: {baseCard?.displayName || baseModelId}
                    {dna ? ` · intensity ${(forgeIntensity * 100).toFixed(0)}%` : ""}
                  </p>
                  {canSave && (
                    <p className="rounded-lg border border-violet-400/25 bg-violet-500/10 px-2 py-1.5 text-[10px] text-violet-100/90">
                      After save → <strong>Chat Now</strong>
                      {smartStarter ? ` · “${smartStarter.slice(0, 48)}${smartStarter.length > 48 ? "…" : ""}”` : ""}
                    </p>
                  )}
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
  return out.slice(0, TAG_MAX);
}

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
