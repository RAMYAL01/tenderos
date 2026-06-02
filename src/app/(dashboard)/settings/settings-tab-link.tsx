"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Tab {
  label: string;
  href: string;
  icon: LucideIcon;
}

export function SettingsTabLink({ tab }: { tab: Tab }) {
  const pathname = usePathname();
  const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
  const Icon = tab.icon;

  return (
    <Link
      href={tab.href}
      className={cn(
        "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
        isActive
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300"
      )}
    >
      <Icon className="h-4 w-4" />
      {tab.label}
    </Link>
  );
}
