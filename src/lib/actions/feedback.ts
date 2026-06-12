"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

/**
 * Phase-3 feedback capture. Review UIs (BOQ extraction, compliance matrix,
 * proposal editor) call this when an expert accepts / edits / rejects an AI
 * output. Tenant-scoped via the session — a member can only file feedback for
 * their own org. These rows feed lib/training/export.ts.
 */

const TASKS = [
  "requirement_extraction",
  "compliance_analysis",
  "risk_identification",
  "proposal_generation",
  "scope_interpretation",
  "boq_classification",
  "bid_qualification",
] as const;

const FeedbackSchema = z.object({
  task: z.enum(TASKS),
  action: z.enum(["ACCEPT", "EDIT", "REJECT"]),
  modelVersion: z.string().max(120).optional(),
  lang: z.enum(["ar", "en", "mixed"]).optional(),
  inputRef: z.string().max(200).optional(),
  inputText: z.string().max(50_000).optional(),
  /** Raw model output that was reviewed (any JSON-serializable shape). */
  aiOutput: z.unknown(),
  /** Corrected/approved version (required for EDIT, optional for ACCEPT). */
  humanOutput: z.unknown().optional(),
  reason: z.string().max(2000).optional(),
});

export type RecordFeedbackInput = z.infer<typeof FeedbackSchema>;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export async function recordAIFeedback(
  input: RecordFeedbackInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { org, member } = await getAuthContext();
    const parsed = FeedbackSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid feedback" };
    }
    const data = parsed.data;

    // EDIT must carry the corrected output (it's the supervised target + DPO "chosen").
    if (data.action === "EDIT" && data.humanOutput == null) {
      return { success: false, error: "EDIT feedback requires humanOutput." };
    }

    const row = await db.aIFeedback.create({
      data: {
        orgId: org.id,
        memberId: member.id,
        task: data.task,
        action: data.action,
        reviewerRole: member.role,
        modelVersion: data.modelVersion ?? null,
        lang: data.lang ?? null,
        inputRef: data.inputRef ?? null,
        inputText: data.inputText ?? null,
        aiOutput: toJson(data.aiOutput),
        humanOutput: data.humanOutput == null ? undefined : toJson(data.humanOutput),
        reason: data.reason ?? null,
      },
      select: { id: true },
    });

    return { success: true, id: row.id };
  } catch (err) {
    console.error("recordAIFeedback error:", err);
    return { success: false, error: "Failed to record feedback." };
  }
}
