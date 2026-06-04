import Link from "next/link";
import { cn } from "@/lib/utils";

interface ShinyButtonProps {
  href: string;
  children: React.ReactNode;
  /** Visual style. */
  variant?: "primary" | "ghost" | "white";
  size?: "sm" | "md" | "lg";
  className?: string;
  external?: boolean;
}

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-8 text-[15px]",
};

/**
 * Premium marketing CTA. Gradient fill, layered glow, animated sheen sweep
 * on hover, and a subtle press. The `ghost` and `white` variants share the
 * same sheen + lift mechanics for consistency across the page.
 */
export function ShinyButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
  external = false,
}: ShinyButtonProps) {
  const base =
    "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold transition-all duration-300 will-change-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

  const variants = {
    primary:
      "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40",
    white:
      "bg-white text-blue-700 shadow-lg shadow-blue-900/10 hover:shadow-xl",
    ghost:
      "border border-slate-200 bg-white/60 text-slate-700 backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
  };

  const content = (
    <>
      {/* Sheen sweep */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
      >
        <span className="absolute -inset-y-2 -left-1/3 w-1/3 -translate-x-full -skew-x-12 bg-white/30 blur-md transition-transform duration-700 ease-out group-hover:translate-x-[400%]" />
      </span>
      {/* Inner top highlight for depth (primary only) */}
      {variant === "primary" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/40"
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
    </>
  );

  if (external) {
    return (
      <a href={href} className={cn(base, variants[variant], sizes[size], className)}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {content}
    </Link>
  );
}
