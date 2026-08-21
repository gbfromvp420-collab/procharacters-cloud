"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarVideo } from "@/components/AvatarVideo";
import type { AvatarState } from "@/lib/types";

const POS_KEY = "pc_avatar_pip_pos";
const CORNER_KEY = "pc_avatar_pip_corner";
const PIP_W_MOBILE = 116;
const PIP_W_DESKTOP = 144;
const EDGE_PAD = 12;
const SAFE_BOTTOM = 88; // above composer + home indicator

type Pos = { x: number; y: number };
type Corner = "tl" | "tr" | "bl" | "br";

const CORNER_ORDER: Corner[] = ["br", "bl", "tl", "tr"];

function pipSize(): { w: number; h: number } {
  const w = typeof window !== "undefined" && window.innerWidth < 640 ? PIP_W_MOBILE : PIP_W_DESKTOP;
  const h = Math.round(w * (4 / 3)) + 28;
  return { w, h };
}

function cornerPos(corner: Corner): Pos {
  if (typeof window === "undefined") return { x: 16, y: 120 };
  const { w, h } = pipSize();
  const maxX = Math.max(EDGE_PAD, window.innerWidth - w - EDGE_PAD);
  const maxY = Math.max(EDGE_PAD, window.innerHeight - h - EDGE_PAD - SAFE_BOTTOM);
  const minY = EDGE_PAD + 48; // below sticky header
  switch (corner) {
    case "tl":
      return { x: EDGE_PAD, y: minY };
    case "tr":
      return { x: maxX, y: minY };
    case "bl":
      return { x: EDGE_PAD, y: maxY };
    case "br":
    default:
      return { x: maxX, y: maxY };
  }
}

function nearestCorner(p: Pos, width: number, height: number): Corner {
  if (typeof window === "undefined") return "br";
  const cx = p.x + width / 2;
  const cy = p.y + height / 2;
  const midX = window.innerWidth / 2;
  const midY = window.innerHeight / 2;
  const left = cx < midX;
  const top = cy < midY;
  if (top && left) return "tl";
  if (top && !left) return "tr";
  if (!top && left) return "bl";
  return "br";
}

function clampPos(p: Pos, width: number, height: number): Pos {
  if (typeof window === "undefined") return p;
  const pad = 8;
  const maxX = Math.max(pad, window.innerWidth - width - pad);
  const maxY = Math.max(pad, window.innerHeight - height - pad - SAFE_BOTTOM);
  const minY = pad + 40;
  return {
    x: Math.min(maxX, Math.max(pad, p.x)),
    y: Math.min(maxY, Math.max(minY, p.y)),
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

function loadCorner(): Corner | null {
  try {
    const c = window.localStorage.getItem(CORNER_KEY);
    if (c === "tl" || c === "tr" || c === "bl" || c === "br") return c;
  } catch {
    /* ignore */
  }
  return null;
}

function saveCorner(c: Corner) {
  try {
    window.localStorage.setItem(CORNER_KEY, c);
  } catch {
    /* ignore */
  }
}

interface AvatarPipProps {
  avatar: AvatarState | null;
  characterName: string | null;
  characterId?: string | null;
  dnaTreeNodeId?: string | null;
  dnaTreeLabel?: string | null;
  onExpand: () => void;
  onHide: () => void;
}

export function AvatarPip({
  avatar,
  characterName,
  characterId = null,
  dnaTreeNodeId = null,
  dnaTreeLabel = null,
  onExpand,
  onHide,
}: AvatarPipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>(() => cornerPos("br"));
  const [dragging, setDragging] = useState(false);
  const [corner, setCorner] = useState<Corner>("br");
  const lastTapRef = useRef(0);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    const savedCorner = loadCorner();
    const saved = loadPos();
    const el = rootRef.current;
    const w = el?.offsetWidth ?? pipSize().w;
    const h = el?.offsetHeight ?? pipSize().h;
    if (savedCorner) {
      setCorner(savedCorner);
      setPos(cornerPos(savedCorner));
    } else if (saved) {
      const clamped = clampPos(saved, w, h);
      setPos(clamped);
      setCorner(nearestCorner(clamped, w, h));
    } else {
      setPos(cornerPos("br"));
    }
  }, []);

  useEffect(() => {
    const onResize = () => {
      const el = rootRef.current;
      if (!el) return;
      // Prefer snapping to stored corner on resize
      setPos(cornerPos(corner));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [corner]);

  const snapTo = useCallback((c: Corner) => {
    setCorner(c);
    saveCorner(c);
    const next = cornerPos(c);
    setPos(next);
    savePos(next);
  }, []);

  const endDrag = useCallback((ev: PointerEvent | React.PointerEvent, snap: boolean) => {
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
    if (!el) return;
    setPos((p) => {
      const clamped = clampPos(p, el.offsetWidth, el.offsetHeight);
      if (snap && d.moved) {
        const c = nearestCorner(clamped, el.offsetWidth, el.offsetHeight);
        setCorner(c);
        saveCorner(c);
        const snapped = cornerPos(c);
        savePos(snapped);
        return snapped;
      }
      savePos(clamped);
      return clamped;
    });
  }, []);

  const onPointerDown = (ev: React.PointerEvent) => {
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
    endDrag(ev, true);

    if (wasMoved) return;

    const now = Date.now();
    const doubleTap = now - lastTapRef.current < 320;
    lastTapRef.current = now;

    const onVideo = !!(ev.target as HTMLElement).closest("[data-pip-video]");
    const onHandle = !!(ev.target as HTMLElement).closest("[data-pip-handle]");

    if (doubleTap && (onVideo || onHandle)) {
      // Cycle corners on double-tap
      const idx = CORNER_ORDER.indexOf(corner);
      const next = CORNER_ORDER[(idx + 1) % CORNER_ORDER.length]!;
      snapTo(next);
      return;
    }

    if (onVideo) onExpand();
  };

  return (
    <div
      ref={rootRef}
      className={`fixed z-40 w-[7.25rem] touch-none select-none sm:w-36 ${
        dragging ? "cursor-grabbing transition-none" : "transition-[left,top] duration-200 ease-out"
      }`}
      style={{
        left: pos.x,
        top: pos.y,
        // Keep clear of iOS home indicator / notches when snapped low
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      role="dialog"
      aria-label="Live avatar picture-in-picture"
    >
      <div
        className={`overflow-hidden rounded-2xl border border-brand-accent/50 bg-brand-panel/95 shadow-glow ring-1 ring-black/40 backdrop-blur-md ${
          dragging ? "scale-[1.03] shadow-glow-sm" : "animate-rise-in"
        }`}
      >
        <div
          data-pip-handle
          className={`flex cursor-grab items-center justify-between gap-1 border-b border-brand-border/60 px-1.5 py-1 active:cursor-grabbing ${
            dragging ? "bg-brand-accent/15" : ""
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={(e) => endDrag(e, true)}
          title="Drag to move · double-tap to cycle corners"
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
                const idx = CORNER_ORDER.indexOf(corner);
                snapTo(CORNER_ORDER[(idx + 1) % CORNER_ORDER.length]!);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded px-1.5 py-0.5 text-[9px] text-brand-muted hover:bg-brand-bg hover:text-brand-text"
              title="Snap to next corner"
            >
              Snap
            </button>
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
          onPointerCancel={(e) => endDrag(e, true)}
          title="Drag · release snaps to corner · double-tap cycles · tap expands"
        >
          <AvatarVideo
            avatar={avatar}
            characterName={characterName}
            characterId={characterId}
            dnaTreeNodeId={dnaTreeNodeId}
            dnaTreeLabel={dnaTreeLabel}
            pip
          />
        </div>
      </div>
    </div>
  );
}
