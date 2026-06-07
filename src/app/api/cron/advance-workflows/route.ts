/**
 * Cron: resume stalled BOQ workflows (the durable backstop for the §2 `after()`
 * pattern). If a serverless function was reaped before a workflow reached a
 * terminal state, this picks it up from the persisted state and drives it on.
 *
 * Schedule (vercel.json): every few minutes.
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { runBoqWorkflowToCompletion } from "@/lib/workflow/boq/orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TERMINAL = ["PRICED", "FAILED"] as const;
const BATCH = 8; // bound work per cron tick
const STALE_MS = 60_000; // only touch workflows untouched for >60s (avoid racing a live after())

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_MS);
  const stuck = await db.boqWorkflow.findMany({
    where: {
      status: { notIn: [...TERMINAL] },
      updatedAt: { lt: cutoff },
    },
    orderBy: { updatedAt: "asc" },
    take: BATCH,
    select: { id: true, orgId: true, status: true },
  });

  const results: Array<{ id: string; from: string; to: string }> = [];
  for (const wf of stuck) {
    try {
      // Each workflow advanced within its OWN tenant scope.
      const to = await runBoqWorkflowToCompletion(wf.orgId, wf.id, { maxSteps: 4 });
      results.push({ id: wf.id, from: wf.status, to });
    } catch (err) {
      logger.error({ err, workflowId: wf.id }, "advance-workflows: resume failed");
      results.push({ id: wf.id, from: wf.status, to: "ERROR" });
    }
  }

  logger.info({ picked: stuck.length, results }, "advance-workflows tick");
  return NextResponse.json({ picked: stuck.length, results });
}
