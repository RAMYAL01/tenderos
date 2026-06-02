import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";

const UpdateSchema = z.object({
  titleEn: z.string().nullable().optional(),
  titleAr: z.string().nullable().optional(),
  contentEn: z.string().nullable().optional(),
  contentAr: z.string().nullable().optional(),
  orderIndex: z.number().optional(),
  assignedToId: z.string().nullable().optional(),
  isAiGenerated: z.boolean().optional(),
  aiModelUsed: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await db.member.findFirst({
    where: { clerkUserId: userId, orgId: org.id, isActive: true },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const section = await db.proposalSection.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
  });
  if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const updated = await db.proposalSection.update({
    where: { id },
    data: { ...parsed.data, lastEditedById: member.id },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.proposalSection.update({
    where: { id, orgId: org.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
