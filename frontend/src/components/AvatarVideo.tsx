"use client";

import { useEffect, useRef, useState } from "react";
import {
  dnaAvatarRingClass,
  dnaNodeShortLabel,
  dnaTreeHeatLevel,
  energyBandBadgeClass,
  energyBandFromAvatar,
  energyBandLabel,
  energyBandRingClass,
  type EnergyBand,
} from "@/lib/energy";
import { presenceMotionClass, presenceVisual, resolvePresenceSkin } from "@/lib/presence";
import { genVideoChipLabel, type GenVideoOverlayState } from "@/lib/gen-video";
import type { AvatarState } from "@/lib/types";

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface AvatarVideoProps {
  avatar: AvatarState | null;
  characterName: string | null;
  /** Active live character id — used for presence grade fallback */
  characterId?: string | null;
  /** Tighter frame for mobile / side-by-side layouts */
  compact?: boolean;
  /** Floating picture-in-picture mini player */
  pip?: boolean;
  /** Studio Forge DNA node — sexy frame heat */
  dnaTreeNodeId?: string | null;
  dnaTreeLabel?: string | null;
  /** Opt-in gen-video overlay. Loops stay the base layer. */
  genOverlay?: GenVideoOverlayState | null;
}

const CROSSFADE_MS = 620;

export function AvatarVideo({
  avatar,
  characterName,
  characterId = null,
  compact = false,
  pip = false,
  dnaTreeNodeId = null,
  dnaTreeLabel = null,
  genOverlay = null,
}: AvatarVideoProps) {
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
  const [showIncoming, setShowIncoming] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [bandPulse, setBandPulse] = useState(false);
  const [dnaPulse, setDnaPulse] = useState(false);
  const prevBandRef = useRef<EnergyBand | null>(null);
  const prevDnaRef = useRef<string | null>(null);
  const crossfadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mediaUrl = avatar?.mediaUrl ?? null;
  const fallbackUrl = avatar?.mediaFallbackUrl ?? null;
  const band = energyBandFromAvatar(avatar);
  const arousalPct = Math.round((avatar?.arousalLevel ?? 0) * 100);
  const skin = resolvePresenceSkin(avatar?.presenceSkin, characterId);
  const visual = presenceVisual(skin);
  const dnaLevel = dnaTreeHeatLevel(dnaTreeNodeId, dnaTreeLabel);
  const dnaShort = dnaNodeShortLabel(dnaTreeNodeId, dnaTreeLabel);
  const dnaRing = dnaAvatarRingClass(dnaTreeNodeId, dnaTreeLabel);
  const genChip = genVideoChipLabel(
    genOverlay ?? {
      optedIn: false,
      status: "idle",
      provider: null,
      videoUrl: null,
      playable: false,
    },
  );
  const genPlayable = genOverlay?.playable && genOverlay.videoUrl ? genOverlay.videoUrl : null;

  // Smooth crossfade on primary URL change (do not hard-reset activeSrc).
  useEffect(() => {
    if (!mediaUrl) return;

    if (!activeSrc) {
      setUsedFallback(false);
      setActiveSrc(mediaUrl);
      setIncomingSrc(null);
      setShowIncoming(false);
      return;
    }

    if (mediaUrl === activeSrc) {
      // Recovered primary after a failed fallback attempt
      if (usedFallback) setUsedFallback(false);
      return;
    }

    // Mid-fallback: only jump when primary fails again is handled by onMediaError
    if (usedFallback && mediaUrl === fallbackUrl) return;

    setUsedFallback(false);
    setIncomingSrc(mediaUrl);
    setShowIncoming(false);

    const frame = requestAnimationFrame(() => setShowIncoming(true));
    if (crossfadeTimer.current) clearTimeout(crossfadeTimer.current);
    crossfadeTimer.current = setTimeout(() => {
      setActiveSrc(mediaUrl);
      setIncomingSrc(null);
      setShowIncoming(false);
      crossfadeTimer.current = null;
    }, CROSSFADE_MS);

    return () => {
      cancelAnimationFrame(frame);
      if (crossfadeTimer.current) {
        clearTimeout(crossfadeTimer.current);
        crossfadeTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to mediaUrl; activeSrc is transition state
  }, [mediaUrl]);

  // Pulse ring when energy band changes (reactivity feedback without clip thrash).
  useEffect(() => {
    if (!avatar) return;
    if (prevBandRef.current === null) {
      prevBandRef.current = band;
      return;
    }
    if (prevBandRef.current === band) return;
    prevBandRef.current = band;
    setBandPulse(true);
    const t = setTimeout(() => setBandPulse(false), 700);
    return () => clearTimeout(t);
  }, [band, avatar]);

  // Sexier DNA climb pulse — tree node advance lights the frame
  useEffect(() => {
    const node = dnaTreeNodeId?.trim() || null;
    if (!node) {
      prevDnaRef.current = null;
      return;
    }
    if (prevDnaRef.current === null) {
      prevDnaRef.current = node;
      return;
    }
    if (prevDnaRef.current === node) return;
    prevDnaRef.current = node;
    setDnaPulse(true);
    const t = setTimeout(() => setDnaPulse(false), 1100);
    return () => clearTimeout(t);
  }, [dnaTreeNodeId]);

  const onMediaError = () => {
    if (fallbackUrl && !usedFallback && activeSrc !== fallbackUrl) {
      setUsedFallback(true);
      setActiveSrc(fallbackUrl);
      setIncomingSrc(null);
      setShowIncoming(false);
    }
  };

  const frameClass = pip
    ? "aspect-[3/4] w-full rounded-2xl border-brand-accent/40 shadow-glow-sm"
    : compact
      ? "aspect-[4/5] max-h-48 sm:max-h-none sm:aspect-[3/4] rounded-xl"
      : "aspect-[3/4] rounded-xl";

  const isVideoSrc = (src: string | null) =>
    !!src && (src.endsWith(".mp4") || src.endsWith(".webm"));

  // Deeper heat → richer outer glow (arousal drives intensity, band drives color)
  const arousalGlow =
    arousalPct >= 75
      ? "shadow-[0_0_36px_-4px_rgba(251,113,133,0.55)]"
      : arousalPct >= 50
        ? "shadow-[0_0_28px_-6px_rgba(225,29,143,0.4)]"
        : arousalPct >= 30
          ? "shadow-[0_0_20px_-8px_rgba(225,29,143,0.28)]"
          : "";

  const ringClass = dnaRing || energyBandRingClass(band);

  return (
    <div
      className={`relative w-full overflow-hidden border border-brand-border bg-brand-bg shadow-card ring-2 transition-shadow duration-700 ${frameClass} ${ringClass} ${visual.glow} ${arousalGlow} ${
        dnaPulse ? "avatar-dna-pulse" : bandPulse ? "avatar-band-pulse" : ""
      } ${dnaLevel >= 3 ? "dna-avatar-hot" : dnaLevel >= 0 ? "dna-avatar-live" : ""}`}
    >
      {!activeSrc && (
        <div
          className={`flex h-full flex-col items-center justify-center gap-1 text-center ${
            pip ? "p-2" : "gap-2 p-4 sm:p-6"
          }`}
        >
          <div
            className={`rounded-full bg-gradient-to-br from-brand-border to-brand-accentDim opacity-60 ${
              pip ? "h-8 w-8" : "h-12 w-12 sm:h-16 sm:w-16"
            }`}
          />
          {!pip && <p className="text-sm text-brand-muted">Video layer idle</p>}
          {!compact && !pip && (
            <p className="text-xs text-brand-muted">Start a session to load avatar clips</p>
          )}
          {pip && <p className="text-[10px] text-brand-muted">Idle</p>}
        </div>
      )}

      {activeSrc && (
        <MediaLayer
          src={activeSrc}
          isVideo={isVideoSrc(activeSrc)}
          visible={!showIncoming}
          label={pip ? undefined : avatar ? formatLabel(avatar.emotion) : undefined}
          onError={onMediaError}
          filter={visual.filter}
          motionClass={presenceMotionClass(band)}
        />
      )}

      {incomingSrc && (
        <MediaLayer
          src={incomingSrc}
          isVideo={isVideoSrc(incomingSrc)}
          visible={showIncoming}
          label={pip ? undefined : avatar ? formatLabel(avatar.emotion) : undefined}
          onError={onMediaError}
          filter={visual.filter}
          motionClass={presenceMotionClass(band)}
        />
      )}

      {genPlayable && !pip && (
        <MediaLayer
          src={genPlayable}
          isVideo={isVideoSrc(genPlayable) || genPlayable.includes(".mp4")}
          visible
          label="Generative overlay"
          filter={visual.filter}
        />
      )}

      {/* Presence color wash — distinguishes models that share base footage */}
      {activeSrc && (
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${visual.wash} transition-opacity duration-700`}
          aria-hidden
        />
      )}

      {avatar && (
        <div
          className={`absolute left-2 top-2 z-10 flex flex-col gap-1 ${
            pip ? "left-1.5 top-1.5" : ""
          }`}
        >
          <div
            className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide backdrop-blur-sm transition-transform duration-300 ${energyBandBadgeClass(band)} ${
              pip ? "px-1.5 text-[8px]" : ""
            } ${bandPulse || dnaPulse ? "scale-110" : "scale-100"}`}
          >
            {energyBandLabel(band)}
            {!pip && <span className="ml-1 opacity-80">{arousalPct}%</span>}
          </div>
          {dnaShort && (
            <div
              className={`w-fit rounded-full border border-violet-300/55 bg-violet-500/35 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-violet-50 backdrop-blur-sm ${
                pip ? "px-1.5 text-[7px]" : ""
              } ${dnaPulse ? "scale-110 ring-1 ring-violet-200/60" : ""}`}
            >
              DNA · {dnaShort}
              {dnaLevel >= 3 && !pip ? " · hot" : ""}
            </div>
          )}
          {!pip && (
            <div className="w-fit rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[8px] font-medium uppercase tracking-wide text-white/80 backdrop-blur-sm">
              {visual.label}
            </div>
          )}
          {genChip && !pip && (
            <div className="w-fit rounded-full border border-emerald-300/50 bg-emerald-500/30 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-emerald-50 backdrop-blur-sm">
              {genChip}
            </div>
          )}
        </div>
      )}

      {avatar && !pip && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-sm font-medium text-white">{characterName ?? "Character"}</p>
          <p className="text-xs text-white/70">
            {formatLabel(avatar.emotion)} · {formatLabel(avatar.pose)}
            {avatar.action ? ` · ${formatLabel(avatar.action)}` : ""}
            {dnaShort ? ` · DNA ${dnaShort}` : ""}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${
                dnaLevel >= 3
                  ? "from-violet-400 via-rose-400 to-amber-300"
                  : arousalPct >= 72
                    ? "from-rose-400 via-fuchsia-400 to-amber-300"
                    : "from-brand-accentDim to-rose-400"
              }`}
              style={{ width: `${Math.max(arousalPct, dnaLevel >= 0 ? 28 + dnaLevel * 12 : 0)}%` }}
            />
          </div>
        </div>
      )}

      {avatar && pip && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-6">
          <p className="truncate text-[10px] font-medium text-white">{characterName ?? "Live"}</p>
          <p className="truncate text-[9px] text-white/70">
            {dnaShort
              ? `DNA · ${dnaShort} · ${arousalPct}%`
              : `${formatLabel(avatar.emotion)} · ${arousalPct}%`}
          </p>
        </div>
      )}
    </div>
  );
}

function MediaLayer({
  src,
  isVideo,
  visible,
  label,
  onError,
  filter,
  motionClass,
}: {
  src: string;
  isVideo: boolean;
  visible: boolean;
  label?: string;
  onError?: () => void;
  filter?: string;
  motionClass?: string;
}) {
  const className = `absolute inset-0 h-full w-full object-cover transition-all ease-out ${
    visible ? "opacity-100" : "opacity-0"
  } ${motionClass ?? "scale-100 duration-700"}`;

  if (isVideo) {
    return (
      <video
        key={src}
        src={src}
        className={className}
        style={filter ? { filter } : undefined}
        autoPlay
        loop
        muted
        playsInline
        aria-label={label}
        onError={() => onError?.()}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={label ?? "Avatar state"}
      className={className}
      style={filter ? { filter } : undefined}
      onError={() => onError?.()}
    />
  );
}
