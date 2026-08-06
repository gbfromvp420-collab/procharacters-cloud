"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type LiveKitHealth = {
  configured: boolean;
  url: string | null;
};

type BadgeState = "loading" | "off" | "ready" | "live" | "error";

/**
 * Ops / product badge: shows LiveKit configuration + optional live room status.
 */
export function LiveKitBadge({
  roomStatus,
  compact = false,
}: {
  /** From LiveKitAvatarSync: off | connecting | connected | error */
  roomStatus?: "off" | "connecting" | "connected" | "error";
  compact?: boolean;
}) {
  const [health, setHealth] = useState<LiveKitHealth | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then((data: { livekit?: LiveKitHealth }) => {
        if (!cancelled && data.livekit) {
          setHealth({
            configured: !!data.livekit.configured,
            url: data.livekit.url ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setHealth({ configured: false, url: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const state: BadgeState = !health
    ? "loading"
    : !health.configured
      ? "off"
      : roomStatus === "connected"
        ? "live"
        : roomStatus === "error"
          ? "error"
          : roomStatus === "connecting"
            ? "ready"
            : "ready";

  const label =
    state === "loading"
      ? "LiveKit…"
      : state === "off"
        ? "LiveKit off"
        : state === "live"
          ? "LiveKit live"
          : state === "error"
            ? "LiveKit err"
            : "LiveKit ready";

  const cls =
    state === "live"
      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
      : state === "error"
        ? "border-red-400/40 bg-red-500/10 text-red-200"
        : state === "ready"
          ? "border-sky-400/40 bg-sky-500/10 text-sky-100"
          : "border-brand-border bg-brand-bg/70 text-brand-muted";

  const title =
    state === "off"
      ? "LiveKit not configured on API — WebSocket avatar only"
      : state === "live"
        ? `Room synced${health?.url ? ` · ${health.url}` : ""}`
        : state === "ready"
          ? "LiveKit configured — joins room when session has tokens"
          : state === "error"
            ? "LiveKit connect failed — using WebSocket fallback"
            : "Checking LiveKit…";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls} ${
        compact ? "px-1.5 text-[9px]" : ""
      }`}
      title={title}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          state === "live"
            ? "animate-pulse bg-emerald-300"
            : state === "ready"
              ? "bg-sky-300"
              : state === "error"
                ? "bg-red-300"
                : "bg-brand-muted"
        }`}
      />
      {label}
    </span>
  );
}
