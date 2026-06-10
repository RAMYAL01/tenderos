import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ContentLanguage } from "@prisma/client";
import { db } from "@/lib/prisma";
import { checkAndConsumeProposalQuota } from "@/lib/billing/quota";

const CreateSchema = z.object({
  tenderId: z.string(),
  title: z.string().min(1),
  language: z.nativeEnum(ContentLanguage).default("EN"),
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

  // Plan limit: proposals per month.
  const quota = await checkAndConsumeProposalQuota(org.id);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error, code: quota.code }, { status: 402 });
  }

  const proposal = await db.proposal.create({
    data: {
      tenderId: parsed.data.tenderId,
      orgId: org.id,
      title: parsed.data.title,
      language: parsed.data.language,
      status: "DRAFT",
      createdById: member.id,
    },
  });

  return NextResponse.json(proposal, { status: 201 });
}
