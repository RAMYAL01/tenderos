"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  CheckSquare,
  BookOpen,
  BarChart2,
  Settings,
  Shield,
} from "lucide-react";

interface NavItem {
  label: string;
  labelAr: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const mainNav: NavItem[] = [
  {
    label: "Dashboard",
    labelAr: "لوحة التحكم",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Tenders",
    labelAr: "المناقصات",
    href: "/tenders",
    icon: FolderOpen,
  },
  {
    label: "Proposals",
    labelAr: "العروض الفنية",
    href: "/proposals",
    icon: FileText,
  },
  {
    label: "Compliance",
    labelAr: "الامتثال",
    href: "/compliance",
    icon: CheckSquare,
  },
  {
    label: "Knowledge",
    labelAr: "ذاكرة الشركة",
    href: "/library",
    icon: BookOpen,
  },
  {
    label: "Analytics",
    labelAr: "التحليلات",
    href: "/analytics",
    icon: BarChart2,
  },
];

const bottomNav: NavItem[] = [
  {
    label: "Settings",
    labelAr: "الإعدادات",
    href: "/settings/workspace",
    icon: Settings,
  },
];

interface SidebarNavProps {
  memberRole: string;
}

export function SidebarNav({ memberRole }: SidebarNavProps) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {/* Main navigation */}
      <div className="flex flex-col gap-0.5">
        {mainNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-gradient-to-r from-blue-600/25 via-blue-600/10 to-transparent text-white"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
              )}
            >
              {/* Active accent bar */}
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-all duration-200",
                  active
                    ? "text-blue-400"
                    : "text-slate-500 group-hover:translate-x-0.5 group-hover:text-slate-300"
                )}
              />
              <span>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-semibold text-white">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Divider */}
      <div className="mb-1 h-px bg-white/10" />

      {/* Bottom navigation */}
      <div className="flex flex-col gap-0.5">
        {bottomNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-gradient-to-r from-blue-600/25 via-blue-600/10 to-transparent text-white"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-all duration-200",
                  active
                    ? "text-blue-400"
                    : "text-slate-500 group-hover:translate-x-0.5 group-hover:text-slate-300"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Admin-only link */}
        {["OWNER", "ADMIN"].includes(memberRole) && (
          <Link
            href="/settings/members"
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              pathname.startsWith("/settings/members")
                ? "bg-gradient-to-r from-blue-600/25 via-blue-600/10 to-transparent text-white"
                : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
            )}
          >
            {pathname.startsWith("/settings/members") && (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
            )}
            <Shield
              className={cn(
                "h-4 w-4 shrink-0 transition-all duration-200",
                pathname.startsWith("/settings/members")
                  ? "text-blue-400"
                  : "text-slate-500 group-hover:translate-x-0.5 group-hover:text-slate-300"
              )}
            />
            <span>Members</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
