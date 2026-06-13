import "server-only";
import type { Prisma } from "@prisma/client";
import { APP_URL } from "@/lib/constants";
import { enqueueEmail } from "./email-queue";
import { resolveRecipients } from "./recipients";
import { subject as digestSubject } from "./templates/daily-digest";
import type { DailyDigestPayload, DigestOpportunity } from "./types";

/**
 * Daily digest — DELIBERATELY rides the existing discovery-refresh cron rather
 * than introducing a second scheduler. That cron already (a) finds new matches,
 * (b) dedupes them per org via OpportunityMatch.lastNotifiedAt, and (c) stamps
 * that timestamp after delivery. We reuse the SAME deduped `fresh` set it
 * already computed for the in-app alert, so "find matches / avoid duplicates /
 * store last-delivered timestamp" are all satisfied with zero duplicate logic.
 *
 * This module only turns that set into per-recipient digest emails and enqueues
 * them; the cron drains the queue at the end of its run.
 */

export interface DigestMatch {
  relevanceScore: number;
  opportunity: {
    titleEn: string;
    buyerName: string | null;
    country: string | null;
    closingDate: Date | null;
  };
}

const discoverUrl = `${APP_URL}/discover`;

function toOpportunity(m: DigestMatch): DigestOpportunity {
  return {
    title: m.opportunity.titleEn,
    buyerName: m.opportunity.buyerName,
    country: m.opportunity.country,
    score: m.relevanceScore,
    closingDate: m.opportunity.closingDate
      ? m.opportunity.closingDate.toISOString().slice(0, 10)
      : null,
    url: discoverUrl,
  };
}

/**
 * Enqueue one digest email per digest-subscribed member of `org` for the given
 * fresh matches. No-ops when there are no matches or no subscribers. Returns the
 * number of emails enqueued (for the cron summary).
 */
export async function enqueueOrgDigest(
  org: { id: string; name: string },
  fresh: DigestMatch[]
): Promise<number> {
  if (fresh.length === 0) return 0;

  const recipients = await resolveRecipients(org.id, { category: "DIGEST" });
  if (recipients.length === 0) return 0;

  const opportunities = fresh.map(toOpportunity);

  let enqueued = 0;
  for (const r of recipients) {
    const payload: DailyDigestPayload = {
      recipientName: r.name,
      organizationName: org.name,
      opportunities,
      discoverUrl,
    };
    await enqueueEmail({
      orgId: org.id,
      memberId: r.memberId,
      to: r.email,
      event: "NEW_DISCOVERY_MATCH",
      category: "DIGEST",
      subject: digestSubject(payload),
      payload: payload as unknown as Prisma.InputJsonValue,
    });
    enqueued++;
  }
  return enqueued;
}
