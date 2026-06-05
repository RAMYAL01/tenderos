/**
 * POST /api/import/vendors | /api/import/materials
 *
 * Part 1 entry point — internal users upload an .xlsx/.csv (multipart form-data,
 * field "file"; optional "mapping" JSON to override auto-mapping). Returns an
 * ImportResult with upsert counts and a per-row error report.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { importSpreadsheet, type ColumnMapping, type ImportEntity } from "@/lib/integrations/importer";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId || !clerkOrgId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const org = await db.organization.findUnique({ where: { clerkOrgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { entity: raw } = await params;
  const entity: ImportEntity | null = raw === "vendors" ? "vendor" : raw === "materials" ? "material" : null;
  if (!entity) {
    return NextResponse.json({ error: "BAD_ENTITY", message: "Use /api/import/vendors or /api/import/materials." }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_REQUIRED", message: "multipart field 'file' is required." }, { status: 400 });
  }

  let mapping: ColumnMapping | undefined;
  const mappingRaw = form?.get("mapping");
  if (typeof mappingRaw === "string" && mappingRaw.trim()) {
    try {
      mapping = JSON.parse(mappingRaw);
    } catch {
      return NextResponse.json({ error: "BAD_MAPPING", message: "'mapping' must be valid JSON." }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await importSpreadsheet({ orgId: org.id, buffer, entity, mapping });
  return NextResponse.json(result);
}
