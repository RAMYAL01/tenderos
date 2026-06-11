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

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runDiscoveryRefresh();
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    logger.error({ err }, "refresh-opportunities cron failed");
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
