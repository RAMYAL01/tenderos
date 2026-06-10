import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ComplianceStatus } from "@prisma/client";
import { db } from "@/lib/prisma";

const UpdateSchema = z.object({
  status: z.nativeEnum(ComplianceStatus).optional(),
  responseEn: z.string().nullable().optional(),
  responseAr: z.string().nullable().optional(),
  sectionReference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
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

  const row = await db.complianceMatrixRow.findFirst({
    where: { id, orgId: org.id },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  // Scoped write — orgId is part of the mutation predicate itself.
  const res = await db.complianceMatrixRow.updateMany({
    where: { id, orgId: org.id },
    data: parsed.data,
  });
  if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.complianceMatrixRow.findFirst({ where: { id, orgId: org.id } });
  return NextResponse.json(updated);
}
