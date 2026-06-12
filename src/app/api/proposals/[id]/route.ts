import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ContentLanguage } from "@prisma/client";
import { db } from "@/lib/prisma";

// Review states (IN_REVIEW / CHANGES_REQUESTED / APPROVED) are deliberately NOT
// accepted here — they must flow through the gated, role-checked, trail-logged
// actions in lib/actions/proposal-review.ts. This PATCH covers only the
// non-review lifecycle (rename, language, export/archive bookkeeping).
const UpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  status: z.enum(["DRAFT", "EXPORTED", "ARCHIVED"]).optional(),
  language: z.nativeEnum(ContentLanguage).optional(),
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

  const res = await db.proposal.updateMany({
    where: { id, orgId: org.id, deletedAt: null },
    data: parsed.data,
  });
  if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.proposal.findFirst({ where: { id, orgId: org.id } });
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
