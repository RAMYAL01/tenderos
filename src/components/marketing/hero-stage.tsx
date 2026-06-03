"use client";

import { useRef, useState, useCallback } from "react";
import { HeroMockup } from "./hero-mockup";

/**
 * Interactive 3D stage for the hero mockup. The product card rests at a
 * slight backward tilt (Stripe/Linear style) and rotates toward the cursor
 * with parallax. A soft glow follows the pointer behind it.
 */
export function HeroStage() {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const [tilt, setTilt] = useState({ rx: 8, ry: 0 });
  const [glow, setGlow] = useState({ x: 50, y: 30, o: 0 });

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      // Rest tilt is rotateX(8). Mouse adds ±6 of pitch and ±10 of yaw.
      setTilt({ rx: 8 - (py - 0.5) * 12, ry: (px - 0.5) * 20 });
      setGlow({ x: px * 100, y: py * 100, o: 1 });
    });
  }, []);

  const onLeave = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    setTilt({ rx: 8, ry: 0 });
    setGlow((g) => ({ ...g, o: 0 }));
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="perspective-1500 relative mx-auto mt-16 max-w-4xl"
    >
      {/* Cursor-following glow behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 -z-10 transition-opacity duration-300"
        style={{
          opacity: 0.6 + glow.o * 0.4,
          background: `radial-gradient(420px circle at ${glow.x}% ${glow.y}%, rgba(59,130,246,0.35), transparent 60%)`,
          filter: "blur(20px)",
        }}
      />

      {/* Reflection / floor shadow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 bottom-0 h-24 rounded-[50%] bg-blue-900/20 blur-2xl"
      />

      {/* The 3D card */}
      <div
        className="preserve-3d transition-transform duration-300 ease-out will-change-transform"
        style={{
          transform: `rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(2)}deg)`,
        }}
      >
        <HeroMockup />
      </div>
    </div>
  );
}
