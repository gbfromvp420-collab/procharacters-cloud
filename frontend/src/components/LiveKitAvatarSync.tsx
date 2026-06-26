"use client";

import { useEffect, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import type { AvatarState, LiveKitJoinInfo } from "@/lib/types";

interface LiveKitAvatarSyncProps {
  livekit: LiveKitJoinInfo | null;
  onAvatarSync: (avatar: AvatarState) => void;
}

export function LiveKitAvatarSync({ livekit, onAvatarSync }: LiveKitAvatarSyncProps) {
  const [status, setStatus] = useState<"off" | "connecting" | "connected" | "error">("off");

  useEffect(() => {
    if (!livekit) {
      setStatus("off");
      return;
    }

    const room = new Room({ adaptiveStream: true, dynacast: true });
    let cancelled = false;

    const handleMetadata = (metadata: string | undefined) => {
      if (!metadata) return;

      try {
        const parsed = JSON.parse(metadata) as { avatar?: AvatarState };
        if (parsed.avatar) {
          onAvatarSync(parsed.avatar);
        }
      } catch {
        // ignore malformed metadata
      }
    };

    room.on(RoomEvent.Connected, () => {
      if (!cancelled) setStatus("connected");
      handleMetadata(room.metadata);
    });

    room.on(RoomEvent.RoomMetadataChanged, handleMetadata);

    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) setStatus("off");
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