/**
 * BOQ workflow trigger + status.
 *
 * SERVERLESS PATTERN
 * The full run (LLM extraction + per-requirement RAG + pricing) can exceed a
 * single function's wall-clock. So we do NOT run it inside the request:
 *   1. POST validates input, creates the workflow (DRAFT), returns 202 + id.
 *   2. `after()` kicks the orchestrator AFTER the response is flushed — it
 *      advances as many steps as fit the budget and commits each one.
 *   3. Because every transition is persisted, a cron (or a follow-up POST
 *      ?resume) safely continues any workflow left non-terminal — no step is
 *      ever lost or repeated destructively.
 * GET ?id= returns the current status + outputs (tenant-scoped).
 */

import { after, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { WorkflowInputSchema } from "@/lib/workflow/boq/schemas";
import {
  createBoqWorkflow,
  runBoqWorkflowToCompletion,
} from "@/lib/workflow/boq/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { org, member } = await getAuthContext();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = WorkflowInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues.slice(0, 5) },
      { status: 400 }
    );
  }

  const workflowId = await createBoqWorkflow({
    orgId: org.id,
    createdById: member.id,
    input: parsed.data,
  });

  // Run after the response is sent. Persisted state makes it resumable if the
  // function is reaped before reaching a terminal state.
  after(async () => {
    try {
      await runBoqWorkflowToCompletion(org.id, workflowId);
    } catch (err) {
      console.error(`[workflow:boq] ${workflowId} background run failed:`, err);
    }
  });

  return NextResponse.json({ workflowId, status: "DRAFT" }, { status: 202 });
}

export async function GET(req: Request) {
  const { org } = await getAuthContext();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Tenant-scoped read — a workflow is only visible to its own org.
  const wf = await db.boqWorkflow.findFirst({
    where: { id, orgId: org.id },
    select: {
      id: true,
      status: true,
      error: true,
      failedStep: true,
      extraction: true,
      compliance: true,
      pricing: true,
      startedAt: true,
      completedAt: true,
    },
  });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(wf);
}
