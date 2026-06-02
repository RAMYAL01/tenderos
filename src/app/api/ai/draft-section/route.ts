import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { streamSectionDraft } from "@/lib/ai/agents/draft-section";

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({
  sectionId: z.string().min(1),
  sectionType: z.string().min(1),
  tenderId: z.string().min(1),
  language: z.enum(["EN", "AR", "AR_SA", "AR_AE", "AR_EG", "BILINGUAL"]).default("EN"),
  tone: z.enum(["formal_government", "technical", "professional", "concise"]).default("formal_government"),
  additionalContext: z.string().optional(),
});

/**
 * POST /api/ai/draft-section
 *
 * Streams a proposal section draft via Server-Sent Events (SSE).
 * The client uses EventSource or fetch + ReadableStream to receive text.
 *
 * Returns: text/event-stream with JSON data events:
 *   data: {"text": "..."}\n\n
 *   data: {"done": true, "usage": {...}}\n\n
 *   data: [DONE]\n\n
 */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the section + tender belong to this org
  const section = await db.proposalSection.findFirst({
    where: {
      id: parsed.data.sectionId,
      proposal: { tender: { orgId: org.id } },
    },
    select: { id: true },
  });

  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  try {
    const stream = await streamSectionDraft({
      sectionId: parsed.data.sectionId,
      sectionType: parsed.data.sectionType as any,
      tenderId: parsed.data.tenderId,
      orgId: org.id,
      language: parsed.data.language as any,
      tone: parsed.data.tone,
      additionalContext: parsed.data.additionalContext,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (err) {
    console.error("[draft-section] Stream error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
