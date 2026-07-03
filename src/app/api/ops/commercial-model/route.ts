import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * Read-only operator trace for the test run of the Knowledge Brain upload + the
 * per-bid Commercial Model. Given a tenderId, reports: the org's knowledge-brain
 * size + recent items (to confirm uploads extracted real text), the
 * COMMERCIAL_MODEL AIJob status, and the generated model content (to judge
 * quality). PURE READ — no writes. Secured by CRON_SECRET.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" ".../api/ops/commercial-model?tenderId=<id>"
 */
export const dynamic = "force-dynamic";

function trunc(s: unknown, n = 700): unknown {
  return typeof s === "string" && s.length > n ? s.slice(0, n) + "…" : s;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenderId = new URL(req.url).searchParams.get("tenderId");
  if (!tenderId) return NextResponse.json({ error: "tenderId query param required" }, { status: 400 });

  const tender = await db.tender.findUnique({
    where: { id: tenderId },
    select: { orgId: true, titleEn: true, sector: true, clientCountry: true },
  });
  if (!tender) return NextResponse.json({ error: "Tender not found" }, { status: 404 });
  const orgId = tender.orgId;

  const [items, chunks, recent, jobs, model] = await Promise.all([
    db.contentLibraryItem.count({ where: { orgId, deletedAt: null } }),
    db.knowledgeChunk.count({ where: { orgId } }),
    db.contentLibraryItem.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { titleEn: true, tags: true, contentEn: true, createdAt: true },
    }),
    db.aIJob.findMany({
      where: { resourceId: tenderId, jobType: "COMMERCIAL_MODEL" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { status: true, progress: true, errorMessage: true, totalTokens: true, costUsd: true, latencyMs: true, updatedAt: true },
    }),
    db.commercialModel.findUnique({
      where: { tenderId },
      select: { summary: true, content: true, modelVersion: true, updatedAt: true },
    }),
  ]);

  const c = (model?.content ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    tender: { titleEn: tender.titleEn, sector: tender.sector, country: tender.clientCountry },
    knowledgeBrain: {
      items,
      embeddedChunks: chunks,
      recent: recent.map((k) => ({
        title: k.titleEn,
        tags: k.tags,
        chars: (k.contentEn ?? "").length,
        snippet: trunc(k.contentEn, 220),
        addedAt: k.createdAt,
      })),
    },
    commercialModelJobs: jobs,
    commercialModel: model
      ? {
          updatedAt: model.updatedAt,
          modelVersion: model.modelVersion,
          summary: model.summary,
          deliveryApproach: trunc(c.deliveryApproach),
          pricingStrategy: trunc(c.pricingStrategy),
          partnering: trunc(c.partnering),
          commercialTerms: c.commercialTerms,
          risks: c.risks,
          winThemes: c.winThemes,
        }
      : null,
  });
}
