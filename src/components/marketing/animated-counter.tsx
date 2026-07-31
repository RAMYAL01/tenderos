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
 *
 * The initial state is seeded with the REAL `value` (not 0), so the server-
 * rendered HTML — and therefore social link-preview bots, search crawlers,
 * reduced-motion users, and anyone with JS disabled — always sees the true
 * number. The count-up is a post-hydration flourish that animates from a
 * non-zero baseline (60% of target) up to the value, and is skipped entirely
 * when the visitor prefers reduced motion. Previously this seeded `0`, so the
 * band advertised "0 / 0+ / 0" everywhere JS hadn't run the animation yet.
 */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 1600,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // Seed with the real value so SSR / no-JS / crawlers never see 0. Client
  // hydration matches this exactly (also `value`), so there's no mismatch.
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion: leave the real value in place, skip the animation.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // Animate up from a non-zero baseline so the number never reads as 0/near-0
    // even mid-animation.
    const from = Math.max(1, Math.round(value * 0.6));

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        setDisplay(from);
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          // easeOutExpo
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          setDisplay(from + Math.round(eased * (value - from)));
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
