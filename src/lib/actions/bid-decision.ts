"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/security/audit";

/**
 * Record the HUMAN bid/no-bid decision on an AI qualification.
 *
 * MANAGER+ only — committing the company to (or away from) a bid is a
 * management call. The decision is also captured as AIFeedback so the
 * training flywheel learns from agreement (ACCEPT) and overrides (REJECT):
 * over time the qualifier calibrates to how THIS company actually decides.
 */

const DecisionSchema = z.object({
  tenderId: z.string().min(1),
  decision: z.enum(["BID", "NO_BID"]),
  notes: z.string().max(2000).optional(),
});

type Result = { success: boolean; error?: string };

export async function recordBidDecision(
  input: z.infer<typeof DecisionSchema>
): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "MANAGER");

    const parsed = DecisionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const { tenderId, decision, notes } = parsed.data;

    // Org-scoped read of the analysis being decided on.
    const analysis = await db.bidDecision.findFirst({
      where: { tenderId, orgId: org.id },
    });
    if (!analysis) return { success: false, error: "Run the analysis first." };

    // Org-scoped write (orgId in the predicate — never trust ids alone).
    const res = await db.bidDecision.updateMany({
      where: { id: analysis.id, orgId: org.id },
      data: {
        humanDecision: decision,
        decidedById: member.id,
        decidedAt: new Date(),
        decisionNotes: notes ?? null,
      },
    });
    if (res.count === 0) return { success: false, error: "Not found." };

    // Flywheel: agreement = ACCEPT, override = REJECT (with the human's reason).
    const agreed = analysis.recommendation === decision;
    await db.aIFeedback
      .create({
        data: {
          orgId: org.id,
          memberId: member.id,
          task: "bid_qualification",
          action: agreed ? "ACCEPT" : "REJECT",
          reviewerRole: member.role,
          modelVersion: analysis.modelVersion,
          inputRef: analysis.id,
          aiOutput: {
            score: analysis.score,
            recommendation: analysis.recommendation,
            factors: analysis.factors,
          },
          humanOutput: { decision },
          reason: agreed ? null : notes ?? "Human overrode the recommendation.",
        },
      })
      .catch(() => {}); // feedback is best-effort — never block the decision

    await logAudit({
      orgId: org.id,
      memberId: member.id,
      action: "tender.bid_decision",
      resourceType: "tender",
      resourceId: tenderId,
      newValues: { decision, aiRecommendation: analysis.recommendation, score: analysis.score },
    });

    revalidatePath(`/tenders/${tenderId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && (err as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
    console.error("recordBidDecision error:", err);
    return { success: false, error: "Could not record the decision." };
  }
}
