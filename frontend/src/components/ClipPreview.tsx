"use client";

import { useEffect, useState } from "react";

interface ClipPreviewProps {
  src?: string | null;
  label: string;
  className?: string;
}

/** Small muted looping video preview for media editor slots. */
export function ClipPreview({ src, label, className = "" }: ClipPreviewProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const resolved = src?.trim()
    ? src.startsWith("http") || src.startsWith("/")
      ? src
      : `/${src}`
    : null;

  if (!resolved || failed) {
    return (
      <div
        className={`flex aspect-video items-center justify-center rounded-lg border border-dashed border-brand-border bg-brand-bg text-[10px] text-brand-muted ${className}`}
      >
        {failed ? "Preview unavailable" : `No ${label} preview`}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-lg border border-brand-border bg-black ${className}`}>
      <video
        key={resolved}
        src={resolved}
        className="aspect-video w-full object-cover"
        muted
        loop
        autoPlay
        playsInline
        onError={() => setFailed(true)}
      />
    </div>
  );
}
