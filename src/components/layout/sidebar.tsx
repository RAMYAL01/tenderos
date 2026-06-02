import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { SidebarNav } from "./sidebar-nav";
import type { Member } from "@prisma/client";

interface SidebarProps {
  member: Member;
}

/**
 * Main application sidebar.
 *
 * Structure:
 * - TenderOS logo + wordmark
 * - Clerk OrganizationSwitcher (handles org selection + creation)
 * - Main navigation (client component for active states)
 * - Clerk UserButton at the bottom
 */
export function Sidebar({ member }: SidebarProps) {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-[#0F172A]">
      {/* ── Logo ────────────────────────────────────────────────── */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        {/* Icon mark */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <svg
            className="h-4.5 w-4.5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        {/* Wordmark */}
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-wide text-white">
            TenderOS
          </span>
          <span className="text-[10px] text-slate-500">Contract Intelligence</span>
        </div>
      </div>

      {/* ── Organization Switcher ──────────────────────────────── */}
      <div className="border-b border-white/10 px-3 py-3">
        <OrganizationSwitcher
          hidePersonal
          appearance={{
            elements: {
              rootBox: "w-full",
              organizationSwitcherTrigger:
                "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 hover:bg-white/10 transition-colors",
              organizationSwitcherTriggerIcon: "text-slate-500",
              organizationPreviewMainIdentifier: "text-slate-200 font-medium",
              organizationPreviewSecondaryIdentifier: "text-slate-500 text-xs",
            },
            variables: {
              colorBackground: "#1E293B",
              colorText: "#F1F5F9",
              colorTextSecondary: "#94A3B8",
              colorNeutral: "#334155",
              colorPrimary: "#3B82F6",
              borderRadius: "0.5rem",
            },
          }}
          afterSelectOrganizationUrl="/dashboard"
          afterCreateOrganizationUrl="/dashboard"
        />
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-y-auto py-4">
        <SidebarNav memberRole={member.role} />
      </div>

      {/* ── User area ─────────────────────────────────────────── */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-1.5">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
                userButtonPopoverCard: "shadow-xl",
              },
              variables: {
                colorPrimary: "#3B82F6",
                borderRadius: "0.5rem",
              },
            }}
            afterSignOutUrl="/sign-in"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">
              {member.name}
            </p>
            <p className="truncate text-xs text-slate-500">{member.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
