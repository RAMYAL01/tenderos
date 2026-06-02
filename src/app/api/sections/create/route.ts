import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";

const Schema = z.object({
  proposalId: z.string(),
  sectionType: z.string(),
  titleEn: z.string().optional(),
  titleAr: z.string().optional(),
  orderIndex: z.number().default(0),
});

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const member = await db.member.findFirst({
    where: { clerkUserId: userId, orgId: org.id, isActive: true },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const proposal = await db.proposal.findFirst({
    where: { id: parsed.data.proposalId, orgId: org.id, deletedAt: null },
  });
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  const section = await db.proposalSection.create({
    data: {
      proposalId: parsed.data.proposalId,
      orgId: org.id,
      sectionType: parsed.data.sectionType as any,
      titleEn: parsed.data.titleEn || null,
      titleAr: parsed.data.titleAr || null,
      orderIndex: parsed.data.orderIndex,
      lastEditedById: member.id,
    },
  });

  return NextResponse.json(section, { status: 201 });
}
