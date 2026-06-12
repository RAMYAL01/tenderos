"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";

/**
 * Pipeline stage moves. Deliberately limited to the WORKING stages
 * (Qualifying=DRAFT, Bidding=ACTIVE, Submitted=SUBMITTED) — terminal outcomes
 * (WON/LOST/...) must go through recordTenderOutcome so the structured debrief
 * (loss reason, awarded value) is never skipped. That funnel IS the
 * win/loss-intelligence guarantee.
 */

const MoveSchema = z.object({
  tenderId: z.string().min(1),
  stage: z.enum(["DRAFT", "ACTIVE", "SUBMITTED"]),
});

export async function moveTenderStage(
  input: z.infer<typeof MoveSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const parsed = MoveSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    // Org-scoped write; also clears any stale outcome fields when a closed
    // tender is reopened back into a working stage.
    const res = await db.tender.updateMany({
      where: { id: parsed.data.tenderId, orgId: org.id, deletedAt: null },
      data: {
        status: parsed.data.stage,
        lossReason: null,
        awardedValue: null,
        winningCompetitor: null,
        outcomeRecordedAt: null,
        outcomeRecordedById: null,
      },
    });
    if (res.count === 0) return { success: false, error: "Tender not found." };

    revalidatePath("/pipeline");
    revalidatePath("/tenders");
    revalidatePath(`/tenders/${parsed.data.tenderId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && (err as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
    console.error("moveTenderStage error:", err);
    return { success: false, error: "Could not move the tender." };
  }
}
