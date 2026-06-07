/**
 * Deliverable 1 — The Orchestrator (Workflow Controller).
 *
 * A persisted state machine that sequences the three modules and routes the
 * validated payload between them:
 *
 *   DRAFT --extract--> EXTRACTED --compliance--> COMPLIANCE_CHECKED --price--> PRICED
 *
 * Design for serverless: `advance()` runs EXACTLY ONE transition and commits
 * the result, so each step lives inside one function invocation and the whole
 * run is resumable after a timeout/crash. The intermediate *_ING states mark a
 * step as in-flight; a resume re-runs that step idempotently. Every query is
 * org-scoped — a workflow can only ever be advanced by its owning tenant, and
 * the deterministic pricing step never trusts the stored extraction blindly
 * (it re-validates with zod).
 */

import type { BoqWorkflowStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { extractBoq } from "./extract-agent";
import { checkCompliance } from "./compliance-agent";
import { runFinancialRouter } from "./financial-router";
import { WorkflowInputSchema } from "./schemas";
import type { z } from "zod";

/** Serialize a typed payload into a Prisma-safe JSON value (drops index-sig issues + NaN). */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const TERMINAL: BoqWorkflowStatus[] = ["PRICED", "FAILED"];
const MAX_ATTEMPTS_PER_STEP = 3;

export interface CreateWorkflowInput {
  orgId: string;
  createdById?: string;
  input: z.infer<typeof WorkflowInputSchema>;
}

/** Create a workflow in DRAFT. Input is validated before anything is persisted. */
export async function createBoqWorkflow(args: CreateWorkflowInput): Promise<string> {
  if (!args.orgId) throw new Error("createBoqWorkflow: orgId required");
  const input = WorkflowInputSchema.parse(args.input);

  const wf = await db.boqWorkflow.create({
    data: {
      orgId: args.orgId,
      createdById: args.createdById ?? null,
      tenderId: input.tenderId ?? null,
      status: "DRAFT",
      sourceText: input.sourceText,
      requirements: input.requirements ?? [],
      config: toJson(input.config),
    },
    select: { id: true },
  });
  return wf.id;
}

/**
 * Run exactly one transition for the workflow and persist it. Returns the new
 * status. Safe to call repeatedly (driver loop or cron). Tenant-scoped.
 */
export async function advanceBoqWorkflow(
  orgId: string,
  workflowId: string
): Promise<BoqWorkflowStatus> {
  if (!orgId || !workflowId) throw new Error("advance: orgId and workflowId required");

  // Tenant isolation: a workflow is only ever found through its own orgId.
  const wf = await db.boqWorkflow.findFirst({ where: { id: workflowId, orgId } });
  if (!wf) throw new Error("advance: workflow not found for this tenant");
  if (TERMINAL.includes(wf.status)) return wf.status;

  if (wf.attempts >= MAX_ATTEMPTS_PER_STEP) {
    return fail(workflowId, wf.status, `Exceeded ${MAX_ATTEMPTS_PER_STEP} attempts on ${wf.status}.`);
  }

  try {
    switch (wf.status) {
      // ── Step 1: extraction (DRAFT, or resume a crashed EXTRACTING) ──
      case "DRAFT":
      case "EXTRACTING": {
        await mark(workflowId, "EXTRACTING");
        const extraction = await extractBoq(wf.sourceText ?? "");
        await db.boqWorkflow.update({
          where: { id: workflowId },
          data: {
            extraction: toJson(extraction),
            status: "EXTRACTED",
            attempts: 0,
            error: null,
            failedStep: null,
          },
        });
        return "EXTRACTED";
      }

      // ── Step 2: RAG compliance (EXTRACTED, or resume COMPLIANCE_CHECKING) ──
      case "EXTRACTED":
      case "COMPLIANCE_CHECKING": {
        await mark(workflowId, "COMPLIANCE_CHECKING");
        const requirements = Array.isArray(wf.requirements) ? (wf.requirements as string[]) : [];
        const matrix = requirements.length ? await checkCompliance(orgId, requirements) : [];
        await db.boqWorkflow.update({
          where: { id: workflowId },
          data: { compliance: toJson(matrix), status: "COMPLIANCE_CHECKED", attempts: 0 },
        });
        return "COMPLIANCE_CHECKED";
      }

      // ── Step 3: deterministic pricing (COMPLIANCE_CHECKED, or resume PRICING) ──
      case "COMPLIANCE_CHECKED":
      case "PRICING": {
        await mark(workflowId, "PRICING");
        // NO LLM here. Re-validates the extraction and runs the BigInt engine.
        const pricing = await runFinancialRouter(orgId, wf.extraction, wf.config);
        await db.boqWorkflow.update({
          where: { id: workflowId },
          data: {
            pricing: toJson(pricing),
            status: "PRICED",
            attempts: 0,
            completedAt: new Date(),
          },
        });
        return "PRICED";
      }

      default:
        return wf.status;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(workflowId, wf.status, message);
  }
}

/**
 * Drive the workflow to a terminal state. `maxSteps` bounds the loop so it
 * cannot exceed the host's execution budget; if it returns non-terminal, a cron
 * (or the next trigger) resumes from the persisted state.
 */
export async function runBoqWorkflowToCompletion(
  orgId: string,
  workflowId: string,
  opts: { maxSteps?: number } = {}
): Promise<BoqWorkflowStatus> {
  const maxSteps = Math.max(1, Math.min(opts.maxSteps ?? 6, 12));
  let status: BoqWorkflowStatus = "DRAFT";
  for (let i = 0; i < maxSteps; i++) {
    status = await advanceBoqWorkflow(orgId, workflowId);
    if (TERMINAL.includes(status)) break;
  }
  return status;
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Mark a step in-flight and count the attempt (for resume + retry capping). */
async function mark(workflowId: string, status: BoqWorkflowStatus): Promise<void> {
  await db.boqWorkflow.update({
    where: { id: workflowId },
    data: { status, attempts: { increment: 1 } },
  });
}

async function fail(
  workflowId: string,
  step: BoqWorkflowStatus,
  message: string
): Promise<BoqWorkflowStatus> {
  await db.boqWorkflow.update({
    where: { id: workflowId },
    data: { status: "FAILED", error: message.slice(0, 1000), failedStep: step },
  });
  return "FAILED";
}
