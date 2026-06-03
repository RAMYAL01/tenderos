"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  /** Numeric target to count up to. */
  value: number;
  /** Text shown before the number (e.g. "$"). */
  prefix?: string;
  /** Text shown after the number (e.g. "+", "%", "x"). */
  suffix?: string;
  /** Duration of the count animation in ms. */
  duration?: number;
  className?: string;
}

/**
 * Counts up to `value` when scrolled into view. Used for the stats band.
 */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 1600,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          // easeOutExpo
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          setDisplay(Math.round(eased * value));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
