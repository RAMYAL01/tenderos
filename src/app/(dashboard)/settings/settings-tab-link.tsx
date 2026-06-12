"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users, CreditCard, Bell, Shield, Brain, ScrollText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icon components can't be passed as props from a Server Component to a Client
 * Component (React can't serialize a function). So tabs carry an icon *name*
 * and we resolve it to a component here, on the client.
 */
const ICONS: Record<string, LucideIcon> = {
  Building2,
  Users,
  CreditCard,
  Bell,
  Shield,
  Brain,
  ScrollText,
};

interface Tab {
  label: string;
  href: string;
  icon: string;
}

export function SettingsTabLink({ tab }: { tab: Tab }) {
  const pathname = usePathname();
  const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
  const Icon = ICONS[tab.icon] ?? Building2;

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
