"use client";

import { useEffect, useState } from "react";
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
}

export function AvatarVideo({ avatar, characterName }: AvatarVideoProps) {
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
  const [showIncoming, setShowIncoming] = useState(false);

  const mediaUrl = avatar?.mediaUrl ?? null;
  const isVideo = mediaUrl?.endsWith(".mp4") || mediaUrl?.endsWith(".webm");

  useEffect(() => {
    if (!mediaUrl) return;

    if (!activeSrc) {
      setActiveSrc(mediaUrl);
      return;
    }

    if (mediaUrl === activeSrc) return;

    setIncomingSrc(mediaUrl);
    setShowIncoming(false);

    const frame = requestAnimationFrame(() => setShowIncoming(true));
    const timer = setTimeout(() => {
      setActiveSrc(mediaUrl);
      setIncomingSrc(null);
      setShowIncoming(false);
    }, 500);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [mediaUrl, activeSrc]);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-brand-border bg-brand-bg">
      {!activeSrc && (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-border to-brand-accentDim opacity-60" />
          <p className="text-sm text-brand-muted">Video layer idle</p>
          <p className="text-xs text-brand-muted">Start a session to load avatar clips</p>
        </div>
      )}

      {activeSrc && (
        <MediaLayer
          src={activeSrc}
          isVideo={!!isVideo}
          visible={!showIncoming}
          label={avatar ? formatLabel(avatar.emotion) : undefined}
        />
      )}

      {incomingSrc && (
        <MediaLayer
          src={incomingSrc}
          isVideo={incomingSrc.endsWith(".mp4") || incomingSrc.endsWith(".webm")}
          visible={showIncoming}
          label={avatar ? formatLabel(avatar.emotion) : undefined}
        />
      )}

      {avatar && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-sm font-medium text-white">{characterName ?? "Character"}</p>
          <p className="text-xs text-white/70">
            {formatLabel(avatar.emotion)} · {formatLabel(avatar.pose)}
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
}: {
  src: string;
  isVideo: boolean;
  visible: boolean;
  label?: string;
}) {
  const className = `absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
    visible ? "opacity-100" : "opacity-0"
  }`;

  if (isVideo) {
    return (
      <video
        key={src}
        src={src}
        className={className}
        autoPlay
        loop
        muted
        playsInline
        aria-label={label}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={src} src={src} alt={label ?? "Avatar state"} className={className} />
  );
}