"use client";

import type { ScheduledShow } from "@/lib/types";

interface ShowScheduleProps {
  shows: ScheduledShow[];
  onJoinShow?: (showId: string) => void;
}

function formatShowTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffMs < 0) return "Started";
  if (diffHours < 1) return `In ${diffMins}m`;
  if (diffHours < 24) return `In ${diffHours}h ${diffMins}m`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-blue-600",
  live: "bg-red-600 animate-pulse",
  completed: "bg-gray-600",
  cancelled: "bg-gray-700",
};

const CHARACTER_NAMES: Record<string, string> = {
  "twink-default": "Twink Default",
  "female-default": "Female Default",
};

export function ShowSchedule({ shows, onJoinShow }: ShowScheduleProps) {
  if (shows.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3">📅 Upcoming Shows</h3>
        <p className="text-gray-500 text-sm text-center py-4">No shows scheduled yet</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3">📅 Upcoming Shows</h3>

      <div className="space-y-3">
        {shows.map((show) => (
          <div
            key={show.id}
            className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-white font-bold text-sm">{show.title}</div>
                <div className="text-gray-400 text-xs mt-0.5">
                  {CHARACTER_NAMES[show.characterId] ?? show.characterId}
                  {show.pairedCharacterId && (
                    <> + {CHARACTER_NAMES[show.pairedCharacterId] ?? show.pairedCharacterId}</>
                  )}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${STATUS_STYLES[show.status]}`}
              >
                {show.status.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">
                ⏰ {formatShowTime(show.scheduledAt)} · {show.durationMinutes}min
              </div>
              {show.status === "live" && show.roomId && onJoinShow && (
                <button
                  onClick={() => onJoinShow(show.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-full transition-colors"
                >
                  Watch Now
                </button>
              )}
              {show.status === "upcoming" && (
                <button className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full transition-colors">
                  🔔 Remind Me
                </button>
              )}
            </div>

            {/* Tags */}
            {show.tags.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {show.tags.map((tag) => (
                  <span key={tag} className="px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
