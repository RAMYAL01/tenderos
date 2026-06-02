import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Cron: Reset monthly usage counters
 * Schedule: 1st of every month at midnight UTC (vercel.json)
 *
 * Resets AI credits used and proposals used counters for all active subscriptions.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db.subscription.updateMany({
      where: { status: { in: ["active", "trialing"] } },
      data: {
        aiCreditsUsed: 0,
        proposalsUsed: 0,
      },
    });

    logger.info({ count: result.count }, "Monthly usage counters reset");

    return NextResponse.json({
      success: true,
      subscriptionsReset: result.count,
    });
  } catch (err) {
    logger.error({ err }, "Failed to reset monthly usage counters");
    return NextResponse.json(
      { error: "Failed to reset usage" },
      { status: 500 }
    );
  }
}
