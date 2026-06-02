import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";

const UpdateSchema = z.object({
  title: z.string().optional(),
  status: z.enum(["DRAFT","IN_REVIEW","CHANGES_REQUESTED","APPROVED","EXPORTED","ARCHIVED"]).optional(),
  language: z.enum(["EN","AR","AR_SA","AR_AE","AR_EG","BILINGUAL"]).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const proposal = await db.proposal.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: {
      sections: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
      },
      tender: { select: { id: true, titleEn: true, titleAr: true, clientName: true, tenderType: true, primaryLanguage: true } },
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { versions: true, comments: true } },
    },
  });

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(proposal);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const updated = await db.proposal.update({
    where: { id, orgId: org.id },
    data: { ...parsed.data, status: parsed.data.status as any, language: parsed.data.language as any },
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

  await db.proposal.update({ where: { id, orgId: org.id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
}
