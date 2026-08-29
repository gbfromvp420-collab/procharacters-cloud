"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Overflow for secondary actions so tiles and banners stay one-CTA clean.
 */
export function MoreMenu({
  label = "More",
  align = "right",
  children,
  className = "",
}: {
  label?: string;
  align?: "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        className="btn-ghost min-h-0 px-3 py-2 text-xs"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-30 mt-1.5 min-w-[11.5rem] overflow-hidden rounded-xl border border-brand-border bg-brand-panel py-1 shadow-card ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <div className="more-menu-items" onClick={() => setOpen(false)}>
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
