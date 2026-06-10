import { db } from "@/lib/prisma";

/**
 * Plan-limit enforcement (AI credits, proposals/month, seats).
 *
 * The limits live on Organization (aiCreditsMonth, maxProposalsMonth, maxSeats)
 * and are kept in sync with the plan by billing/sync.ts. Usage counters live on
 * Subscription (aiCreditsUsed, proposalsUsed) and are reset by the monthly cron.
 *
 * Orgs without a Subscription row (fresh workspaces before checkout) fall back
 * to counting this month's rows (AIJob / Proposal), so limits still hold.
 *
 * A limit value <= 0 means "unlimited" (used by Business/Enterprise tiers).
 */

export type QuotaResult =
  | { ok: true; remaining?: number }
  | { ok: false; error: string; code: "QUOTA_EXCEEDED" };

function monthStartUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function exceeded(what: string): QuotaResult {
  return {
    ok: false,
    code: "QUOTA_EXCEEDED",
    error: `Monthly ${what} limit reached for your plan. Upgrade in Settings → Billing to continue.`,
  };
}

/**
 * Check and consume ONE AI credit for the org. Call at the START of every
 * user-initiated AI operation (not on internal continuation steps, so a
 * multi-step job costs one credit).
 */
export async function checkAndConsumeAiCredit(orgId: string): Promise<QuotaResult> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      aiCreditsMonth: true,
      subscription: { select: { id: true, aiCreditsUsed: true } },
    },
  });
  if (!org) return { ok: false, code: "QUOTA_EXCEEDED", error: "Workspace not found." };

  const limit = org.aiCreditsMonth;
  if (limit <= 0) return { ok: true }; // unlimited tier

  if (org.subscription) {
    // Atomic conditional increment — two racing requests can't both pass at the cap.
    const res = await db.subscription.updateMany({
      where: { id: org.subscription.id, aiCreditsUsed: { lt: limit } },
      data: { aiCreditsUsed: { increment: 1 } },
    });
    if (res.count === 0) return exceeded("AI credit");
    return { ok: true, remaining: Math.max(0, limit - org.subscription.aiCreditsUsed - 1) };
  }

  // No subscription row yet — derive usage from the AIJob log for this month.
  const used = await db.aIJob.count({
    where: { orgId, createdAt: { gte: monthStartUtc() } },
  });
  if (used >= limit) return exceeded("AI credit");
  return { ok: true, remaining: limit - used - 1 };
}

/** Check (and count) a new proposal against maxProposalsMonth. Call before create. */
export async function checkAndConsumeProposalQuota(orgId: string): Promise<QuotaResult> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      maxProposalsMonth: true,
      subscription: { select: { id: true, proposalsUsed: true } },
    },
  });
  if (!org) return { ok: false, code: "QUOTA_EXCEEDED", error: "Workspace not found." };

  const limit = org.maxProposalsMonth;
  if (limit <= 0) return { ok: true };

  if (org.subscription) {
    const res = await db.subscription.updateMany({
      where: { id: org.subscription.id, proposalsUsed: { lt: limit } },
      data: { proposalsUsed: { increment: 1 } },
    });
    if (res.count === 0) return exceeded("proposal");
    return { ok: true, remaining: Math.max(0, limit - org.subscription.proposalsUsed - 1) };
  }

  const used = await db.proposal.count({
    where: { orgId, createdAt: { gte: monthStartUtc() } },
  });
  if (used >= limit) return exceeded("proposal");
  return { ok: true, remaining: limit - used - 1 };
}

/** Seat check for invitations: active members + pending invites must stay < maxSeats. */
export async function checkSeatLimit(orgId: string): Promise<QuotaResult> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { maxSeats: true },
  });
  if (!org) return { ok: false, code: "QUOTA_EXCEEDED", error: "Workspace not found." };
  if (org.maxSeats <= 0) return { ok: true };

  const [members, pending] = await Promise.all([
    db.member.count({ where: { orgId, isActive: true, deletedAt: null } }),
    db.invitation.count({ where: { orgId, status: "PENDING", expiresAt: { gt: new Date() } } }),
  ]);
  if (members + pending >= org.maxSeats) {
    return {
      ok: false,
      code: "QUOTA_EXCEEDED",
      error: `Your plan includes ${org.maxSeats} seats and all are taken (including pending invites). Upgrade to add more.`,
    };
  }
  return { ok: true, remaining: org.maxSeats - members - pending - 1 };
}

/**
 * Billing lock for the app shell: true when the trial has expired with no paid
 * plan, or the subscription is unpaid. (past_due keeps access — Stripe retries.)
 */
export async function getBillingLock(orgId: string): Promise<{ locked: boolean; reason?: string }> {
  const sub = await db.subscription.findUnique({
    where: { orgId },
    select: { status: true, isTrial: true, trialEndsAt: true },
  });
  if (!sub) return { locked: false }; // fresh workspace — onboarding/trial handles it
  if (sub.status === "unpaid" || sub.status === "cancelled") {
    return { locked: true, reason: "payment" };
  }
  if (sub.isTrial && sub.trialEndsAt && sub.trialEndsAt.getTime() < Date.now()) {
    return { locked: true, reason: "trial_expired" };
  }
  return { locked: false };
}
