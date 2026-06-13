import "server-only";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notifyTrialExpiring } from "./events";

/**
 * Trial-expiry warnings at 7, 3, and 1 days before the trial ends. Rides a daily
 * cron. Dedup is via EmailLog: because the cron runs once a day and the buckets
 * are 7/3/1, at most one bucket matches per org per day, so "no TRIAL_EXPIRING
 * for this org in the last 20h" is a sufficient idempotency guard.
 */

const DAY = 86_400_000;
const BUCKETS = new Set([7, 3, 1]);

export async function sendTrialExpiryWarnings(): Promise<{ checked: number; sent: number }> {
  const now = Date.now();

  const subs = await db.subscription.findMany({
    where: {
      status: "trialing",
      trialEndsAt: { gte: new Date(now), lte: new Date(now + 8 * DAY) },
    },
    select: { orgId: true, trialEndsAt: true },
  });

  let sent = 0;
  for (const s of subs) {
    if (!s.trialEndsAt) continue;
    const daysLeft = Math.ceil((s.trialEndsAt.getTime() - now) / DAY);
    if (!BUCKETS.has(daysLeft)) continue;

    const recent = await db.emailLog.findFirst({
      where: {
        orgId: s.orgId,
        event: "TRIAL_EXPIRING",
        createdAt: { gte: new Date(now - 20 * 3600_000) },
      },
      select: { id: true },
    });
    if (recent) continue; // already warned today

    await notifyTrialExpiring({
      orgId: s.orgId,
      daysLeft,
      endsOn: s.trialEndsAt.toISOString().slice(0, 10),
    });
    sent++;
  }

  logger.info({ checked: subs.length, sent }, "trial-expiry warnings swept");
  return { checked: subs.length, sent };
}
