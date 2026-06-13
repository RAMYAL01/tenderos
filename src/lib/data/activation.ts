import { db } from "@/lib/prisma";

/**
 * Activation progress — the new-org onboarding checklist, computed from real
 * data (no separate tracking table). Each milestone maps to a product action
 * that moves a workspace toward its first "wow". Org-scoped.
 */

export interface ActivationStep {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  href: string;
  cta: string;
}

export interface ActivationProgress {
  steps: ActivationStep[];
  done: number;
  total: number;
  complete: boolean;
}

export async function getActivationProgress(
  org: { id: string; organizationType: string | null; countryCode: string | null }
): Promise<ActivationProgress> {
  const orgId = org.id;
  const [tenders, bids, proposals, members, invites, saved] = await Promise.all([
    db.tender.count({ where: { orgId, deletedAt: null } }),
    db.bidDecision.count({ where: { orgId } }),
    db.proposal.count({ where: { orgId, deletedAt: null } }),
    db.member.count({ where: { orgId, isActive: true, deletedAt: null } }),
    db.invitation.count({ where: { orgId } }),
    db.opportunityMatch.count({ where: { orgId, trackingStatus: { in: ["SAVED", "CONVERTED"] } } }),
  ]);

  const steps: ActivationStep[] = [
    {
      key: "profile",
      label: "Complete your company profile",
      hint: "So discovery and proposals are tailored to your firm.",
      done: Boolean(org.organizationType && org.countryCode),
      href: "/settings/workspace",
      cta: "Review",
    },
    {
      key: "discovery",
      label: "Save a discovery opportunity",
      hint: "We've matched live government tenders to your profile.",
      done: saved > 0,
      href: "/discover",
      cta: "Browse matches",
    },
    {
      key: "tender",
      label: "Add your first tender",
      hint: "Upload an RFP or convert a discovery match.",
      done: tenders > 0,
      href: "/tenders/new",
      cta: "Add tender",
    },
    {
      key: "bid",
      label: "Run a bid/no-bid qualification",
      hint: "Get an AI win-probability score in seconds.",
      done: bids > 0,
      href: "/tenders",
      cta: "Qualify",
    },
    {
      key: "proposal",
      label: "Generate your first proposal",
      hint: "Draft compliant sections with AI.",
      done: proposals > 0,
      href: "/tenders",
      cta: "Start",
    },
    {
      key: "team",
      label: "Invite a teammate",
      hint: "Bids are a team sport — add a reviewer or writer.",
      done: members > 1 || invites > 0,
      href: "/settings/members",
      cta: "Invite",
    },
  ];

  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length };
}
