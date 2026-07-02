"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/security/audit";
import { createBidWorkflow, runBidWorkflowToCompletion } from "@/lib/bid-agent/orchestrator";

/**
 * Start the Autonomous Bid Agent for a tender (Wave 3, #6). WRITER+ only — it
 * spends AI credits (one per step). Drives the run in-request via after(); the
 * daily advance-workflows cron is the durable backstop if the function times out.
 */

type Result = { success: boolean; error?: string; workflowId?: string };

/** Non-terminal statuses — a run in any of these is still in flight. */
const ACTIVE = ["QUEUED", "EXTRACTING", "EXTRACTED", "CHECKING_COMPLIANCE", "COMPLIANCE_READY", "QUALIFYING"] as const;

export async function startBidAgent(tenderId: string): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");
    if (!tenderId) return { success: false, error: "Missing tender." };

    const tender = await db.tender.findFirst({
      where: { id: tenderId, orgId: org.id, deletedAt: null },
      select: { id: true },
    });
    if (!tender) return { success: false, error: "Tender not found." };

    const readyDocs = await db.document.count({
      where: { tenderId, orgId: org.id, processingStatus: "READY", deletedAt: null },
    });
    if (readyDocs === 0) {
      return { success: false, error: "Upload and process at least one tender document first." };
    }

    // Never start a second run while one is already in flight for this tender.
    const active = await db.bidWorkflow.findFirst({
      where: { tenderId, orgId: org.id, status: { in: [...ACTIVE] } },
      select: { id: true },
    });
    if (active) return { success: true, workflowId: active.id };

    const workflowId = await createBidWorkflow({ orgId: org.id, tenderId, createdById: member.id });

    await logAudit({
      orgId: org.id,
      memberId: member.id,
      action: "tender.bid_agent_started",
      resourceType: "tender",
      resourceId: tenderId,
      newValues: { workflowId },
    });

    // Drive it now; if we're reaped mid-run the cron resumes from the persisted state.
    after(() => runBidWorkflowToCompletion(org.id, workflowId, { maxSteps: 6 }).catch(() => {}));

    revalidatePath(`/tenders/${tenderId}`);
    return { success: true, workflowId };
  } catch (err) {
    if (err instanceof Error && (err as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
    console.error("startBidAgent error:", err);
    return { success: false, error: "Could not start the autonomous draft." };
  }
}
