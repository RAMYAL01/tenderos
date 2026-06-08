import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";

/**
 * Dashboard layout — server component.
 *
 * - Authenticates user via Clerk + syncs to our DB
 * - Provides org + member context to all child components
 * - Renders sidebar + header shell
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This validates auth, fetches org + member from DB,
  // and redirects to /sign-in if anything is wrong.
  const { org, member } = await getAuthContext();

  // Org-first gate: a workspace must finish the onboarding wizard before the
  // dashboard is usable. Existing workspaces were backfilled, so only brand-new
  // companies are routed here.
  if (!org.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return (
    <WorkspaceProvider org={org} member={member}>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Sidebar — fixed left panel */}
        <Sidebar member={member} org={org} />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
