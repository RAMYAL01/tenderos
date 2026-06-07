/**
 * Platform-operator training-data export (NOT a tenant endpoint).
 *
 * GET /api/internal/training-export?kind=sft|dpo&limit=&mark=1
 *   Auth: x-internal-api-key === INTERNAL_API_KEY.
 *   Returns de-identified JSONL. With mark=1, stamps exported rows so the next
 *   dataset version doesn't double-count them.
 */

import { NextResponse } from "next/server";
import { buildTrainingExport, markExported } from "@/lib/training/export";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = req.headers.get("x-internal-api-key");
  if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "dpo" ? "dpo" : "sft";
  const limit = Number(url.searchParams.get("limit") ?? "5000");
  const orgId = url.searchParams.get("orgId") ?? undefined; // per-tenant adapter export
  const mark = url.searchParams.get("mark") === "1";

  const exp = await buildTrainingExport({ orgId, limit: Number.isFinite(limit) ? limit : 5000 });
  if (mark) await markExported(exp.rowIds);

  const body = (kind === "dpo" ? exp.dpo : exp.sft).join("\n") + (exp.sft.length || exp.dpo.length ? "\n" : "");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="tenderos-${kind}-${exp.counts.rows}.jsonl"`,
      "x-rows": String(exp.counts.rows),
      "x-sft": String(exp.counts.sft),
      "x-dpo": String(exp.counts.dpo),
    },
  });
}
