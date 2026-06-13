"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ContentLanguage, SectionType } from "@prisma/client";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import { checkAndConsumeProposalQuota } from "@/lib/billing/quota";
import { track, analyticsContext } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

const CreateProposalSchema = z.object({
  tenderId: z.string().min(1),
  title: z.string().min(1).max(300),
  language: z.nativeEnum(ContentLanguage).default("EN"),
});

const CreateSectionSchema = z.object({
  proposalId: z.string().min(1),
  sectionType: z.nativeEnum(SectionType),
  titleEn: z.string().optional(),
  titleAr: z.string().optional(),
  orderIndex: z.number().default(0),
});

export interface ProposalActionResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function createProposal(
  data: z.infer<typeof CreateProposalSchema>
): Promise<ProposalActionResult> {
  try {
    const { clerkUserId, org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");
    const analytics = analyticsContext({ clerkUserId, org, member });

    const validated = CreateProposalSchema.parse(data);

    const tender = await db.tender.findFirst({
      where: { id: validated.tenderId, orgId: org.id, deletedAt: null },
    });
    if (!tender) return { success: false, error: "Tender not found" };

    // Plan limit: proposals per month.
    const quota = await checkAndConsumeProposalQuota(org.id);
    if (!quota.ok) {
      after(() => track(ANALYTICS_EVENTS.PLAN_LIMIT_REACHED, analytics, { limit_type: "proposal" }));
      return { success: false, error: quota.error };
    }

    // Build default sections based on tender type
    const defaultSections: SectionType[] = [
      "COVER_LETTER",
      "EXECUTIVE_SUMMARY",
      "COMPANY_OVERVIEW",
      "TECHNICAL_APPROACH",
      "METHODOLOGY",
      "WORK_PLAN",
      "TEAM_QUALIFICATIONS",
      "PAST_PERFORMANCE",
    ];

    const proposal = await db.proposal.create({
      data: {
        tenderId: validated.tenderId,
        orgId: org.id,
        title: validated.title,
        language: validated.language,
        status: "DRAFT",
        createdById: member.id,
        sections: {
          create: defaultSections.map((sectionType, idx) => ({
            orgId: org.id,
            sectionType,
            orderIndex: idx,
          })),
        },
      },
    });

    after(() =>
      track(ANALYTICS_EVENTS.PROPOSAL_CREATED, analytics, {
        tenderId: validated.tenderId,
        sectionCount: defaultSections.length,
        language: validated.language,
      })
    );

    revalidatePath(`/tenders/${validated.tenderId}/proposals`);
    return { success: true, id: proposal.id };
  } catch (err) {
    console.error("createProposal:", err);
    return { success: false, error: "Failed to create proposal" };
  }
}

export async function addProposalSection(
  data: z.infer<typeof CreateSectionSchema>
): Promise<ProposalActionResult> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const validated = CreateSectionSchema.parse(data);

    const section = await db.proposalSection.create({
      data: {
        proposalId: validated.proposalId,
        orgId: org.id,
        sectionType: validated.sectionType,
        titleEn: validated.titleEn || null,
        titleAr: validated.titleAr || null,
        orderIndex: validated.orderIndex,
        lastEditedById: member.id,
      },
    });

    revalidatePath(`/tenders`);
    return { success: true, id: section.id };
  } catch (err) {
    console.error("addProposalSection:", err);
    return { success: false, error: "Failed to add section" };
  }
}

export async function saveSnapshot(
  proposalId: string,
  label?: string
): Promise<ProposalActionResult> {
  try {
    const { org, member } = await getAuthContext();

    const proposal = await db.proposal.findFirst({
      where: { id: proposalId, orgId: org.id, deletedAt: null },
      include: { sections: { where: { deletedAt: null }, orderBy: { orderIndex: "asc" } } },
    });

    if (!proposal) return { success: false, error: "Proposal not found" };

    await db.proposalVersion.create({
      data: {
        proposalId,
        orgId: org.id,
        versionNumber: proposal.currentVersion + 1,
        label: label ?? `Version ${proposal.currentVersion + 1}`,
        snapshot: proposal.sections as any,
        createdById: member.id,
      },
    });

    await db.proposal.update({
      where: { id: proposalId },
      data: { currentVersion: { increment: 1 } },
    });

    revalidatePath(`/tenders`);
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to save snapshot" };
  }
}
