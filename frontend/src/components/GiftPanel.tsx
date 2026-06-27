"use client";

import { useCallback, useState } from "react";
import type { GiftDefinition, GiftSendEvent } from "@/lib/types";

interface GiftPanelProps {
  gifts: GiftDefinition[];
  balance: number;
  recentGifts: GiftSendEvent[];
  onSendGift: (giftId: string) => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "border-gray-500 bg-gray-800",
  rare: "border-blue-500 bg-blue-900/30",
  epic: "border-purple-500 bg-purple-900/30",
  legendary: "border-yellow-500 bg-yellow-900/30",
};

const RARITY_LABELS: Record<string, string> = {
  common: "text-gray-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-yellow-400",
};

export function GiftPanel({ gifts, balance, recentGifts, onSendGift }: GiftPanelProps) {
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);

  const filteredGifts = selectedRarity ? gifts.filter((g) => g.rarity === selectedRarity) : gifts;

  const handleSend = useCallback(
    (giftId: string, cost: number) => {
      if (cost > balance) return;
      onSendGift(giftId);
    },
    [balance, onSendGift],
  );

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-3">🎁 Gifts</h3>

      {/* Rarity filter */}
      <div className="flex gap-1 mb-3 flex-wrap">
        <button
          onClick={() => setSelectedRarity(null)}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            !selectedRarity ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          All
        </button>
        {["common", "rare", "epic", "legendary"].map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRarity(r)}
            className={`px-2 py-1 rounded text-xs capitalize transition-colors ${
              selectedRarity === r ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Gift grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {filteredGifts.map((gift) => (
          <button
            key={gift.id}
            onClick={() => handleSend(gift.id, gift.cost)}
            disabled={gift.cost > balance}
            className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
              RARITY_COLORS[gift.rarity]
            } ${
              gift.cost > balance
                ? "opacity-50 cursor-not-allowed"
                : "hover:scale-105 cursor-pointer"
            }`}
          >
            <span className="text-2xl mb-1">{gift.emoji}</span>
            <span className="text-xs text-white font-medium">{gift.name}</span>
            <span className={`text-xs ${RARITY_LABELS[gift.rarity]}`}>{gift.cost} 🪙</span>
          </button>
        ))}
      </div>

      {/* Recent gift feed */}
      {recentGifts.length > 0 && (
        <div className="border-t border-gray-700 pt-2 space-y-1 max-h-20 overflow-y-auto">
          {recentGifts.slice(-4).reverse().map((event) => (
            <div key={event.id} className="flex items-center gap-1 text-xs">
              <span className="text-purple-400 font-bold">{event.displayName}</span>
              <span>sent</span>
              <span>{event.gift.emoji}</span>
              <span className={RARITY_LABELS[event.gift.rarity]}>{event.gift.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
