"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AvatarState, LiveKitJoinInfo } from "@/lib/types";
import { Room, RoomEvent, Track } from "livekit-client";

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface AvatarVideoProps {
  avatar: AvatarState | null;
  characterName: string | null;
  /** Character ID used to resolve the base idle loop path */
  characterId?: string;
  /** LiveKit join info — when provided, enables live clip crossfade from room video tracks */
  livekit?: LiveKitJoinInfo | null;
}

/**
 * Resolves the base idle loop video for a character.
 * These loops live in frontend/public/avatar/{character}/idle.mp4
 */
function getBaseLoopSrc(characterId?: string): string {
  const char = characterId ?? "twink-default";
  return `/avatar/${char}/idle.mp4`;
}

export function AvatarVideo({ avatar, characterName, characterId, livekit }: AvatarVideoProps) {
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
  const [showIncoming, setShowIncoming] = useState(false);
  const [liveTrackElement, setLiveTrackElement] = useState<HTMLVideoElement | null>(null);
  const [showLiveTrack, setShowLiveTrack] = useState(false);
  const liveTrackRef = useRef<HTMLVideoElement | null>(null);
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mediaUrl = avatar?.mediaUrl ?? null;
  const isVideo = mediaUrl?.endsWith(".mp4") || mediaUrl?.endsWith(".webm");

  // Initialize base loop when session starts
  useEffect(() => {
    if (!activeSrc && characterId) {
      setActiveSrc(getBaseLoopSrc(characterId));
    }
  }, [characterId, activeSrc]);

  // Crossfade logic: base loop → clip → back to base loop
  useEffect(() => {
    if (!mediaUrl) return;

    const baseLoop = getBaseLoopSrc(characterId);

    // If the incoming clip is the same as current, skip
    if (mediaUrl === activeSrc) return;

    // If it's the base loop, just set it directly
    if (mediaUrl === baseLoop && activeSrc === baseLoop) return;

    setIncomingSrc(mediaUrl);
    setShowIncoming(false);

    const frame = requestAnimationFrame(() => setShowIncoming(true));

    // After crossfade completes, swap active and clear incoming
    const timer = setTimeout(() => {
      setActiveSrc(mediaUrl);
      setIncomingSrc(null);
      setShowIncoming(false);
    }, 600); // slightly longer for smoother crossfade

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [mediaUrl, activeSrc, characterId]);

  // LiveKit room connection — subscribe to video tracks for live clip crossfade
  const handleLiveKitTrack = useCallback((videoEl: HTMLVideoElement | null) => {
    if (!videoEl) {
      setLiveTrackElement(null);
      setShowLiveTrack(false);
      return;
    }
    setLiveTrackElement(videoEl);
    // Crossfade in the live track
    setShowLiveTrack(true);

    // When the live clip ends (track unsubscribed), fade back to base loop
    if (crossfadeTimerRef.current) clearTimeout(crossfadeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!livekit) return;

    const room = new Room({ adaptiveStream: true, dynacast: true });
    let cancelled = false;

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video && !cancelled) {
        const el = track.attach() as HTMLVideoElement;
        el.muted = true;
        el.playsInline = true;
        liveTrackRef.current = el;
        handleLiveKitTrack(el);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Video && !cancelled) {
        track.detach();
        liveTrackRef.current = null;
        handleLiveKitTrack(null);
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) {
        handleLiveKitTrack(null);
      }
    });

    room.connect(livekit.url, livekit.token).catch(() => {
      // LiveKit connection failed — fall back to WebSocket clips
    });

    return () => {
      cancelled = true;
      room.disconnect();
      if (liveTrackRef.current) {
        liveTrackRef.current = null;
      }
    };
  }, [livekit, handleLiveKitTrack]);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-brand-border bg-brand-bg">
      {/* Base idle loop — always playing underneath */}
      {activeSrc && (
        <MediaLayer
          src={activeSrc}
          isVideo={!!isVideo || activeSrc.endsWith(".mp4") || activeSrc.endsWith(".webm")}
          visible={!showIncoming && !showLiveTrack}
          label={avatar ? formatLabel(avatar.emotion) : "Base loop"}
        />
      )}

      {/* Incoming clip crossfade layer */}
      {incomingSrc && (
        <MediaLayer
          src={incomingSrc}
          isVideo={incomingSrc.endsWith(".mp4") || incomingSrc.endsWith(".webm")}
          visible={showIncoming && !showLiveTrack}
          label={avatar ? formatLabel(avatar.emotion) : undefined}
        />
      )}

      {/* LiveKit live video track layer — highest priority */}
      {liveTrackElement && (
        <LiveTrackLayer element={liveTrackElement} visible={showLiveTrack} />
      )}

      {/* Placeholder when no video at all */}
      {!activeSrc && !liveTrackElement && (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-border to-brand-accentDim opacity-60" />
          <p className="text-sm text-brand-muted">Video layer idle</p>
          <p className="text-xs text-brand-muted">Start a session to load avatar clips</p>
        </div>
      )}

      {/* Info overlay */}
      {avatar && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-sm font-medium text-white">{characterName ?? "Character"}</p>
          <p className="text-xs text-white/70">
            {formatLabel(avatar.emotion)} · {formatLabel(avatar.pose)}
            {showLiveTrack && " · 🔴 LIVE"}
          </p>
        </div>
      )}
    </div>
  );
}

/** Standard media layer (video/image with crossfade transitions) */
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
  const className = `absolute inset-0 h-full w-full object-cover transition-opacity duration-600 ease-in-out ${
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

/** LiveKit video track layer — renders an attached HTMLVideoElement */
function LiveTrackLayer({
  element,
  visible,
}: {
  element: HTMLVideoElement;
  visible: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !element) return;

    element.className = `absolute inset-0 h-full w-full object-cover transition-opacity duration-600 ease-in-out ${
      visible ? "opacity-100" : "opacity-0"
    }`;
    element.autoplay = true;
    element.playsInline = true;
    element.muted = true;

    container.appendChild(element);

    return () => {
      if (container.contains(element)) {
        container.removeChild(element);
      }
    };
  }, [element, visible]);

  return <div ref={containerRef} className="absolute inset-0" />;
}