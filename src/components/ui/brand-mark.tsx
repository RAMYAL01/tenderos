import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** Pixel size (square). */
  size?: number;
  /** "dark" = light T for dark backgrounds; "light" = navy T for light backgrounds. */
  variant?: "light" | "dark";
  className?: string;
}

/**
 * TenderOS power-mark as inline SVG — the "T" formed by a bar + stem,
 * wrapped by a power-button ring. Vector so it's crisp at any size and
 * truly transparent (the exported PNG ships with a white background).
 */
export function BrandMark({
  size = 40,
  variant = "light",
  className,
}: BrandMarkProps) {
  const tColor = variant === "dark" ? "#FFFFFF" : "#0F172A";
  const ring = variant === "dark" ? "#3B82F6" : "#2563EB";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="TenderOS"
      className={cn("shrink-0", className)}
    >
      {/* Power-button ring */}
      <circle cx="48" cy="55" r="25" stroke={ring} strokeWidth="10" />
      {/* T — top bar */}
      <rect x="25" y="15" width="46" height="10" rx="5" fill={tColor} />
      {/* T — stem (passes through the top of the ring) */}
      <rect x="43" y="15" width="10" height="46" rx="5" fill={tColor} />
    </svg>
  );
}
