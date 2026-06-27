"use client";

import { useCallback, useState } from "react";
import type { CommandDefinition } from "@/lib/types";

interface CommandPanelProps {
  commands: CommandDefinition[];
  balance: number;
  onSendCommand: (commandId: string, customPrompt?: string) => void;
}

const TIER_COLORS: Record<string, string> = {
  free: "bg-green-600 hover:bg-green-500",
  basic: "bg-blue-600 hover:bg-blue-500",
  premium: "bg-purple-600 hover:bg-purple-500",
};

const TIER_BADGES: Record<string, string> = {
  free: "🆓",
  basic: "⭐",
  premium: "👑",
};

export function CommandPanel({ commands, balance, onSendCommand }: CommandPanelProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const handleCommand = useCallback(
    (commandId: string, cost: number) => {
      if (cost > balance) return;
      if (commandId === "custom") {
        setShowCustom(true);
        return;
      }
      onSendCommand(commandId);
    },
    [balance, onSendCommand],
  );

  const handleCustomSubmit = useCallback(() => {
    if (!customPrompt.trim()) return;
    onSendCommand("custom", customPrompt);
    setCustomPrompt("");
    setShowCustom(false);
  }, [customPrompt, onSendCommand]);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-3">
        🎮 Make Them Do Something
      </h3>

      {/* Command buttons */}
      <div className="space-y-2">
        {commands.map((cmd) => (
          <button
            key={cmd.id}
            onClick={() => handleCommand(cmd.id, cmd.cost)}
            disabled={cmd.cost > balance}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-white text-sm font-medium transition-all ${
              cmd.cost > balance
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : TIER_COLORS[cmd.tier] + " hover:scale-[1.02]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{TIER_BADGES[cmd.tier]}</span>
              <div className="text-left">
                <div className="font-bold">{cmd.label}</div>
                <div className="text-xs opacity-75">{cmd.description}</div>
              </div>
            </div>
            <div className="text-right">
              {cmd.cost > 0 ? (
                <span className="text-yellow-300 font-bold">{cmd.cost} 🪙</span>
              ) : (
                <span className="text-green-300 font-bold">Free</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Custom command input */}
      {showCustom && (
        <div className="mt-3 border-t border-gray-700 pt-3">
          <div className="text-xs text-gray-400 mb-2">Type your custom request:</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Make them..."
              maxLength={200}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customPrompt.trim()}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 text-white text-sm font-bold rounded-lg transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
