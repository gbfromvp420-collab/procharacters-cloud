"use client";

import { useCallback, useEffect, useState } from "react";
import { chatOutageCopy, type ProductHealth } from "@/lib/llm-status";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Site-wide chat-down strip. Polls /health so a dead brain is a banner,
 * not a character pretending the vendor error is dialogue.
 */
export function ChatOutageBanner({ className = "" }: { className?: string }) {
  const [health, setHealth] = useState<ProductHealth | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      if (!res.ok) return;
      setHealth((await res.json()) as ProductHealth);
    } catch {
      /* offline banner owns connectivity */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const copy = chatOutageCopy(health);
  if (!copy) return null;

  return (
    <div
      className={`animate-rise-in rounded-xl border border-amber-400/45 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed ${className}`}
      role="status"
      aria-live="polite"
      data-testid="chat-outage-banner"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
        {copy.title}
      </p>
      <p className="mt-1 text-brand-muted">{copy.body}</p>
    </div>
  );
}
