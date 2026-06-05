import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { MembersList } from "@/components/settings/members-list";
import { InviteMemberDialog } from "@/components/settings/invite-member-dialog";
import { getAuthContext, hasRole } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const metadata = { title: "Team Members" };

export default async function MembersPage() {
  const { org, member: currentMember } = await getAuthContext();

  // Only admins and owners can view this page
  if (!hasRole(currentMember.role, "ADMIN")) {
    redirect("/settings/workspace");
  }

  const members = await db.member.findMany({
    where: { orgId: org.id, isActive: true, deletedAt: null },
    orderBy: [
      // Sort by role hierarchy: owners first, then admins, etc.
      { role: "asc" },
      { name: "asc" },
    ],
  });

  const canManage = hasRole(currentMember.role, "ADMIN");

  return (
    <>
      <PageHeader
        title="Team Members"
        description={`${members.length} member${members.length === 1 ? "" : "s"} in your workspace`}
      >
        {canManage && <InviteMemberDialog />}
      </PageHeader>

      <div className="p-6">
        {/* Pending invitations info */}
        <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-400">
          <strong>Note:</strong> Pending invitations are managed in{" "}
          <span className="font-medium">Clerk</span>. Invited users appear here
          once they accept and log in.
        </div>

        <MembersList
          members={members}
          currentMemberId={currentMember.id}
          canManage={canManage}
        />
      </div>
    </>
  );
}
