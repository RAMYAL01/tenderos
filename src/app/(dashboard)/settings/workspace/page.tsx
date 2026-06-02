import { PageHeader } from "@/components/ui/page-header";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import { getAuthContext, hasRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { PLAN_LIMITS } from "@/lib/constants";
import { formatBytes } from "@/lib/utils";
import { db } from "@/lib/prisma";
import { Building2, Users, HardDrive, Zap } from "lucide-react";

export const metadata = { title: "Workspace Settings" };

async function UsageSummary({ orgId }: { orgId: string }) {
  const [memberCount, subscription] = await Promise.all([
    db.member.count({ where: { orgId, isActive: true, deletedAt: null } }),
    db.subscription.findUnique({ where: { orgId } }),
  ]);

  const plan = subscription?.planTier ?? "STARTER";
  const limits = PLAN_LIMITS[plan];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
          Plan & Usage
        </h3>
        <Badge variant="secondary" className="text-xs">
          {limits.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="h-3.5 w-3.5" />
            Team Members
          </div>
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {memberCount}
            <span className="ml-1 text-sm font-normal text-slate-400">
              / {limits.seats >= 999_999 ? "∞" : limits.seats}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Zap className="h-3.5 w-3.5" />
            AI Credits / Month
          </div>
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {subscription?.aiCreditsUsed ?? 0}
            <span className="ml-1 text-sm font-normal text-slate-400">
              / {limits.aiCreditsPerMonth >= 999_999 ? "∞" : limits.aiCreditsPerMonth}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <HardDrive className="h-3.5 w-3.5" />
            Storage Used
          </div>
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {formatBytes(Number(subscription?.storageBytesUsed ?? 0))}
            <span className="ml-1 text-sm font-normal text-slate-400">
              / {formatBytes(limits.storageBytesLimit)}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Building2 className="h-3.5 w-3.5" />
            Plan Price
          </div>
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {limits.price === 0 ? "Custom" : `$${limits.price}`}
            {limits.price > 0 && (
              <span className="ml-1 text-sm font-normal text-slate-400">
                /mo
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function WorkspaceSettingsPage() {
  const { org, member } = await getAuthContext();
  const canEdit = hasRole(member.role, "ADMIN");

  return (
    <>
      <PageHeader
        title="Workspace Settings"
        titleAr="إعدادات مساحة العمل"
        description="Manage your organization profile, language preferences, and plan usage."
      />

      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Usage summary */}
        <UsageSummary orgId={org.id} />

        {/* Settings form */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-6 font-semibold text-slate-900 dark:text-slate-100">
            Organization Profile
          </h3>
          <WorkspaceForm org={org} canEdit={canEdit} />
        </div>

        {/* Danger zone — delete org, only shown to OWNER */}
        {member.role === "OWNER" && (
          <div className="rounded-xl border border-red-200 bg-white p-6 dark:border-red-900/50 dark:bg-slate-900">
            <h3 className="mb-1 font-semibold text-red-600">Danger Zone</h3>
            <p className="mb-4 text-sm text-slate-500">
              Deleting your workspace permanently removes all tenders, proposals,
              documents, and team data. This cannot be undone.
            </p>
            <button
              type="button"
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
              disabled
            >
              Delete Workspace
            </button>
            <p className="mt-2 text-xs text-slate-400">
              Contact support to delete your workspace.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
