import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata = {
  title: "Set up your workspace · TenderOS",
};

/**
 * Org-first onboarding.
 *
 * IMPORTANT: this page uses Clerk's `auth()` directly — NOT `getAuthContext()` —
 * because it must run BEFORE a company workspace (Clerk organization) exists.
 * Step 1 of the wizard creates that organization. Routing here:
 *  - signed-out            → /sign-in
 *  - signed in, no org     → wizard at Step 1 (create the company)
 *  - signed in, org, !done → wizard (profile may pre-fill; finish setup)
 *  - signed in, org, done  → /dashboard
 */
export default async function OnboardingPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  // If a workspace already exists and finished onboarding, go to the product.
  let org = null;
  if (orgId) {
    org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
    if (org?.onboardingCompletedAt) redirect("/dashboard");
  }

  // Live setup-checklist signal (Step 3). Zero when no workspace exists yet.
  let setup = {
    profileDone: false,
    teamInvited: false,
    tenderUploaded: false,
    knowledgeUploaded: false,
    proposalCreated: false,
  };
  if (org) {
    const [memberCount, tenderCount, knowledgeCount, proposalCount] = await Promise.all([
      db.member.count({ where: { orgId: org.id, isActive: true, deletedAt: null } }),
      db.tender.count({ where: { orgId: org.id } }),
      db.knowledgeChunk.count({ where: { orgId: org.id } }),
      db.proposal.count({ where: { orgId: org.id } }),
    ]);
    setup = {
      profileDone: Boolean(org.organizationType),
      teamInvited: memberCount > 1,
      tenderUploaded: tenderCount > 0,
      knowledgeUploaded: knowledgeCount > 0,
      proposalCreated: proposalCount > 0,
    };
  }

  const user = await currentUser();
  const memberName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.emailAddresses[0]?.emailAddress ||
    "there";

  return (
    <OnboardingWizard
      hasOrg={Boolean(orgId)}
      member={{ name: memberName }}
      org={{
        name: org?.name ?? "",
        organizationType: org?.organizationType ?? null,
        countryCode: org?.countryCode ?? null,
        employeeCount: org?.employeeCount ?? null,
        website: org?.website ?? null,
        planTier: org?.planTier ?? "STARTER",
      }}
      setup={setup}
    />
  );
}
