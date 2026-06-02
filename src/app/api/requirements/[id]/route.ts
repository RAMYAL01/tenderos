import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";

const UpdateSchema = z.object({
  textEn: z.string().min(1).optional(),
  textAr: z.string().nullable().optional(),
  requirementType: z.enum(["MANDATORY","OPTIONAL","INFORMATIONAL","CONDITIONAL"]).optional(),
  priority: z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).optional(),
  sectionRef: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

async function getOrgAndVerify(orgId: string, requirementId: string) {
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return null;
  const req = await db.requirement.findFirst({
    where: { id: requirementId, orgId: org.id, deletedAt: null },
  });
  return req ? { org, req } : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ctx = await getOrgAndVerify(orgId, id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const updated = await db.requirement.update({
    where: { id },
    data: {
      ...parsed.data,
      requirementType: parsed.data.requirementType as any,
      priority: parsed.data.priority as any,
    },
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
  const ctx = await getOrgAndVerify(orgId, id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.requirement.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
}
