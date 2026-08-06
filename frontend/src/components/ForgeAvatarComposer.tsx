"use client";

import { useEffect, useRef } from "react";
import type { MediaClipKey } from "@/lib/types";
import type { NaughtySyntaxDna } from "@/lib/forge-dna";

const BAND_COLOR: Record<MediaClipKey, string> = {
  idle: "120, 90, 200",
  teasing: "200, 80, 140",
  playful: "240, 120, 80",
  aroused: "255, 50, 90",
};

/**
 * Canvas overlay for instant visual feedback — intensity pulse + band aura
 * over the live video preview (WebGL-free, 60fps-friendly Canvas2D).
 */
export function ForgeAvatarComposer({
  band,
  intensity,
  dna,
  active = true,
}: {
  band: MediaClipKey;
  intensity: number;
  dna?: NaughtySyntaxDna | null;
  active?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);
  const t0 = useRef(performance.now());

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const rgb = BAND_COLOR[band] || BAND_COLOR.teasing;
    const chaos = dna?.evolution.chaos ?? 0.35;
    const pace = dna?.evolution.pace ?? 0.5;

    const draw = (now: number) => {
      const parent = canvas.parentElement;
      if (!parent) {
        raf.current = requestAnimationFrame(draw);
        return;
      }
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const t = (now - t0.current) / 1000;
      const pulse = 0.55 + Math.sin(t * (1.2 + pace * 2 + intensity)) * 0.2 * (0.4 + intensity);

      ctx.clearRect(0, 0, w, h);

      // Vignette
      const g = ctx.createRadialGradient(
        w * 0.5,
        h * 0.45,
        w * 0.1,
        w * 0.5,
        h * 0.5,
        w * 0.75,
      );
      g.addColorStop(0, `rgba(${rgb}, 0)`);
      g.addColorStop(0.55, `rgba(${rgb}, ${0.04 + intensity * 0.06})`);
      g.addColorStop(1, `rgba(0, 0, 0, ${0.35 + intensity * 0.25})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Intensity ring
      const cx = w * 0.5;
      const cy = h * 0.42;
      const r = Math.min(w, h) * (0.28 + intensity * 0.08) * pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rgb}, ${0.25 + intensity * 0.45})`;
      ctx.lineWidth = 2 + intensity * 3;
      ctx.stroke();

      // Chaos particles
      const n = 4 + Math.floor(chaos * 8);
      for (let i = 0; i < n; i++) {
        const a = t * (0.4 + chaos) + (i / n) * Math.PI * 2;
        const rr = r * (0.7 + (i % 3) * 0.12);
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a * (1 + chaos * 0.3)) * rr * 0.85;
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + intensity * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${0.35 + intensity * 0.4})`;
        ctx.fill();
      }

      // Scanline heat (subtle)
      if (intensity > 0.55) {
        ctx.fillStyle = `rgba(${rgb}, ${0.03 + (intensity - 0.55) * 0.08})`;
        const yLine = ((t * 40) % h);
        ctx.fillRect(0, yLine, w, 2);
      }

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
    };
  }, [active, band, intensity, dna]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      aria-hidden
    />
  );
}
