import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { MembersList } from "@/components/settings/members-list";
import { InviteMemberDialog } from "@/components/settings/invite-member-dialog";
import { PendingInvitations } from "@/components/settings/pending-invitations";
import { getAuthContext, hasRole } from "@/lib/auth";
import { isOidcAuth } from "@/lib/auth/mode";
import { db } from "@/lib/prisma";
import type { InvitationDTO } from "@/lib/actions/invitations";

export const metadata = { title: "Team Members" };

export default async function MembersPage() {
  const { org, member: currentMember } = await getAuthContext();

  // Only admins and owners can view this page
  if (!hasRole(currentMember.role, "ADMIN")) {
    redirect("/settings/workspace");
  }

  const oidc = isOidcAuth();
  const canManage = hasRole(currentMember.role, "ADMIN");
  const canInviteAdmin = currentMember.role === "OWNER";

  const [members, invitationRows] = await Promise.all([
    db.member.findMany({
      where: { orgId: org.id, isActive: true, deletedAt: null },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    // App-native invitations (cloud only — OIDC provisions via the IdP).
    oidc
      ? Promise.resolve([])
      : db.invitation.findMany({
          where: { orgId: org.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
  ]);

  const invitations: InvitationDTO[] = invitationRows.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    status: i.status,
    token: i.token,
    path: `/invite/${i.token}`,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Team Members"
        description={`${members.length} member${members.length === 1 ? "" : "s"} in your workspace`}
      >
        {canManage && !oidc && <InviteMemberDialog canInviteAdmin={canInviteAdmin} />}
      </PageHeader>

      <div className="p-6">
        {oidc ? (
          <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-400">
            <strong>Note:</strong> Members are provisioned by your{" "}
            <span className="font-medium">identity provider (SSO)</span>. Users appear
            here on first sign-in; roles come from their IdP groups.
          </div>
        ) : (
          <PendingInvitations invitations={invitations} canManage={canManage} />
        )}

        <MembersList
          members={members}
          currentMemberId={currentMember.id}
          canManage={canManage}
        />
      </div>
    </>
  );
}
