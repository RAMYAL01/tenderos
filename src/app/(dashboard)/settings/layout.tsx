import { getAuthContext } from "@/lib/auth";

// Icons are referenced by NAME (string) and resolved inside the client
// SettingsTabLink — components can't cross the server→client boundary.
const settingsTabs = [
  {
    label: "Workspace",
    href: "/settings/workspace",
    icon: "Building2",
    roles: ["OWNER", "ADMIN", "MANAGER", "SENIOR_WRITER", "WRITER", "REVIEWER", "VIEWER"],
  },
  {
    label: "Members",
    href: "/settings/members",
    icon: "Users",
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "Billing",
    href: "/settings/billing",
    icon: "CreditCard",
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "Notifications",
    href: "/settings/notifications",
    icon: "Bell",
    roles: ["OWNER", "ADMIN", "MANAGER", "SENIOR_WRITER", "WRITER", "REVIEWER", "VIEWER"],
  },
  {
    label: "Security",
    href: "/settings/security",
    icon: "Shield",
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "Audit Log",
    href: "/settings/audit",
    icon: "ScrollText",
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "Training Data",
    href: "/settings/training",
    icon: "Brain",
    roles: ["OWNER", "ADMIN"],
  },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { member } = await getAuthContext();

  const visibleTabs = settingsTabs.filter((tab) =>
    tab.roles.includes(member.role)
  );

  return (
    <div className="flex flex-1 flex-col">
      {/* Sub-navigation */}
      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="px-6">
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {visibleTabs.map((tab) => (
              <SettingsTabLink key={tab.href} tab={tab} />
            ))}
          </nav>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

// Client-side tab with active state detection must be in a server-safe way.
// Since we're in a server component, we'll create a small client component.
import { SettingsTabLink } from "./settings-tab-link";
