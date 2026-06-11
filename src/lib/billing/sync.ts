import type Stripe from "stripe";
import type { PlanTier } from "@prisma/client";
import { db } from "@/lib/prisma";
import { PLAN_LIMITS } from "@/lib/constants";
import {
  priceIdToPlan,
  mapStripeStatus,
  subscriptionPeriod,
  subscriptionPriceId,
  type BillingCycle,
} from "./stripe";

/**
 * Apply a plan tier's limits to an Organization. Keeps the org's quota columns
 * in lockstep with whatever the customer is paying for. Idempotent.
 */
export async function applyPlanToOrg(orgId: string, tier: PlanTier): Promise<void> {
  const limits = PLAN_LIMITS[tier];
  await db.organization.update({
    where: { id: orgId },
    data: {
      planTier: tier,
      maxSeats: limits.seats,
      maxProposalsMonth: limits.proposalsPerMonth,
      aiCreditsMonth: limits.aiCreditsPerMonth,
      storageBytesLimit: BigInt(limits.storageBytesLimit),
      maxSavedSearches: limits.savedSearches,
      maxTrackedOpportunities: limits.trackedOpportunities,
    },
  });
}

/**
 * Resolve our internal orgId from a Stripe subscription. Prefers the orgId we
 * stamp into subscription metadata at checkout; falls back to matching an
 * existing Subscription row by Stripe sub/customer id.
 */
export async function resolveOrgId(
  sub: Stripe.Subscription
): Promise<string | null> {
  const metaOrgId = sub.metadata?.orgId;
  if (metaOrgId) return metaOrgId;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  const existing = await db.subscription.findFirst({
    where: {
      OR: [
        { stripeSubId: sub.id },
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
    select: { orgId: true },
  });
  return existing?.orgId ?? null;
}

/**
 * Upsert our Subscription row + Organization limits from a Stripe Subscription
 * object. This is the single source of truth invoked by every relevant webhook
 * event, so the handlers stay thin and consistent.
 */
export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const orgId = await resolveOrgId(sub);
  if (!orgId) {
    console.error(`[billing] Could not resolve orgId for subscription ${sub.id}`);
    return;
  }

  const priceId = subscriptionPriceId(sub);
  const plan = priceIdToPlan(priceId);
  const status = mapStripeStatus(sub.status);
  const { start, end } = subscriptionPeriod(sub);
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

  // Tier the customer is paying for. If we can't map the price, keep the
  // org's existing tier rather than guessing.
  const tier: PlanTier | null = plan?.tier ?? null;
  const cycle: BillingCycle = plan?.cycle ?? "monthly";

  const isActive = status === "active" || status === "trialing";
  const isTrial = status === "trialing";

  await db.subscription.upsert({
    where: { orgId },
    create: {
      orgId,
      planTier: tier ?? "STARTER",
      seats: tier ? PLAN_LIMITS[tier].seats : 3,
      billingCycle: cycle,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      stripeCustomerId: customerId,
      stripeSubId: sub.id,
      stripePriceId: priceId,
      status,
      isTrial,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
    update: {
      ...(tier ? { planTier: tier, seats: PLAN_LIMITS[tier].seats } : {}),
      billingCycle: cycle,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      stripeCustomerId: customerId,
      stripeSubId: sub.id,
      stripePriceId: priceId,
      status,
      isTrial,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
  });

  // Only grant a tier's limits while the subscription is actually paying.
  if (tier && isActive) {
    await applyPlanToOrg(orgId, tier);
  }
}

/**
 * Handle a fully-cancelled subscription: mark cancelled and revert the org to
 * the free Starter limits so access is downgraded cleanly.
 */
export async function handleSubscriptionCancelled(
  sub: Stripe.Subscription
): Promise<void> {
  const orgId = await resolveOrgId(sub);
  if (!orgId) return;

  await db.subscription.updateMany({
    where: { orgId },
    data: { status: "cancelled", cancelAtPeriodEnd: true },
  });
  await applyPlanToOrg(orgId, "STARTER");
}
