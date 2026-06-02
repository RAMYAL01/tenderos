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
    label: "Library",
    labelAr: "مكتبة المحتوى",
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
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-white/15 text-white"
                  : "text-slate-400 hover:bg-white/8 hover:text-slate-100"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
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
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-white/15 text-white"
                  : "text-slate-400 hover:bg-white/8 hover:text-slate-100"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
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
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
              pathname.startsWith("/settings/members")
                ? "bg-white/15 text-white"
                : "text-slate-400 hover:bg-white/8 hover:text-slate-100"
            )}
          >
            <Shield className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-slate-300" />
            <span>Members</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
