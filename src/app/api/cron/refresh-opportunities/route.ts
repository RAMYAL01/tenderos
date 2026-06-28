/**
 * Cron: daily Tender Discovery refresh.
 * Schedule (vercel.json): 0 6 * * * — daily 06:00 UTC ≈ 09:00 Gulf morning.
 * (Vercel Hobby allows daily crons only; per-tenant timing is not possible.)
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 *
 * Phases (all bounded — see lib/discovery/refresh.ts):
 *   ingest active sources → sweep statuses → delta re-match per org → digest alerts.
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { runDiscoveryRefresh } from "@/lib/discovery/refresh";
import { sendTrialExpiryWarnings } from "@/lib/email/trial";
import { runGazetteIngestion, autoDisableDeadGazetteSources } from "@/lib/benchmark/ingest-gazette";
import { autoDisableDeadSources } from "@/lib/discovery/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  // Unset secret must fail closed — `Bearer ${undefined}` would otherwise match
  // the literal header "Bearer undefined".
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runDiscoveryRefresh();
    // Piggyback the daily trial-expiry sweep + gazette award ingestion here rather
    // than spend Hobby's scarce cron slots on them.
    const trials = await sendTrialExpiryWarnings();
    const gazette = await runGazetteIngestion();
    // Dead-source auto-disable (both catalogs) — stop hammering broken adapters
    // and prevent a silently-stale source from poisoning the catalog + benchmark.
    const disabledSources = [
      ...(await autoDisableDeadSources()),
      ...(await autoDisableDeadGazetteSources()),
    ];
    if (disabledSources.length) {
      logger.error({ disabledSources }, "auto-disabled dead ingestion sources");
    }
    return NextResponse.json({ success: true, ...summary, trials, gazette, disabledSources });
  } catch (err) {
    logger.error({ err }, "refresh-opportunities cron failed");
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
