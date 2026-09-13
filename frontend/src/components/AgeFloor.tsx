"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AGE_GATE_STORAGE_KEY,
  AGE_GATE_TTL_MS,
  buildAgeVerifiedCookie,
  isAgeVerifiedFromSources,
} from "@/lib/age-gate";

/** Canonical product age floor — rewrite leftover 18+ chrome after hydrate. */
const SWAPS: [RegExp, string][] = [
  [/Uncensored 18\+/g, "Uncensored 21+"],
  [/Consenting adult 18\+/g, "Consenting adult 21+"],
  [/\b18\+ · KGC/g, "21+ · KGC"],
  [/\b18-year-old\b/gi, "21+"],
  [/\b18 year old\b/gi, "21+"],
  [/\b18yo\b/gi, "21+"],
];

function rewrite(node: Node) {
  if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
    let next = node.nodeValue;
    for (const [re, to] of SWAPS) next = next.replace(re, to);
    if (next !== node.nodeValue) node.nodeValue = next;
    return;
  }
  node.childNodes.forEach(rewrite);
}

function readLocal(): string | null {
  try {
    return localStorage.getItem(AGE_GATE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function isVerified(): boolean {
  return isAgeVerifiedFromSources({
    localStorageValue: readLocal(),
    cookieHeader: typeof document !== "undefined" ? document.cookie : undefined,
  });
}

function setVerified() {
  const now = Date.now();
  try {
    localStorage.setItem(AGE_GATE_STORAGE_KEY, String(now));
  } catch {
    // ignore quota / private mode
  }
  try {
    document.cookie = buildAgeVerifiedCookie(now);
  } catch {
    // ignore
  }
}

export function AgeFloor({ children }: { children?: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Run text rewrite regardless
    rewrite(document.body);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach(rewrite);
        if (m.type === "characterData") rewrite(m.target);
      }
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });

    const ok = isVerified();
    setAllowed(ok);
    setReady(true);

    return () => mo.disconnect();
  }, []);

  function handleEnter() {
    setVerified();
    setAllowed(true);
  }

  function handleLeave() {
    window.location.href = "https://www.google.com";
  }

  const gate = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0f] px-6 text-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      data-testid="age-gate"
    >
      <div className="max-w-md space-y-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-muted">
          Procharacters · KGC Ventures
        </p>
        <h1
          id="age-gate-title"
          className="text-2xl font-semibold leading-tight text-brand-text sm:text-3xl"
        >
          This site contains explicit adult content.
        </h1>
        <p className="text-sm leading-relaxed text-brand-muted">
          You must be <span className="font-semibold text-brand-text">21 years of age or older</span> to enter.
          By continuing you confirm that you are at least 21 and that viewing adult material is legal in your location.
        </p>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleEnter}
            className="btn-primary min-h-12 w-full sm:w-auto sm:min-w-[180px]"
          >
            I am 21 or older — Enter
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="btn-ghost min-h-12 w-full sm:w-auto sm:min-w-[180px]"
          >
            I am under 21 — Leave
          </button>
        </div>

        <p className="pt-4 text-[11px] text-brand-muted/70">
          Under 21? You will be redirected away from this site.
        </p>
      </div>
    </div>
  );

  // Hold the product tree until verified so gallery clips do not mount behind the overlay.
  if (!ready) {
    return (
      <div
        className="fixed inset-0 z-[9999] bg-[#0a0a0f]"
        aria-hidden
        data-age-gate-hold
        data-ttl-ms={AGE_GATE_TTL_MS}
      />
    );
  }

  if (!allowed) {
    return gate;
  }

  return <>{children}</>;
}
