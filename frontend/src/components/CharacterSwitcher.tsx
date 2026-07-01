"use client";

import { useState } from "react";
import type { CharacterId } from "@/lib/types";

const CHARACTERS: { id: CharacterId; label: string; emoji: string }[] = [
  { id: "twink-default", label: "Twink Default", emoji: "👨" },
  { id: "female-default", label: "Female Default", emoji: "👩" },
];

interface CharacterSwitcherProps {
  currentCharacterId: string;
  onSwitch: (characterId: CharacterId) => void;
  disabled?: boolean;
  /** Compact mode for sidebar panels */
  compact?: boolean;
}

/**
 * Character switcher — allows switching between available characters.
 * Triggers a new session with the selected character.
 */
export function CharacterSwitcher({
  currentCharacterId,
  onSwitch,
  disabled = false,
  compact = false,
}: CharacterSwitcherProps) {
  const [confirming, setConfirming] = useState<CharacterId | null>(null);

  const handleSelect = (id: CharacterId) => {
    if (id === currentCharacterId) return;

    // Show confirmation before switching (ends current session)
    setConfirming(id);
  };

  const handleConfirm = () => {
    if (confirming) {
      onSwitch(confirming);
      setConfirming(null);
    }
  };

  if (compact) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-3">
        <p className="text-xs text-gray-400 mb-2 font-medium">Switch Character</p>
        <div className="flex gap-2">
          {CHARACTERS.map((char) => (
            <button
              key={char.id}
              type="button"
              onClick={() => handleSelect(char.id)}
              disabled={disabled || char.id === currentCharacterId}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                char.id === currentCharacterId
                  ? "bg-pink-600/20 border border-pink-600 text-pink-300"
                  : "bg-gray-800 border border-gray-700 text-gray-300 hover:border-pink-500 hover:text-white disabled:opacity-50"
              }`}
            >
              {char.emoji} {char.label.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Confirmation dialog */}
        {confirming && (
          <div className="mt-2 p-2 rounded-lg bg-yellow-900/30 border border-yellow-800">
            <p className="text-xs text-yellow-200 mb-2">
              Switch to {CHARACTERS.find((c) => c.id === confirming)?.label}? This ends the current chat session.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded px-2 py-1 text-xs bg-pink-600 text-white hover:bg-pink-500"
              >
                Switch
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="flex-1 rounded px-2 py-1 text-xs bg-gray-800 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-gray-400">Character:</span>
      {CHARACTERS.map((char) => (
        <button
          key={char.id}
          type="button"
          onClick={() => handleSelect(char.id)}
          disabled={disabled || char.id === currentCharacterId}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            char.id === currentCharacterId
              ? "bg-pink-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
          }`}
        >
          {char.emoji} {char.label}
        </button>
      ))}

      {/* Confirmation dialog */}
      {confirming && (
        <div className="w-full mt-2 p-3 rounded-lg bg-yellow-900/30 border border-yellow-800">
          <p className="text-sm text-yellow-200 mb-2">
            Switch to {CHARACTERS.find((c) => c.id === confirming)?.label}? This will end the current chat session and start a new one.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-lg px-4 py-2 text-sm bg-pink-600 text-white hover:bg-pink-500"
            >
              Switch Character
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded-lg px-4 py-2 text-sm bg-gray-800 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
