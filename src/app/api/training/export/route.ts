/**
 * Tenant-scoped training export — an org owner/admin downloads THEIR OWN
 * feedback as de-identified JSONL (for a private per-tenant adapter). The
 * cross-org shared corpus stays behind /api/internal/training-export.
 *
 * GET /api/training/export?kind=sft|dpo
 */

import { NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";
import { buildTrainingExport } from "@/lib/training/export";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { org, member } = await getAuthContext();
  if (!hasRole(member.role, "ADMIN")) {
    return NextResponse.json({ error: "Owner/admin only" }, { status: 403 });
  }

  const kind = new URL(req.url).searchParams.get("kind") === "dpo" ? "dpo" : "sft";
  const exp = await buildTrainingExport({ orgId: org.id, includeExported: true });
  const lines = kind === "dpo" ? exp.dpo : exp.sft;
  const body = lines.length ? lines.join("\n") + "\n" : "";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="tenderos-${kind}-${lines.length}.jsonl"`,
    },
  });
}
