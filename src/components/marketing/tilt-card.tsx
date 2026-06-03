"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** Max tilt angle in degrees. */
  max?: number;
  /** Scale applied on hover. */
  scale?: number;
  /** Show the cursor-following glare highlight. */
  glare?: boolean;
  /** Glare color (rgba). */
  glareColor?: string;
}

/**
 * Mouse-tracking 3D tilt card. Rotates in perspective toward the cursor
 * and paints a soft glare that follows the pointer. Pure CSS transforms —
 * no WebGL — so it stays light and SSR-safe.
 */
export function TiltCard({
  children,
  className,
  max = 10,
  scale = 1.02,
  glare = true,
  glareColor = "rgba(255,255,255,0.22)",
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(
    "perspective(1100px) rotateX(0deg) rotateY(0deg) scale(1)"
  );
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, o: 0 });
  const frame = useRef<number | null>(null);

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 2 * max;
      const rotateX = -(py - 0.5) * 2 * max;

      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        setTransform(
          `perspective(1100px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(
            2
          )}deg) scale(${scale})`
        );
        setGlarePos({ x: px * 100, y: py * 100, o: 1 });
      });
    },
    [max, scale]
  );

  const handleLeave = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    setTransform("perspective(1100px) rotateX(0deg) rotateY(0deg) scale(1)");
    setGlarePos((p) => ({ ...p, o: 0 }));
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn(
        "relative will-change-transform transition-transform duration-200 ease-out",
        className
      )}
      style={{ transform, transformStyle: "preserve-3d" }}
    >
      {children}
      {glare && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-200"
          style={{
            opacity: glarePos.o,
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, ${glareColor}, transparent 55%)`,
          }}
        />
      )}
    </div>
  );
}
