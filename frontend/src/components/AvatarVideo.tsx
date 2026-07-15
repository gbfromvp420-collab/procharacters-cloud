"use client";

import { useEffect, useState } from "react";
import {
  energyBandBadgeClass,
  energyBandFromAvatar,
  energyBandLabel,
  energyBandRingClass,
} from "@/lib/energy";
import {
  presenceMotionClass,
  presenceVisual,
  resolvePresenceSkin,
} from "@/lib/presence";
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
}

export function AvatarVideo({
  avatar,
  characterName,
  characterId = null,
  compact = false,
  pip = false,
}: AvatarVideoProps) {
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
  const [showIncoming, setShowIncoming] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  const mediaUrl = avatar?.mediaUrl ?? null;
  const fallbackUrl = avatar?.mediaFallbackUrl ?? null;
  const effectivePrimary = mediaUrl;
  const isVideo =
    (activeSrc ?? mediaUrl)?.endsWith(".mp4") ||
    (activeSrc ?? mediaUrl)?.endsWith(".webm");
  const band = energyBandFromAvatar(avatar);
  const arousalPct = Math.round((avatar?.arousalLevel ?? 0) * 100);
  const skin = resolvePresenceSkin(avatar?.presenceSkin, characterId);
  const visual = presenceVisual(skin);

  // Reset when server sends a new primary URL
  useEffect(() => {
    if (!effectivePrimary) return;
    setUsedFallback(false);
    setActiveSrc(effectivePrimary);
    setIncomingSrc(null);
    setShowIncoming(false);
  }, [effectivePrimary]);

  useEffect(() => {
    if (!mediaUrl || !activeSrc) return;
    if (mediaUrl === activeSrc) return;
    // Crossfade only when not mid-fallback recovery
    if (usedFallback) return;

    setIncomingSrc(mediaUrl);
    setShowIncoming(false);

    const frame = requestAnimationFrame(() => setShowIncoming(true));
    const timer = setTimeout(() => {
      setActiveSrc(mediaUrl);
      setIncomingSrc(null);
      setShowIncoming(false);
    }, 620);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [mediaUrl, activeSrc, usedFallback]);

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

  return (
    <div
      className={`relative w-full overflow-hidden border border-brand-border bg-brand-bg shadow-card ring-2 transition-shadow duration-500 ${frameClass} ${energyBandRingClass(band)} ${visual.glow}`}
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
          isVideo={
            !!activeSrc.endsWith(".mp4") || !!activeSrc.endsWith(".webm") || !!isVideo
          }
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
          isVideo={incomingSrc.endsWith(".mp4") || incomingSrc.endsWith(".webm")}
          visible={showIncoming}
          label={pip ? undefined : avatar ? formatLabel(avatar.emotion) : undefined}
          onError={onMediaError}
          filter={visual.filter}
          motionClass={presenceMotionClass(band)}
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
            className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide backdrop-blur-sm ${energyBandBadgeClass(band)} ${
              pip ? "px-1.5 text-[8px]" : ""
            }`}
          >
            {energyBandLabel(band)}
            {!pip && <span className="ml-1 opacity-80">{arousalPct}%</span>}
          </div>
          {!pip && (
            <div className="w-fit rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[8px] font-medium uppercase tracking-wide text-white/80 backdrop-blur-sm">
              {visual.label}
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
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-accentDim to-rose-400 transition-all duration-700"
              style={{ width: `${arousalPct}%` }}
            />
          </div>
        </div>
      )}

      {avatar && pip && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-6">
          <p className="truncate text-[10px] font-medium text-white">
            {characterName ?? "Live"}
          </p>
          <p className="truncate text-[9px] text-white/70">
            {formatLabel(avatar.emotion)} · {arousalPct}%
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
