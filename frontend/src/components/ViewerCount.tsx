"use client";

interface ViewerCountProps {
  count: number;
  peakCount?: number;
  isLive: boolean;
}

export function ViewerCount({ count, peakCount, isLive }: ViewerCountProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Live indicator */}
      {isLive && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded-full">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-white text-xs font-bold uppercase">Live</span>
        </div>
      )}

      {/* Viewer count */}
      <div className="flex items-center gap-1 text-gray-300">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <span className="text-sm font-medium">{count.toLocaleString()}</span>
        {peakCount !== undefined && peakCount > count && (
          <span className="text-xs text-gray-500">(peak: {peakCount.toLocaleString()})</span>
        )}
      </div>
    </div>
  );
}
