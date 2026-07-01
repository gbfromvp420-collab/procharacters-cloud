"use client";

import { useCallback, useEffect, useState } from "react";
import { AvatarVideo } from "@/components/AvatarVideo";
import { CharacterSwitcher } from "@/components/CharacterSwitcher";
import { CommandPanel } from "@/components/CommandPanel";
import { GiftPanel } from "@/components/GiftPanel";
import { RoomChat } from "@/components/RoomChat";
import { RoomList } from "@/components/RoomList";
import { ShowSchedule } from "@/components/ShowSchedule";
import { TipPanel } from "@/components/TipPanel";
import { TokenDisplay } from "@/components/TokenDisplay";
import { ViewerCount } from "@/components/ViewerCount";
import {
  getCommandCatalog,
  getGiftCatalog,
  getTokenBalance,
  getTipLeaderboard,
  listLiveRooms,
  listScheduledShows,
  sendCommand,
  sendGift,
  sendTip,
  creditTokens,
} from "@/lib/api";
import type {
  AvatarState,
  CharacterId,
  CommandDefinition,
  GiftDefinition,
  GiftSendEvent,
  LiveRoomListItem,
  ScheduledShow,
  Tip,
  TipLeaderboardEntry,
  TokenBalance,
  TokenCosts,
} from "@/lib/types";

/**
 * Live cam page — Feature B main experience.
 *
 * Displays live rooms, tipping, gifts, commands, scheduled shows,
 * and token balance. Mobile-friendly responsive layout.
 */
export default function LiveCamPage() {
  // For MVP, use a random anonymous user
  const [userId] = useState(() => crypto.randomUUID());
  const [displayName] = useState(() => `Viewer_${crypto.randomUUID().slice(0, 6)}`);

  // State
  const [rooms, setRooms] = useState<LiveRoomListItem[]>([]);
  const [shows, setShows] = useState<ScheduledShow[]>([]);
  const [gifts, setGifts] = useState<GiftDefinition[]>([]);
  const [commands, setCommands] = useState<CommandDefinition[]>([]);
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [costs, setCosts] = useState<TokenCosts | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [recentTips, setRecentTips] = useState<Tip[]>([]);
  const [recentGifts, setRecentGifts] = useState<GiftSendEvent[]>([]);
  const [leaderboard, setLeaderboard] = useState<TipLeaderboardEntry[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [avatarState, setAvatarState] = useState<AvatarState | null>(null);
  const [activeCharacterId, setActiveCharacterId] = useState<CharacterId>("twink-default");
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [balRes, roomRes, showRes, giftRes, cmdRes] = await Promise.all([
          getTokenBalance(userId),
          listLiveRooms(),
          listScheduledShows(),
          getGiftCatalog(),
          getCommandCatalog(),
        ]);
        setBalance(balRes.balance);
        setCosts(balRes.costs);
        setRooms(roomRes.rooms);
        setShows(showRes.shows);
        setGifts(giftRes.gifts);
        setCommands(cmdRes.commands);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      }
    }
    loadData();
  }, [userId]);

  // Load leaderboard when room selected
  useEffect(() => {
    if (!selectedRoomId) return;
    getTipLeaderboard(selectedRoomId)
      .then((res) => setLeaderboard(res.leaderboard))
      .catch(() => {});
  }, [selectedRoomId]);

  // Handlers
  const handleSelectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setAvatarState(null);
    const room = rooms.find((r) => r.id === roomId);
    setViewerCount(room?.viewerCount ?? 0);
    if (room?.characterId) {
      setActiveCharacterId(room.characterId as CharacterId);
    }
  }, [rooms]);

  const handleAvatarUpdate = useCallback((avatar: AvatarState) => {
    setAvatarState(avatar);
  }, []);

  const handleCharacterSwitch = useCallback((characterId: CharacterId) => {
    setActiveCharacterId(characterId);
    setAvatarState(null);
  }, []);

  const handleSendTip = useCallback(
    async (amount: number, message?: string) => {
      if (!selectedRoomId) return;
      try {
        const result = await sendTip(selectedRoomId, userId, displayName, amount, message);
        setRecentTips((prev) => [...prev, result.tip]);
        // Refresh balance
        const balRes = await getTokenBalance(userId);
        setBalance(balRes.balance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tip failed");
      }
    },
    [selectedRoomId, userId, displayName],
  );

  const handleSendGift = useCallback(
    async (giftId: string) => {
      if (!selectedRoomId) return;
      try {
        await sendGift(selectedRoomId, userId, displayName, giftId);
        const gift = gifts.find((g) => g.id === giftId);
        if (gift) {
          const event: GiftSendEvent = {
            id: `local-${Date.now()}`,
            roomId: selectedRoomId,
            userId,
            displayName,
            giftId,
            gift,
            createdAt: new Date().toISOString(),
          };
          setRecentGifts((prev) => [...prev, event]);
        }
        const balRes = await getTokenBalance(userId);
        setBalance(balRes.balance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gift failed");
      }
    },
    [selectedRoomId, userId, displayName, gifts],
  );

  const handleSendCommand = useCallback(
    async (commandId: string, customPrompt?: string) => {
      if (!selectedRoomId) return;
      try {
        await sendCommand(selectedRoomId, userId, displayName, commandId, customPrompt);
        const balRes = await getTokenBalance(userId);
        setBalance(balRes.balance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Command failed");
      }
    },
    [selectedRoomId, userId, displayName],
  );

  const handlePurchaseTokens = useCallback(
    async (amount: number) => {
      try {
        const result = await creditTokens(userId, amount);
        setBalance(result.balance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Purchase failed");
      }
    },
    [userId],
  );

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">
              <span className="text-pink-500">Procharacters</span>
              <span className="text-gray-400">.cloud</span>
            </h1>
            <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-3">
            {selectedRoom && (
              <ViewerCount count={viewerCount} isLive={selectedRoom.status === "live"} />
            )}
            <div className="hidden sm:block">
              <TokenDisplay balance={balance} costs={costs} onPurchase={handlePurchaseTokens} />
            </div>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-2 text-center">
          <span className="text-red-200 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-white text-sm">
            ✕
          </button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Mobile token display */}
        <div className="sm:hidden mb-4">
          <TokenDisplay balance={balance} costs={costs} onPurchase={handlePurchaseTokens} />
        </div>

        {!selectedRoomId ? (
          /* ── Browse view ──────────────────────────────── */
          <div className="space-y-6">
            <RoomList rooms={rooms} onSelectRoom={handleSelectRoom} />
            <ShowSchedule shows={shows} />
          </div>
        ) : (
          /* ── Room view (watching) ─────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Video area (left / main) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Back button + room title */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedRoomId(null)}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  ← Back
                </button>
                <div>
                  <h2 className="text-lg font-bold">{selectedRoom?.title ?? "Room"}</h2>
                  <div className="text-xs text-gray-400">
                    {selectedRoom?.characterId}
                    {selectedRoom?.pairedCharacterId && ` + ${selectedRoom.pairedCharacterId}`}
                  </div>
                </div>
              </div>

              {/* Live avatar video */}
              <div className="relative overflow-hidden rounded-xl border border-gray-700">
                <AvatarVideo
                  avatar={avatarState}
                  characterName={selectedRoom?.title ?? null}
                  characterId={activeCharacterId}
                />
                {/* Live badge overlay */}
                {selectedRoom?.status === "live" && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded-full z-10">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-xs font-bold">LIVE</span>
                  </div>
                )}
                {/* Viewer count overlay */}
                <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 rounded text-white text-xs z-10">
                  👁 {viewerCount}
                </div>
              </div>

              {/* Tags */}
              {selectedRoom?.tags && selectedRoom.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selectedRoom.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar (right) — interactions */}
            <div className="space-y-4">
              <CharacterSwitcher
                currentCharacterId={activeCharacterId}
                onSwitch={handleCharacterSwitch}
                compact
              />
              <RoomChat
                roomId={selectedRoomId}
                characterId={activeCharacterId}
                onAvatarUpdate={handleAvatarUpdate}
              />
              <TipPanel
                roomId={selectedRoomId}
                userId={userId}
                displayName={displayName}
                balance={balance?.balance ?? 0}
                recentTips={recentTips}
                leaderboard={leaderboard}
                onSendTip={handleSendTip}
              />
              <GiftPanel
                gifts={gifts}
                balance={balance?.balance ?? 0}
                recentGifts={recentGifts}
                onSendGift={handleSendGift}
              />
              <CommandPanel
                commands={commands}
                balance={balance?.balance ?? 0}
                onSendCommand={handleSendCommand}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-4 py-4 mt-8">
        <div className="max-w-7xl mx-auto text-center text-xs text-gray-600">
          <p>Procharacters.cloud — Naughty Syntax™ · All characters are AI-generated · 18+ only</p>
          <p className="mt-1">
            <a href="/" className="text-pink-500 hover:text-pink-400">
              Companion Chat
            </a>
            {" · "}
            <span className="text-gray-400">Live Cam</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
