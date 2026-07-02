"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import { reversePlan } from "@/lib/tenders/reverse-plan";

/**
 * Reverse-planned bid schedule actions (Wave 3, #7). WRITER+ — the schedule is a
 * team commitment. Deterministic: dates come from reversePlan(), never AI.
 */

type Result = { success: boolean; error?: string };

/** (Re)plan the bid schedule from the tender's submission deadline. Replaces any prior plan. */
export async function planTenderTimeline(tenderId: string): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const tender = await db.tender.findFirst({
      where: { id: tenderId, orgId: org.id, deletedAt: null },
      select: { id: true, submissionDeadline: true },
    });
    if (!tender) return { success: false, error: "Tender not found." };

    const milestones = reversePlan(tender.submissionDeadline);
    if (milestones.length === 0) {
      return { success: false, error: "Set a future submission deadline first." };
    }

    // Replace — recomputing supersedes the old plan (the deadline may have moved).
    await db.$transaction([
      db.tenderMilestone.deleteMany({ where: { tenderId, orgId: org.id } }),
      db.tenderMilestone.createMany({
        data: milestones.map((m) => ({
          tenderId,
          orgId: org.id,
          key: m.key,
          label: m.label,
          dueAt: m.dueAt,
          orderIndex: m.orderIndex,
        })),
      }),
    ]);

    revalidatePath(`/tenders/${tenderId}`);
    return { success: true };
  } catch (err) {
    console.error("planTenderTimeline:", err);
    return { success: false, error: "Could not plan the timeline." };
  }
}

/** Toggle a milestone done/undone. */
export async function toggleTenderMilestone(milestoneId: string, tenderId: string, done: boolean): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const res = await db.tenderMilestone.updateMany({
      where: { id: milestoneId, tenderId, orgId: org.id },
      data: { done, doneAt: done ? new Date() : null },
    });
    if (res.count === 0) return { success: false, error: "Milestone not found." };

    revalidatePath(`/tenders/${tenderId}`);
    return { success: true };
  } catch (err) {
    console.error("toggleTenderMilestone:", err);
    return { success: false, error: "Could not update the milestone." };
  }
}
