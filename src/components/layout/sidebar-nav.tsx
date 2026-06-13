"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  SquareKanban,
  Compass,
  FolderOpen,
  FileText,
  CheckSquare,
  BookOpen,
  BarChart2,
  Handshake,
  Settings,
  Shield,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Pipeline", href: "/pipeline", icon: SquareKanban },
  { label: "Discover", href: "/discover", icon: Compass },
  { label: "Tenders", href: "/tenders", icon: FolderOpen },
  { label: "Proposals", href: "/proposals", icon: FileText },
  { label: "Compliance", href: "/compliance", icon: CheckSquare },
  { label: "Knowledge", href: "/library", icon: BookOpen },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
  { label: "Marketplace", href: "/marketplace", icon: Handshake },
];

const bottomNav: NavItem[] = [{ label: "Settings", href: "/settings/workspace", icon: Settings }];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200",
        active
          ? "bg-white/[0.07] text-white"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
      )}
    >
      {/* Active accent rail */}
      {active && (
        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-blue-400 to-cyan-400 shadow-[0_0_10px_rgba(96,165,250,0.7)]" />
      )}
      {/* Icon chip */}
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
          active
            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-600/30"
            : "text-slate-500 group-hover:text-slate-200"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span>{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-semibold text-white">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
      {children}
    </p>
  );
}

export function SidebarNav({
  memberRole,
  discoverBadge = 0,
}: {
  memberRole: string;
  discoverBadge?: number;
}) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 px-4">
      <SectionLabel>Main</SectionLabel>
      <div className="flex flex-col gap-1">
        {mainNav.map((item) => (
          <NavLink
            key={item.href}
            item={item.href === "/discover" ? { ...item, badge: discoverBadge } : item}
            active={isActive(item.href)}
          />
        ))}
      </div>

      <div className="flex-1" />

      <div className="mb-1 h-px bg-white/10" />

      <SectionLabel>Workspace</SectionLabel>
      <div className="flex flex-col gap-1">
        {bottomNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        {["OWNER", "ADMIN"].includes(memberRole) && (
          <NavLink
            item={{ label: "Members", href: "/settings/members", icon: Shield }}
            active={pathname.startsWith("/settings/members")}
          />
        )}
      </div>
    </nav>
  );
}
