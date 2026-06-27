"use client";

import type { LiveRoomListItem } from "@/lib/types";

interface RoomListProps {
  rooms: LiveRoomListItem[];
  onSelectRoom: (roomId: string) => void;
}

const CHARACTER_NAMES: Record<string, string> = {
  "twink-default": "Twink Default",
  "female-default": "Female Default",
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  live: { label: "🔴 LIVE", color: "bg-red-600" },
  scheduled: { label: "📅 Scheduled", color: "bg-blue-600" },
  offline: { label: "⚫ Offline", color: "bg-gray-600" },
  ended: { label: "✅ Ended", color: "bg-gray-700" },
};

export function RoomList({ rooms, onSelectRoom }: RoomListProps) {
  const liveRooms = rooms.filter((r) => r.status === "live");
  const scheduledRooms = rooms.filter((r) => r.status === "scheduled");
  const otherRooms = rooms.filter((r) => r.status !== "live" && r.status !== "scheduled");

  const sortedRooms = [...liveRooms, ...scheduledRooms, ...otherRooms];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3">🎥 Live Rooms</h3>

      {sortedRooms.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">No rooms available</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedRooms.map((room) => {
            const badge = STATUS_BADGES[room.status];
            return (
              <button
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-pink-500 transition-all hover:scale-[1.02] text-left"
              >
                {/* Thumbnail placeholder */}
                <div className="aspect-video bg-gray-700 rounded-md mb-2 flex items-center justify-center relative overflow-hidden">
                  <span className="text-4xl">
                    {room.characterId.includes("twink") ? "👨" : "👩"}
                  </span>
                  {room.pairedCharacterId && (
                    <span className="text-4xl ml-2">
                      {room.pairedCharacterId.includes("twink") ? "👨" : "👩"}
                    </span>
                  )}
                  {/* Status badge */}
                  <span
                    className={`absolute top-1 left-1 px-1.5 py-0.5 ${badge.color} text-white text-xs font-bold rounded`}
                  >
                    {badge.label}
                  </span>
                  {/* Viewer count */}
                  {room.status === "live" && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/70 text-white text-xs rounded flex items-center gap-1">
                      👁 {room.viewerCount}
                    </span>
                  )}
                </div>

                <div className="text-white font-bold text-sm truncate">{room.title}</div>
                <div className="text-gray-400 text-xs mt-0.5">
                  {CHARACTER_NAMES[room.characterId] ?? room.characterId}
                  {room.pairedCharacterId && (
                    <> + {CHARACTER_NAMES[room.pairedCharacterId] ?? room.pairedCharacterId}</>
                  )}
                </div>

                {room.tags.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {room.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-1 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
