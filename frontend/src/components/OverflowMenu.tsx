"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Compact “More” popover — parks secondary actions so tiles and chrome stay clean.
 */
export function OverflowMenu({
  label = "More",
  align = "right",
  drop = "down",
  triggerClassName,
  children,
}: {
  label?: string;
  align?: "left" | "right";
  drop?: "down" | "up";
  triggerClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={
          triggerClassName ??
          "btn-ghost min-h-0 px-3 py-2 text-xs text-brand-muted hover:text-brand-text"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-50 min-w-[11.5rem] overflow-hidden rounded-xl border border-brand-border bg-brand-panel py-1 shadow-card ${
            align === "left" ? "left-0" : "right-0"
          } ${drop === "up" ? "bottom-full mb-1.5" : "mt-1.5 top-full"}`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
