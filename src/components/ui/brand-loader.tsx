import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";

interface BrandLoaderProps {
  /** Loading message shown beneath the mark. Pass null to hide. */
  label?: string | null;
  /** Size of the mark in pixels. */
  size?: number;
  /** Full-screen centered overlay vs inline. */
  fullScreen?: boolean;
  className?: string;
}

/**
 * Branded loading indicator — uses the TenderOS power-mark with a
 * pulsing glow and a rotating accent ring. Replaces generic spinners
 * app-wide so loading always feels on-brand.
 */
export function BrandLoader({
  label = "Loading TenderOS…",
  size = 56,
  fullScreen = false,
  className,
}: BrandLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5",
        fullScreen &&
          "min-h-screen w-full bg-slate-50 dark:bg-slate-950",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size * 1.6, height: size * 1.6 }}
      >
        {/* Rotating accent ring */}
        <span
          className="absolute inset-0 animate-brand-ring rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(59,130,246,0.6) 360deg)",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          }}
          aria-hidden="true"
        />
        {/* Soft glow */}
        <span
          className="absolute inset-2 rounded-full bg-blue-500/10 blur-md"
          aria-hidden="true"
        />
        {/* The mark */}
        <BrandMark size={size} className="animate-brand-pulse" />
      </div>

      {label && (
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}
