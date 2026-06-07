import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { SidebarNav } from "./sidebar-nav";
import { Logo } from "@/components/ui/logo";
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
    <aside className="relative flex h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-[#101a30] via-[#0c1424] to-[#080d18]">
      {/* Ambient top glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.35), transparent 70%)" }}
      />

      {/* ── Logo ────────────────────────────────────────────────── */}
      <div className="relative flex h-16 shrink-0 items-center border-b border-white/10 px-5">
        <Logo variant="dark" size={30} href="/dashboard" />
      </div>

      {/* ── Organization Switcher ──────────────────────────────── */}
      <div className="relative border-b border-white/10 px-3 py-3">
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
      <div className="sidebar-scroll relative flex flex-1 flex-col overflow-y-auto py-4">
        <SidebarNav memberRole={member.role} />
      </div>

      {/* ── User area ─────────────────────────────────────────── */}
      <div className="relative border-t border-white/10 p-3">
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
