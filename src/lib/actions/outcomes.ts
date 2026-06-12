"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LossReason, TenderStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";

/**
 * Outcome debrief — the Win/Loss Intelligence producer.
 *
 * Recording WON/LOST is the single highest-value data event in the platform:
 * the discovery matcher and the bid qualifier both query tender outcomes live,
 * so every debrief immediately sharpens future matching and qualification.
 *
 * MANAGER+ records it (it's the company's official record). If the tender had
 * a Bid/No-Bid analysis, the OUTCOME grades the AI's recommendation —
 * ground-truth calibration far stronger than agreement labels:
 *   recommended BID  + WON  → ACCEPT (model was right)
 *   recommended BID  + LOST → REJECT (reason = the loss reason)
 *   recommended NO_BID + WON → REJECT (model would have skipped a winner)
 */

const OUTCOME_STATUSES = ["WON", "LOST", "NO_DECISION", "CANCELLED"] as const;

const OutcomeSchema = z
  .object({
    tenderId: z.string().min(1),
    status: z.enum(OUTCOME_STATUSES),
    lossReason: z.nativeEnum(LossReason).optional(),
    awardedValue: z.number().nonnegative().max(1e15).optional(),
    winningCompetitor: z.string().max(200).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => d.status !== "LOST" || d.lossReason != null, {
    message: "Select why the bid was lost — it powers your win/loss intelligence.",
    path: ["lossReason"],
  });

export type RecordOutcomeInput = z.infer<typeof OutcomeSchema>;

type Result = { success: boolean; error?: string };

export async function recordTenderOutcome(input: RecordOutcomeInput): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "MANAGER");

    const parsed = OutcomeSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const d = parsed.data;

    // Org-scoped existence check (and grab the analysis for calibration).
    const tender = await db.tender.findFirst({
      where: { id: d.tenderId, orgId: org.id, deletedAt: null },
      select: {
        id: true,
        bidDecision: {
          select: {
            id: true,
            score: true,
            recommendation: true,
            modelVersion: true,
            factors: true,
          },
        },
      },
    });
    if (!tender) return { success: false, error: "Tender not found." };

    // Org-scoped write — the outcome IS the tender's terminal record.
    await db.tender.updateMany({
      where: { id: d.tenderId, orgId: org.id },
      data: {
        status: d.status as TenderStatus,
        lossReason: d.status === "LOST" ? d.lossReason : null,
        awardedValue: d.status === "WON" ? d.awardedValue ?? null : null,
        winningCompetitor: d.status === "LOST" ? d.winningCompetitor?.trim() || null : null,
        outcomeNotes: d.notes?.trim() || null,
        outcomeRecordedAt: new Date(),
        outcomeRecordedById: member.id,
      },
    });

    // Ground-truth calibration of the bid qualifier (best-effort, never blocks).
    const analysis = tender.bidDecision;
    if (analysis && (d.status === "WON" || d.status === "LOST")) {
      const rec = analysis.recommendation;
      const correct = (rec === "BID" && d.status === "WON") || (rec === "NO_BID" && d.status === "LOST");
      if (rec !== "REVIEW") {
        await db.aIFeedback
          .create({
            data: {
              orgId: org.id,
              memberId: member.id,
              task: "bid_qualification",
              action: correct ? "ACCEPT" : "REJECT",
              reviewerRole: member.role,
              modelVersion: analysis.modelVersion,
              inputRef: analysis.id,
              aiOutput: {
                score: analysis.score,
                recommendation: rec,
                factors: analysis.factors,
              },
              humanOutput: { outcome: d.status, lossReason: d.lossReason ?? null },
              reason: correct
                ? null
                : d.status === "LOST"
                  ? `Recommended BID but lost (${d.lossReason}).`
                  : "Recommended NO_BID but the company bid and won.",
            },
          })
          .catch(() => {});
      }
    }

    revalidatePath(`/tenders/${d.tenderId}`);
    revalidatePath("/tenders");
    revalidatePath("/analytics");
    return { success: true };
  } catch (err) {
    if (err instanceof Error && (err as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
    console.error("recordTenderOutcome error:", err);
    return { success: false, error: "Could not record the outcome." };
  }
}
