"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchLatestAccountSessionForCharacter } from "@/lib/api";
import { loadStoredAccount } from "@/lib/account-storage";
import { rememberLocalResume } from "@/lib/resume-cache";
import { rewriteAutostartToResume } from "@/lib/return-autostart";
import { parseShareQuery } from "@/lib/share-links";

/**
 * Runs before ChatApp boots so ?character=&autostart=1 reclaims the last
 * night instead of opening a cold session.
 */
export function ReclaimAutostartGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const finish = (path?: string | null) => {
      if (cancelled) return;
      if (path && path !== `${window.location.pathname}${window.location.search}`) {
        window.history.replaceState(null, "", path);
      }
      setReady(true);
    };

    const run = async () => {
      const search = window.location.search;
      const localRewrite = rewriteAutostartToResume(search);
      if (localRewrite) {
        finish(localRewrite);
        return;
      }

      const q = parseShareQuery(search);
      if (q.fresh || q.resumeCode || !q.characterId || !q.autostart) {
        finish();
        return;
      }

      const account = loadStoredAccount();
      if (!account?.token) {
        finish();
        return;
      }

      try {
        const latest = await fetchLatestAccountSessionForCharacter(account.token, q.characterId);
        if (cancelled) return;
        if (latest?.resumeCode) {
          rememberLocalResume({
            characterId: latest.characterId,
            characterName: latest.characterName,
            sessionId: latest.sessionId,
            resumeCode: latest.resumeCode,
            resumeExpiresAt: latest.resumeExpiresAt,
            messageCount: latest.messageCount,
          });
          const next = rewriteAutostartToResume(search);
          finish(next);
          return;
        }
      } catch {
        /* stay on cold autostart */
      }
      finish();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16 text-sm text-white/55">
        Finding last night…
      </div>
    );
  }

  return children;
}
