"use client";

import { useEffect, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import type { AvatarState, LiveKitJoinInfo } from "@/lib/types";

interface LiveKitAvatarSyncProps {
  livekit: LiveKitJoinInfo | null;
  onAvatarSync: (avatar: AvatarState) => void;
  /** Report room status for ops badge. */
  onStatusChange?: (status: "off" | "connecting" | "connected" | "error") => void;
}

type RoomMeta = {
  avatar?: AvatarState;
  updatedAt?: number;
};

function parseAvatarFromMetadata(metadata: string | undefined): AvatarState | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as RoomMeta;
    if (!parsed?.avatar || typeof parsed.avatar !== "object") return null;
    const updatedAt =
      typeof parsed.avatar.updatedAt === "number"
        ? parsed.avatar.updatedAt
        : typeof parsed.updatedAt === "number"
          ? parsed.updatedAt
          : Date.now();
    return { ...parsed.avatar, updatedAt };
  } catch {
    return null;
  }
}

export function LiveKitAvatarSync({
  livekit,
  onAvatarSync,
  onStatusChange,
}: LiveKitAvatarSyncProps) {
  const [status, setStatus] = useState<"off" | "connecting" | "connected" | "error">("off");

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    if (!livekit) {
      setStatus("off");
      return;
    }

    const room = new Room({ adaptiveStream: true, dynacast: true });
    let cancelled = false;
    /** Last applied LiveKit metadata clock — drop out-of-order room events. */
    let lastMetaAt = 0;

    const handleMetadata = (metadata: string | undefined) => {
      const avatar = parseAvatarFromMetadata(metadata);
      if (!avatar) return;
      const ts = avatar.updatedAt ?? 0;
      if (ts && ts < lastMetaAt) return;
      if (ts) lastMetaAt = ts;
      onAvatarSync(avatar);
    };

    room.on(RoomEvent.Connected, () => {
      if (!cancelled) setStatus("connected");
      handleMetadata(room.metadata);
    });

    room.on(RoomEvent.RoomMetadataChanged, handleMetadata);

    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) setStatus("off");
    });

    room.on(RoomEvent.Reconnecting, () => {
      if (!cancelled) setStatus("connecting");
    });

    room.on(RoomEvent.Reconnected, () => {
      if (!cancelled) setStatus("connected");
      handleMetadata(room.metadata);
    });

    setStatus("connecting");

    room
      .connect(livekit.url, livekit.token)
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      room.disconnect();
    };
  }, [livekit, onAvatarSync]);

  if (!livekit) return null;

  return (
    <p className="text-xs text-brand-muted">
      LiveKit:{" "}
      {status === "connected"
        ? "room synced"
        : status === "connecting"
          ? "joining room…"
          : status === "error"
            ? "connection failed (using WebSocket fallback)"
            : "disconnected"}
    </p>
  );
}
