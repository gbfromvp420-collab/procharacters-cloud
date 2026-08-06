"use client";

import { useEffect } from "react";
import { isPushSupported, registerPushServiceWorker } from "@/lib/web-push-client";

/**
 * Site-wide PWA warm-up: register push SW once on any page load.
 * Keeps Account Enable / Send test snappy without requiring a visit to /account first.
 */
export function PwaBootstrap() {
  useEffect(() => {
    if (!isPushSupported()) return;
    void registerPushServiceWorker();
  }, []);

  return null;
}
