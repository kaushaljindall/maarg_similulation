"use client";

import { useEffect, useRef } from "react";
import type { CityEngine } from "@/lib/city-engine";

export function CityCanvas({
  engine,
  running,
  speed = 3,
  heatmap,
  packets,
  cameras = true,
  timers = true,
  cloudBand,
  selected,
  onSelect,
  onTick,
  className,
  label,
}: {
  engine: CityEngine;
  running: boolean;
  speed?: number;
  heatmap: boolean;
  packets: boolean;
  cameras?: boolean;
  timers?: boolean;
  cloudBand: boolean;
  selected: number;
  onSelect?: (j: number) => void;
  onTick?: () => void;
  className?: string;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opts = useRef({ running, speed, heatmap, packets, cameras, timers, cloudBand, selected, onTick });
  opts.current = { running, speed, heatmap, packets, cameras, timers, cloudBand, selected, onTick };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let tickAcc = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = engine.width * dpr;
      canvas.height = engine.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const o = opts.current;
      if (visible) {
        if (o.running) {
          const steps = Math.ceil(o.speed);
          for (let i = 0; i < steps; i++) engine.step((dt * o.speed) / steps);
        }
        engine.draw(ctx, o);
        tickAcc += dt;
        if (tickAcc > 0.25) {
          tickAcc = 0;
          o.onTick?.();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [engine]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={className}
      style={{ width: "100%", height: "auto", aspectRatio: `${engine.width} / ${engine.height}`, cursor: onSelect ? "pointer" : "default" }}
      onClick={(e) => {
        if (!onSelect) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * engine.width;
        const y = ((e.clientY - rect.top) / rect.height) * engine.height;
        const j = engine.junctionAt(x, y);
        if (j >= 0) onSelect(j);
      }}
    />
  );
}
