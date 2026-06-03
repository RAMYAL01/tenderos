"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Delay in ms before the reveal transition starts. */
  delay?: number;
  /** Accepted for call-site readability; the wrapper always renders a div. */
  as?: "div" | "section" | "li";
}

/**
 * Scroll-reveal wrapper. Fades + lifts its children into view the
 * first time they enter the viewport. Respects prefers-reduced-motion
 * (handled in globals.css).
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If the element is already in view on mount (above-the-fold hero),
    // reveal immediately — IntersectionObserver can miss already-visible
    // elements on initial load, leaving content stuck hidden.
    const rect = el.getBoundingClientRect();
    const alreadyInView =
      rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyInView) {
      const t = setTimeout(() => setShown(true), delay);
      return () => clearTimeout(t);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setShown(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={cn("reveal-init", shown && "reveal-show", className)}
    >
      {children}
    </div>
  );
}
