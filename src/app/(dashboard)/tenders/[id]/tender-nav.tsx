"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FileText, CheckSquare, FolderOpen, ClipboardList, HelpCircle, Calculator, Target } from "lucide-react";

const tabs = [
  { label: "Documents", href: "", icon: FolderOpen },
  { label: "Requirements", href: "/requirements", icon: ClipboardList },
  { label: "Compliance", href: "/compliance", icon: CheckSquare },
  { label: "Proposals", href: "/proposals", icon: FileText },
  { label: "Financial", href: "/financial", icon: Calculator },
  { label: "Optimization", href: "/optimization", icon: Target },
  { label: "Clarifications", href: "/clarifications", icon: HelpCircle },
];

export function TenderNav({ tenderId }: { tenderId: string }) {
  const pathname = usePathname();
  const base = `/tenders/${tenderId}`;

  return (
    <div className="border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-950">
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {tabs.map((tab) => {
          const href = `${base}${tab.href}`;
          const isActive = tab.href === ""
            ? pathname === base
            : pathname.startsWith(href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
