import { NextResponse } from "next/server";
import { runClarificationAgent } from "@/lib/ai/agents/clarification-questions";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-internal-api-key");
  if (apiKey !== (process.env.INTERNAL_API_KEY ?? "dev-internal")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId, tenderId, orgId } = await req.json();
  await runClarificationAgent(jobId, tenderId, orgId);
  return NextResponse.json({ success: true });
}
