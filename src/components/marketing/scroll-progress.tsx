"use client";

import { useEffect, useRef } from "react";

/**
 * Thin gradient bar pinned to the top that fills as the user scrolls.
 *
 * Smoothness: we never call setState on scroll (that re-renders React on
 * every frame and stutters). Instead we mutate the bar's transform directly
 * via ref inside a single rAF, using GPU-accelerated scaleX.
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  const ticking = useRef(false);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const apply = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const p = max > 0 ? doc.scrollTop / max : 0;
      bar.style.transform = `scaleX(${p})`;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(apply);
      }
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 will-change-transform"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
