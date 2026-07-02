import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * GET /api/tenders/[id]/bid-agent — latest Autonomous Bid Agent run for the tender.
 * Org-scoped; the client card polls this while a run is in flight.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tenderId } = await params;
  const workflow = await db.bidWorkflow.findFirst({
    where: { tenderId, orgId: org.id },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      status: true,
      result: true,
      error: true,
      failedStep: true,
      updatedAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ workflow });
}
