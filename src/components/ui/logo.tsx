import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";

interface LogoProps {
  /** "dark" = light text for dark backgrounds; "light" = dark text for light backgrounds. */
  variant?: "light" | "dark";
  /** Show the "TenderOS" wordmark next to the mark. */
  showWordmark?: boolean;
  /** Show the tagline below the wordmark. */
  showTagline?: boolean;
  /** Mark height in px. Wordmark scales with it. */
  size?: number;
  /** Wrap in a link to href. */
  href?: string;
  className?: string;
}

/**
 * TenderOS brand lockup — transparent power-mark + text wordmark.
 * Rendering the wordmark as text (not a baked image) keeps it crisp at any
 * size and avoids the solid-background box in the exported logo PNGs.
 */
export function Logo({
  variant = "light",
  showWordmark = true,
  showTagline = false,
  size = 36,
  href,
  className,
}: LogoProps) {
  const wordColor =
    variant === "dark" ? "text-white" : "text-slate-900 dark:text-white";

  // The SVG mark is tightly cropped, so size it ~1.15x the wordmark base
  // to match the "TenderOS" cap height with a small gap.
  const markBox = Math.round(size * 1.15);

  const inner = (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark size={markBox} variant={variant} />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={cn("font-bold tracking-tight", wordColor)}
            style={{ fontSize: size * 0.66 }}
          >
            Tender<span className="text-blue-600">OS</span>
          </span>
          {showTagline && (
            <span
              className="mt-1 font-medium uppercase tracking-[0.16em] text-slate-400"
              style={{ fontSize: size * 0.17 }}
            >
              Winning Contracts
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center" aria-label="TenderOS home">
        {inner}
      </Link>
    );
  }
  return inner;
}
