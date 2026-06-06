import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  children?: React.ReactNode; // action buttons
  className?: string;
}

/**
 * Consistent page header used across all dashboard pages.
 * Supports bilingual titles (EN + AR).
 */
export function PageHeader({
  title,
  titleAr,
  description,
  descriptionAr,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex flex-col gap-4 border-b border-slate-200/70 bg-white/80 px-6 py-5 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:border-slate-800/70 dark:bg-slate-950/80 dark:supports-[backdrop-filter]:bg-slate-950/70 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          {titleAr && (
            <span
              className="text-base text-slate-500 dark:text-slate-400"
              dir="rtl"
              style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
            >
              {titleAr}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
        {descriptionAr && (
          <p
            className="mt-0.5 text-xs text-slate-400"
            dir="rtl"
            style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
          >
            {descriptionAr}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  );
}
