import { NextResponse } from "next/server";
import { runExtractionAgent } from "@/lib/ai/agents/extract-requirements";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-internal-api-key");
  if (apiKey !== (process.env.INTERNAL_API_KEY ?? "dev-internal")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId, tenderId, documentIds, orgId } = await req.json();

  await runExtractionAgent(jobId, tenderId, documentIds, orgId);

  return NextResponse.json({ success: true });
}
