import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";

const CreateSchema = z.object({
  tenderId: z.string(),
  title: z.string().min(1),
  language: z.enum(["EN", "AR", "AR_SA", "AR_AE", "AR_EG", "BILINGUAL"]).default("EN"),
});

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await db.member.findFirst({ where: { clerkUserId: userId, orgId: org.id, isActive: true } });
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tender = await db.tender.findFirst({
    where: { id: parsed.data.tenderId, orgId: org.id, deletedAt: null },
  });
  if (!tender) return NextResponse.json({ error: "Tender not found" }, { status: 404 });

  const proposal = await db.proposal.create({
    data: {
      tenderId: parsed.data.tenderId,
      orgId: org.id,
      title: parsed.data.title,
      language: parsed.data.language as any,
      status: "DRAFT",
      createdById: member.id,
    },
  });

  return NextResponse.json(proposal, { status: 201 });
}
