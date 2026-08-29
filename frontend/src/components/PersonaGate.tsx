"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStoredAccount } from "@/lib/account-storage";
import { needsPersona } from "@/lib/user-persona";

/** After sign-in, unfinished taste questionnaire opens once. */
export function PersonaGate({ allowResume = false }: { allowResume?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!loadStoredAccount()) return;
    if (!needsPersona()) return;
    if (allowResume && typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      if (q.get("resume") || q.get("autostart") || q.get("code") || q.get("character")) {
        return;
      }
    }
    router.replace("/welcome");
  }, [router, allowResume]);

  return null;
}
