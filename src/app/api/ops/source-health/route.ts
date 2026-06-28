import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { deriveSourceHealth } from "@/lib/discovery/ingest";

/**
 * Operator source-health surface (Wave 1, item 8).
 *
 * Per-source freshness + status for BOTH global catalogs — the Discovery sources
 * (Opportunity) and the Benchmark gazette sources (AwardOutcome). This is the
 * read side the cron previously lacked (its summary only went to logs). Source
 * health is catalog-level operator data, not tenant data, so it is secured by the
 * same CRON_SECRET the cron uses — not exposed in the tenant UI.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/ops/source-health
 */

export const dynamic = "force-dynamic";

type Row = {
  slug: string;
  name: string;
  country: string | null;
  adapterKey: string;
  isActive: boolean;
  lastPolledAt: Date | null;
  lastSuccessAt: Date | null;
  consecutiveFailures: number;
  lastItemCount: number | null;
  lastError: string | null;
};

const SELECT = {
  slug: true,
  name: true,
  country: true,
  adapterKey: true,
  isActive: true,
  lastPolledAt: true,
  lastSuccessAt: true,
  consecutiveFailures: true,
  lastItemCount: true,
  lastError: true,
} as const;

function shape(kind: "discovery" | "gazette", s: Row) {
  return {
    kind,
    slug: s.slug,
    name: s.name,
    country: s.country,
    adapterKey: s.adapterKey,
    isActive: s.isActive,
    health: s.isActive ? deriveSourceHealth(s) : ("DISABLED" as const),
    lastPolledAt: s.lastPolledAt,
    lastSuccessAt: s.lastSuccessAt,
    consecutiveFailures: s.consecutiveFailures,
    lastItemCount: s.lastItemCount,
    lastError: s.lastError,
  };
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [discovery, gazette] = await Promise.all([
    db.opportunitySource.findMany({ orderBy: { slug: "asc" }, select: SELECT }),
    db.gazetteSource.findMany({ orderBy: { slug: "asc" }, select: SELECT }),
  ]);

  const sources = [
    ...discovery.map((s) => shape("discovery", s)),
    ...gazette.map((s) => shape("gazette", s)),
  ];

  return NextResponse.json({
    summary: {
      total: sources.length,
      healthy: sources.filter((s) => s.health === "HEALTHY").length,
      degraded: sources.filter((s) => s.health === "DEGRADED").length,
      dead: sources.filter((s) => s.health === "DEAD").length,
      disabled: sources.filter((s) => s.health === "DISABLED").length,
    },
    sources,
  });
}
