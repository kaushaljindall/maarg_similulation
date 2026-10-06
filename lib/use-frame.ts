"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Runs `cb(dt)` every animation frame while `active` and the element is on screen, re-rendering at ~fps. */
export function useFrame(cb: (dt: number) => void, active: boolean, ref?: RefObject<Element | null>, fps = 30) {
  const saved = useRef(cb);
  const [, setTick] = useState(0);
  useEffect(() => {
    saved.current = cb;
  }, [cb]);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let visible = true;
    let io: IntersectionObserver | undefined;
    if (ref?.current) {
      io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
      io.observe(ref.current);
    }
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (visible) {
        saved.current(dt);
        acc += dt;
        if (acc >= 1 / fps) {
          acc = 0;
          setTick((t) => (t + 1) % 1e6);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [active, ref, fps]);
}
