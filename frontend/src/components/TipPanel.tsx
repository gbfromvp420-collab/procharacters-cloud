"use client";

import { useCallback, useState } from "react";
import type { Tip, TipLeaderboardEntry } from "@/lib/types";

interface TipPanelProps {
  roomId: string;
  userId: string;
  displayName: string;
  balance: number;
  recentTips: Tip[];
  leaderboard: TipLeaderboardEntry[];
  onSendTip: (amount: number, message?: string) => void;
}

const QUICK_TIP_AMOUNTS = [5, 10, 25, 50, 100, 500];

export function TipPanel({
  roomId: _roomId,
  userId: _userId,
  displayName: _displayName,
  balance,
  recentTips,
  leaderboard,
  onSendTip,
}: TipPanelProps) {
  const [customAmount, setCustomAmount] = useState("");
  const [tipMessage, setTipMessage] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const handleTip = useCallback(
    (amount: number) => {
      if (amount > balance) return;
      onSendTip(amount, tipMessage || undefined);
      setTipMessage("");
      setCustomAmount("");
    },
    [balance, tipMessage, onSendTip],
  );

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider">💰 Tip</h3>
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          🏆 Leaderboard
        </button>
      </div>

      {/* Quick tip buttons */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {QUICK_TIP_AMOUNTS.map((amount) => (
          <button
            key={amount}
            onClick={() => handleTip(amount)}
            disabled={amount > balance}
            className={`py-2 rounded-lg text-sm font-bold transition-all ${
              amount > balance
                ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                : "bg-pink-600 hover:bg-pink-500 text-white hover:scale-105"
            }`}
          >
            {amount} 🪙
          </button>
        ))}
      </div>

      {/* Custom amount + message */}
      <div className="flex gap-2 mb-3">
        <input
          type="number"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          placeholder="Custom"
          min="1"
          className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:border-pink-500 focus:outline-none"
        />
        <input
          type="text"
          value={tipMessage}
          onChange={(e) => setTipMessage(e.target.value)}
          placeholder="Add a message..."
          maxLength={200}
          className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:border-pink-500 focus:outline-none"
        />
        <button
          onClick={() => handleTip(parseInt(customAmount) || 0)}
          disabled={!customAmount || parseInt(customAmount) > balance}
          className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-lg transition-colors"
        >
          Send
        </button>
      </div>

      {/* Recent tips feed */}
      {recentTips.length > 0 && (
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {recentTips.slice(-5).reverse().map((tip) => (
            <div key={tip.id} className="flex items-center gap-2 text-xs">
              <span className="text-pink-400 font-bold">{tip.displayName}</span>
              <span className="text-yellow-400">{tip.amount} 🪙</span>
              {tip.message && <span className="text-gray-400 truncate">{tip.message}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      {showLeaderboard && leaderboard.length > 0 && (
        <div className="mt-3 border-t border-gray-700 pt-3">
          <div className="text-xs text-gray-400 mb-2">Top Tippers</div>
          {leaderboard.slice(0, 5).map((entry) => (
            <div key={entry.userId} className="flex items-center justify-between text-xs py-1">
              <span>
                <span className="text-yellow-400 mr-1">#{entry.rank}</span>
                <span className="text-white">{entry.displayName}</span>
              </span>
              <span className="text-yellow-400 font-bold">{entry.totalTipped} 🪙</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
