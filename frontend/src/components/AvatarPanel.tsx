import {
  energyBandFromAvatar,
  energyBandLabel,
  energyBandBadgeClass,
} from "@/lib/energy";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import type { AvatarState } from "@/lib/types";

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function arousalTone(level: number): string {
  if (level >= 0.75) return "from-brand-accent to-rose-500";
  if (level >= 0.45) return "from-brand-accentDim to-brand-accent";
  return "from-brand-border to-brand-accentDim";
}

interface AvatarPanelProps {
  characterName: string | null;
  characterId: string | null;
  avatar: AvatarState | null;
  status: "idle" | "connecting" | "ready" | "error" | "ended";
}

export function AvatarPanel({ characterName, characterId, avatar, status }: AvatarPanelProps) {
  const initial = characterName?.charAt(0) ?? "?";
  const arousalPct = Math.round((avatar?.arousalLevel ?? 0) * 100);
  const band = energyBandFromAvatar(avatar);
  const mind = mindFingerprint(characterId);

  return (
    <aside className="flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-panel/90 p-3 shadow-card backdrop-blur-sm sm:gap-4 sm:p-4 lg:min-w-[240px]">
      <div className="flex items-center gap-3">
        <div
          className={`avatar-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-base font-semibold text-white sm:h-14 sm:w-14 sm:text-lg ${
            avatar ? arousalTone(avatar.arousalLevel) : "from-brand-border to-brand-accentDim"
          }`}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-brand-text sm:text-base">
            {characterName ?? "No character"}
          </p>
          <p className="truncate text-[11px] text-brand-muted sm:text-xs">
            {mind
              ? mind.tag
              : characterId
                ? formatLabel(characterId)
                : "Start a session"}
            {avatar ? ` · ${formatLabel(avatar.emotion)}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {mind && (
              <span className="inline-flex rounded-full border border-brand-accent/35 bg-brand-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-accent">
                Mind
              </span>
            )}
            {avatar && (
              <span
                className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${energyBandBadgeClass(band)}`}
              >
                {energyBandLabel(band)} energy
              </span>
            )}
          </div>
        </div>
        {avatar && (
          <div className="hidden w-16 shrink-0 sm:block lg:hidden">
            <div className="mb-0.5 flex justify-between text-[9px] uppercase text-brand-muted">
              <span>Arousal</span>
              <span>{arousalPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-brand-bg">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-accentDim to-brand-accent transition-all duration-700"
                style={{ width: `${arousalPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {status === "connecting" && (
        <p className="text-xs text-brand-muted animate-pulse">
          {characterName ? `Opening ${characterName}…` : "Connecting to live session…"}
        </p>
      )}

      {mind && (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-brand-muted">
          {mind.blurb}
          {mind.bilingual ? " · soft ES" : ""}
        </p>
      )}

      {avatar ? (
        <div className="space-y-3 text-sm max-sm:hidden">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-brand-muted">Emotion</p>
            <p className="font-medium text-brand-text">{formatLabel(avatar.emotion)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-brand-muted">Pose</p>
              <p className="text-brand-text">{formatLabel(avatar.pose)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-brand-muted">Action</p>
              <p className="text-brand-text">{formatLabel(avatar.action)}</p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-brand-muted">Clothing</p>
            <p className="text-brand-text">{formatLabel(avatar.clothingState)}</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs uppercase tracking-wide text-brand-muted">
              <span>Arousal</span>
              <span>{arousalPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-brand-bg">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-accentDim to-brand-accent transition-all duration-700 ease-out"
                style={{ width: `${arousalPct}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="hidden text-xs leading-relaxed text-brand-muted sm:block">
          Avatar state updates live as the character responds — emotion, pose, and energy sync
          from each Grok reply.
        </p>
      )}

      {/* Mobile compact arousal only */}
      {avatar && (
        <div className="sm:hidden">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-brand-muted">
            <span>Arousal</span>
            <span>{arousalPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-brand-bg">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-accentDim to-brand-accent transition-all duration-700"
              style={{ width: `${arousalPct}%` }}
            />
          </div>
        </div>
      )}
    </aside>
  );
}