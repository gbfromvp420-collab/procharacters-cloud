"use client";

import { useCallback, useState } from "react";
import type { TokenBalance, TokenCosts } from "@/lib/types";

interface TokenDisplayProps {
  balance: TokenBalance | null;
  costs: TokenCosts | null;
  onPurchase?: (amount: number) => void;
}

const TOKEN_PACKAGES = [
  { amount: 100, label: "100 Tokens", price: "$4.99" },
  { amount: 500, label: "500 Tokens", price: "$19.99" },
  { amount: 1200, label: "1,200 Tokens", price: "$39.99" },
  { amount: 5000, label: "5,000 Tokens", price: "$149.99" },
];

export function TokenDisplay({ balance, costs, onPurchase }: TokenDisplayProps) {
  const [showPurchase, setShowPurchase] = useState(false);

  const handlePurchase = useCallback(
    (amount: number) => {
      onPurchase?.(amount);
      setShowPurchase(false);
    },
    [onPurchase],
  );

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      {/* Balance display */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🪙</span>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Tokens</div>
            <div className="text-xl font-bold text-yellow-400">
              {balance ? balance.balance.toLocaleString() : "—"}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowPurchase(!showPurchase)}
          className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold rounded-lg transition-colors"
        >
          + Buy Tokens
        </button>
      </div>

      {/* Purchase packages */}
      {showPurchase && (
        <div className="mt-3 border-t border-gray-700 pt-3 space-y-2">
          <div className="text-xs text-gray-400 mb-2">Select a package:</div>
          {TOKEN_PACKAGES.map((pkg) => (
            <button
              key={pkg.amount}
              onClick={() => handlePurchase(pkg.amount)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span className="text-white font-medium">{pkg.label}</span>
              <span className="text-yellow-400 font-bold">{pkg.price}</span>
            </button>
          ))}
        </div>
      )}

      {/* Cost reference (collapsed by default) */}
      {costs && (
        <details className="mt-3">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
            Token costs
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-400">
            <span>Live minute:</span>
            <span className="text-yellow-400">{costs.liveMinute} 🪙</span>
            <span>Image gen:</span>
            <span className="text-yellow-400">{costs.imageGeneration} 🪙</span>
            <span>Video gen:</span>
            <span className="text-yellow-400">{costs.videoGeneration} 🪙</span>
            <span>Basic command:</span>
            <span className="text-yellow-400">{costs.commandBasic} 🪙</span>
            <span>Premium command:</span>
            <span className="text-yellow-400">{costs.commandPremium} 🪙</span>
          </div>
        </details>
      )}
    </div>
  );
}
