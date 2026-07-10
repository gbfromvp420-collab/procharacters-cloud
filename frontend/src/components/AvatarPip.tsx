"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarVideo } from "@/components/AvatarVideo";
import type { AvatarState } from "@/lib/types";

const POS_KEY = "pc_avatar_pip_pos";
const PIP_W_MOBILE = 116; // ~7.25rem
const PIP_W_DESKTOP = 144; // ~9rem

type Pos = { x: number; y: number };

function defaultPos(): Pos {
  if (typeof window === "undefined") return { x: 16, y: 120 };
  const w = window.innerWidth < 640 ? PIP_W_MOBILE : PIP_W_DESKTOP;
  const h = Math.round(w * (4 / 3)) + 28; // video + chrome
  const pad = 12;
  const safeRight = 0;
  const safeBottom = 76; // above composer
  return {
    x: Math.max(pad, window.innerWidth - w - pad - safeRight),
    y: Math.max(pad, window.innerHeight - h - pad - safeBottom),
  };
}

function clampPos(p: Pos, width: number, height: number): Pos {
  if (typeof window === "undefined") return p;
  const pad = 8;
  const maxX = Math.max(pad, window.innerWidth - width - pad);
  const maxY = Math.max(pad, window.innerHeight - height - pad);
  return {
    x: Math.min(maxX, Math.max(pad, p.x)),
    y: Math.min(maxY, Math.max(pad, p.y)),
  };
}

function loadPos(): Pos | null {
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Pos;
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function savePos(p: Pos) {
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

interface AvatarPipProps {
  avatar: AvatarState | null;
  characterName: string | null;
  onExpand: () => void;
  onHide: () => void;
}

export function AvatarPip({ avatar, characterName, onExpand, onHide }: AvatarPipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>(() => defaultPos());
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    pointerId: number;
  } | null>(null);

  // Load saved position once
  useEffect(() => {
    const saved = loadPos();
    if (saved) {
      const el = rootRef.current;
      const w = el?.offsetWidth ?? (window.innerWidth < 640 ? PIP_W_MOBILE : PIP_W_DESKTOP);
      const h = el?.offsetHeight ?? 180;
      setPos(clampPos(saved, w, h));
    } else {
      setPos(defaultPos());
    }
  }, []);

  // Keep in viewport on resize
  useEffect(() => {
    const onResize = () => {
      const el = rootRef.current;
      if (!el) return;
      setPos((p) => clampPos(p, el.offsetWidth, el.offsetHeight));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const endDrag = useCallback((ev: PointerEvent | React.PointerEvent) => {
    const d = dragRef.current;
    if (!d?.active) return;
    dragRef.current = { ...d, active: false };
    setDragging(false);
    try {
      (ev.target as HTMLElement).releasePointerCapture?.(d.pointerId);
    } catch {
      /* ignore */
    }
    const el = rootRef.current;
    if (el) {
      setPos((p) => {
        const next = clampPos(p, el.offsetWidth, el.offsetHeight);
        savePos(next);
        return next;
      });
    }
  }, []);

  const onPointerDown = (ev: React.PointerEvent) => {
    // Only primary button / touch
    if (ev.button !== 0 && ev.pointerType === "mouse") return;
    const el = rootRef.current;
    if (!el) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: ev.clientX,
      startY: ev.clientY,
      originX: pos.x,
      originY: pos.y,
      pointerId: ev.pointerId,
    };
    setDragging(true);
    try {
      el.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    ev.preventDefault();
  };

  const onPointerMove = (ev: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d?.active) return;
    const dx = ev.clientX - d.startX;
    const dy = ev.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    const el = rootRef.current;
    const w = el?.offsetWidth ?? PIP_W_MOBILE;
    const h = el?.offsetHeight ?? 180;
    setPos(clampPos({ x: d.originX + dx, y: d.originY + dy }, w, h));
  };

  const onPointerUp = (ev: React.PointerEvent) => {
    const d = dragRef.current;
    const wasMoved = d?.moved === true;
    endDrag(ev);
    // Tap on handle does nothing special; tap video expands only if not dragged
    if (!wasMoved && (ev.target as HTMLElement).closest("[data-pip-video]")) {
      onExpand();
    }
  };

  return (
    <div
      ref={rootRef}
      className={`fixed z-40 w-[7.25rem] touch-none select-none sm:w-36 ${
        dragging ? "cursor-grabbing" : ""
      }`}
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label="Live avatar picture-in-picture"
    >
      <div
        className={`overflow-hidden rounded-2xl border border-brand-accent/50 bg-brand-panel/95 shadow-glow ring-1 ring-black/40 backdrop-blur-md ${
          dragging ? "scale-[1.02] shadow-glow-sm" : "animate-rise-in"
        }`}
      >
        {/* Drag handle */}
        <div
          className={`flex cursor-grab items-center justify-between gap-1 border-b border-brand-border/60 px-1.5 py-1 active:cursor-grabbing ${
            dragging ? "bg-brand-accent/15" : ""
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="Drag to move"
        >
          <span className="flex min-w-0 items-center gap-1 pl-0.5">
            <span className="inline-flex flex-col gap-0.5 opacity-50" aria-hidden>
              <span className="block h-0.5 w-2.5 rounded-full bg-brand-muted" />
              <span className="block h-0.5 w-2.5 rounded-full bg-brand-muted" />
            </span>
            <span className="truncate text-[9px] font-medium uppercase tracking-wide text-brand-accent">
              Live
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded px-1.5 py-0.5 text-[9px] text-brand-text hover:bg-brand-bg"
              title="Expand full avatar"
            >
              Full
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onHide();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded px-1.5 py-0.5 text-[9px] text-brand-muted hover:bg-brand-bg hover:text-brand-text"
              title="Dismiss mini avatar"
              aria-label="Dismiss picture-in-picture"
            >
              Hide
            </button>
          </div>
        </div>

        <div
          data-pip-video
          className="cursor-pointer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="Drag to move · tap to expand"
        >
          <AvatarVideo avatar={avatar} characterName={characterName} pip />
        </div>
      </div>
    </div>
  );
}
