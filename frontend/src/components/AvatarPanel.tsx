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

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-brand-border bg-brand-panel p-4 lg:min-w-[240px]">
      <div className="flex items-center gap-3">
        <div
          className={`avatar-ring flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-lg font-semibold text-white ${
            avatar ? arousalTone(avatar.arousalLevel) : "from-brand-border to-brand-accentDim"
          }`}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-brand-text">
            {characterName ?? "No character"}
          </p>
          <p className="text-xs text-brand-muted">
            {characterId ? formatLabel(characterId) : "Start a session"}
          </p>
        </div>
      </div>

      {status === "connecting" && (
        <p className="text-xs text-brand-muted animate-pulse">Connecting to live session…</p>
      )}

      {avatar ? (
        <div className="space-y-3 text-sm">
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
        <p className="text-xs leading-relaxed text-brand-muted">
          Avatar state updates live as the character responds — emotion, pose, and energy sync
          from each Grok reply.
        </p>
      )}
    </aside>
  );
}