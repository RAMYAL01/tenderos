import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { runGazetteIngestion, autoDisableDeadGazetteSources } from "@/lib/benchmark/ingest-gazette";

/**
 * Manual gazette ingestion trigger (Wave 1, item 4).
 *
 * Runs ONLY the benchmark award ingestion — fetch every active GazetteSource, parse,
 * entity-resolve, and upsert into the AwardOutcome pool — without the rest of the
 * daily cron (discovery refresh, digest emails, trial warnings). Use it to populate
 * or refresh the pool on demand and in-region (Vercel ↔ Neon are co-located, so the
 * many small upserts run fast; the same job is far too latency-bound to run from a
 * laptop). Secured by CRON_SECRET like the other ops endpoints — catalog data, not
 * tenant data.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/ops/ingest-gazette
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const gazette = await runGazetteIngestion();
    const disabled = await autoDisableDeadGazetteSources();
    if (disabled.length) logger.error({ disabled }, "auto-disabled dead gazette sources");
    return NextResponse.json({ success: true, gazette, disabled });
  } catch (err) {
    logger.error({ err }, "manual gazette ingestion failed");
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
