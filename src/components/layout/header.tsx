"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tenders": "Tenders",
  "/proposals": "Proposals",
  "/compliance": "Compliance",
  "/library": "Content Library",
  "/analytics": "Analytics",
  "/settings/workspace": "Workspace Settings",
  "/settings/members": "Team Members",
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Prefix match
  const prefix = Object.keys(PAGE_TITLES).find((key) =>
    pathname.startsWith(key)
  );
  return prefix ? PAGE_TITLES[prefix] : "TenderOS";
}

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const title = getPageTitle(pathname);

  return (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-950",
        className
      )}
    >
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Page title */}
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Global search */}
      <div className="hidden items-center md:flex">
        {searchOpen ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              autoFocus
              placeholder="Search tenders, proposals..."
              className="w-72 pl-9 text-sm"
              onBlur={() => setSearchOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchOpen(false);
              }}
            />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-slate-500 hover:text-slate-700"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="text-sm">Search</span>
            <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400 xl:block">
              ⌘K
            </kbd>
          </Button>
        )}
      </div>

      {/* Notifications */}
      <Button
        variant="ghost"
        size="icon"
        className="relative text-slate-500 hover:text-slate-700"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {/* Notification dot — show when there are unread notifications */}
        {/* <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600" /> */}
      </Button>
    </header>
  );
}
