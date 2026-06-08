import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata = {
  title: "Set up your workspace · TenderOS",
};

/**
 * Org-first onboarding. The COMPANY workspace is configured here before the
 * dashboard unlocks. Reached only when `organization.onboardingCompletedAt`
 * is null (the dashboard layout redirects here otherwise).
 */
export default async function OnboardingPage() {
  const { org, member } = await getAuthContext();

  // Already onboarded → straight to the product.
  if (org.onboardingCompletedAt) {
    redirect("/dashboard");
  }

  // Live setup-checklist signal (Step 3). Cheap counts, org-scoped.
  const [memberCount, tenderCount, knowledgeCount, proposalCount] = await Promise.all([
    db.member.count({ where: { orgId: org.id, isActive: true, deletedAt: null } }),
    db.tender.count({ where: { orgId: org.id } }),
    db.knowledgeChunk.count({ where: { orgId: org.id } }),
    db.proposal.count({ where: { orgId: org.id } }),
  ]);

  return (
    <OnboardingWizard
      member={{ name: member.name, role: member.role }}
      org={{
        name: org.name,
        organizationType: org.organizationType,
        countryCode: org.countryCode,
        employeeCount: org.employeeCount,
        website: org.website,
        planTier: org.planTier,
      }}
      setup={{
        profileDone: Boolean(org.organizationType),
        teamInvited: memberCount > 1,
        tenderUploaded: tenderCount > 0,
        knowledgeUploaded: knowledgeCount > 0,
        proposalCreated: proposalCount > 0,
      }}
    />
  );
}
