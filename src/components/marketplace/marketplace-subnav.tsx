"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Directory", href: "/marketplace" },
  { label: "My profile", href: "/marketplace/profile" },
  { label: "Connections", href: "/marketplace/connections" },
] as const;

/** Lightweight tab strip shared by the three marketplace routes. */
export function MarketplaceSubnav({ incoming = 0 }: { incoming?: number }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 border-b border-slate-200/70 px-6 dark:border-slate-800/70">
      {tabs.map((t) => {
        const active = t.href === "/marketplace" ? pathname === "/marketplace" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative -mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
              active
                ? "border-blue-600 text-slate-900 dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            {t.label}
            {t.href === "/marketplace/connections" && incoming > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-semibold text-white">
                {incoming > 99 ? "99+" : incoming}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
